#!/usr/bin/env node
// Audit all published blog posts for accidental-strikethrough patterns.
// Uses the shared detector from scripts/translate/validate.mjs so translation
// pipeline and standalone audit report on the same rule set.
//
// Usage:
//   node scripts/check-markdown.mjs            # scan src/data/blog/
//   node scripts/check-markdown.mjs <path>     # scan a single file or dir
//
// Exit code: 0 if clean, 1 if any findings — usable in CI.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectAccidentalStrikethrough } from "./translate/validate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

async function walk(target) {
  const stat = await fs.stat(target);
  if (stat.isFile()) return target.endsWith(".md") ? [target] : [];
  const entries = await fs.readdir(target, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const p = path.join(target, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(p)));
    else if (entry.isFile() && p.endsWith(".md")) files.push(p);
  }
  return files;
}

function relPath(p) {
  return path.relative(REPO_ROOT, p).replaceAll("\\", "/");
}

/**
 * 렌더되지 않은 ```mermaid 블록 탐지.
 *
 * Astro 파이프라인에는 mermaid 플러그인이 없다 (Vercel Chromium 이슈로 제거).
 * 그래서 블록을 넣고 `pnpm mermaid:render` 를 잊으면 다이어그램 대신
 * 코드 블록이 그대로 발행된다 — 빌드도 통과하고 링크 검사도 통과해서
 * 사람 눈으로만 잡히는 부류다.
 */
function detectUnrenderedMermaid(content) {
  const out = [];
  content.split("\n").forEach((line, i) => {
    if (/^\s*```mermaid\s*$/.test(line)) {
      out.push({ line: i + 1 });
    }
  });
  return out;
}

/**
 * 공인 IP 주소 탐지.
 *
 * 실제로 사고가 났다 (2026-09-06): 작성자의 집 공인 IP 가 deploy/README.md 와
 * 블로그 본문에 그대로 들어간 채 push 됐다. "집 IP 는 공개 저장소에 올리지
 * 말 것" 이라고 적어둔 문서 자체에 실제 값이 들어 있었다.
 *
 * 사설 대역과 문서용 예약 대역은 통과시킨다. 예시를 써야 할 때는 RFC 5737 의
 * 문서용 주소(192.0.2.x · 198.51.100.x · 203.0.113.x)를 쓰면 이 검사에 안 걸린다.
 */
function detectPublicIp(content) {
  const findings = [];
  const lines = content.split(/\r?\n/);
  const RE = /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g;

  const isAllowed = (a, b) =>
    a === 10 ||                       // 사설
    a === 127 ||                      // 루프백
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||       // 링크 로컬
    (a === 192 && b === 0) ||         // RFC 5737 문서용 (192.0.2.x)
    (a === 198 && b === 51) ||        // RFC 5737 (198.51.100.x)
    (a === 203 && b === 0) ||         // RFC 5737 (203.0.113.x)
    a >= 224;                         // 멀티캐스트 · 예약

  lines.forEach((line, i) => {
    // 버전 번호(1.24.0.1 같은 것)와 혼동되지 않도록 앞뒤 문맥이 버전이면 건너뛴다
    if (/\b(v|version|버전)\s*\d/i.test(line)) return;
    for (const m of line.matchAll(RE)) {
      const [a, b, c, d] = m.slice(1).map(Number);
      if ([a, b, c, d].some(n => n > 255)) continue;
      if (isAllowed(a, b)) continue;
      findings.push({ line: i + 1, ip: m[0], snippet: line.trim().slice(0, 90) });
    }
  });
  return findings;
}

// 기본 스캔 대상. 블로그 본문뿐 아니라 운영 문서도 본다 —
// 집 IP 가 새어나간 곳이 deploy/README.md 였다.
const DEFAULT_TARGETS = [
  "src/data/blog",
  "deploy",
  "docs",
  "README.md",
  "CLAUDE.md",
];

async function main() {
  const targets = process.argv[2]
    ? [path.resolve(process.argv[2])]
    : DEFAULT_TARGETS.map(t => path.join(REPO_ROOT, t));

  const files = [];
  for (const t of targets) {
    try {
      files.push(...(await walk(t)));
    } catch (e) {
      if (e.code !== "ENOENT") throw e; // 없는 경로는 조용히 건너뛴다
    }
  }

  let totalFindings = 0;
  const filesWithIssues = [];
  const filesWithMermaid = [];
  const filesWithIp = [];

  for (const file of files) {
    const content = await fs.readFile(file, "utf8");

    const raw = detectUnrenderedMermaid(content);
    if (raw.length > 0) filesWithMermaid.push({ file, raw });

    const ips = detectPublicIp(content);
    if (ips.length > 0) filesWithIp.push({ file, ips });

    const findings = detectAccidentalStrikethrough(content);
    if (findings.length === 0) continue;
    filesWithIssues.push({ file, findings });
    totalFindings += findings.length;
  }

  if (filesWithMermaid.length > 0) {
    const n = filesWithMermaid.reduce((a, f) => a + f.raw.length, 0);
    console.log(`\n⚠️  렌더되지 않은 \`\`\`mermaid 블록 ${n}개:`);
    for (const { file, raw } of filesWithMermaid) {
      console.log(`  ${relPath(file)} — L${raw.map(r => r.line).join(", L")}`);
    }
    console.log("  → `pnpm mermaid:render` 를 실행한 뒤 커밋하세요.\n");
  }

  if (filesWithIp.length > 0) {
    const n = filesWithIp.reduce((a, f) => a + f.ips.length, 0);
    console.log(`\n🔴 공인 IP 로 보이는 값 ${n}개:`);
    for (const { file, ips } of filesWithIp) {
      console.log(`  ${relPath(file)}`);
      for (const f of ips) console.log(`    L${f.line}: ${f.ip}  —  ${f.snippet}`);
    }
    console.log(
      "  → 서버 · 집 IP 는 공개 저장소에 올리지 마세요. 예시가 필요하면"
    );
    console.log(
      "     RFC 5737 문서용 주소(192.0.2.1 · 198.51.100.1 · 203.0.113.1)를 쓰세요.\n"
    );
  }

  const hardFail = filesWithMermaid.length > 0 || filesWithIp.length > 0;
  const scannedLabel = `Scanned ${files.length} file(s) in ${targets.map(t => relPath(t)).join(", ")}`;

  if (filesWithIssues.length === 0) {
    console.log(`${scannedLabel} — no accidental-strikethrough patterns found.`);
    process.exit(hardFail ? 1 : 0);
  }

  console.log(scannedLabel);
  console.log(
    `Found ${totalFindings} suspect pattern(s) across ${filesWithIssues.length} file(s):\n`
  );
  for (const { file, findings } of filesWithIssues) {
    console.log(`  ${relPath(file)}`);
    for (const f of findings) {
      console.log(`    L${f.line}: ${f.matched}`);
      console.log(`      → ${f.snippet}`);
    }
    console.log("");
  }
  console.log(
    "Hint: replace numeric-range tilde with en dash '–' (e.g. 1~2일 → 1–2일),"
  );
  console.log(
    "      or replace leading approximate '~' with '약' (e.g. ~1.5초 → 약 1.5초)."
  );
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
