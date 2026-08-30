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

async function main() {
  const target =
    process.argv[2] ?? path.join(REPO_ROOT, "src", "data", "blog");
  const files = await walk(path.resolve(target));

  let totalFindings = 0;
  const filesWithIssues = [];
  const filesWithMermaid = [];

  for (const file of files) {
    const content = await fs.readFile(file, "utf8");

    const raw = detectUnrenderedMermaid(content);
    if (raw.length > 0) filesWithMermaid.push({ file, raw });

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

  const scannedLabel = `Scanned ${files.length} file(s) in ${relPath(path.resolve(target))}`;

  if (filesWithIssues.length === 0) {
    console.log(`${scannedLabel} — no accidental-strikethrough patterns found.`);
    process.exit(filesWithMermaid.length > 0 ? 1 : 0);
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
