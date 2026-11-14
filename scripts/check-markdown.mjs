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
import { execFileSync } from "node:child_process";
import { mask, scanLine } from "./secret-patterns.mjs";
import { fileURLToPath } from "node:url";
import { detectAccidentalStrikethrough } from "./translate/validate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// CHECK_MD_ROOT 로 검사할 저장소를 바꿀 수 있다. 테스트가 임시 git 저장소에
// 시크릿을 심어 CLI 의 종료 코드와 출력을 확인하려는 이음매다 — 이게 없으면
// 스크립트 위치의 실저장소만 보게 되어 그런 테스트가 가짜가 된다.
const REPO_ROOT = path.resolve(process.env.CHECK_MD_ROOT || path.join(__dirname, ".."));

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
export function detectUnrenderedMermaid(content) {
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
export function detectPublicIp(content) {
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

  // `Chrome/144.0.0.0` · `nginx/1.24.0.1` 같은 제품명/버전 표기.
  //
  // 글자 하나 뒤의 슬래시까지 요구하는 게 핵심이다. 주소를 URL 로 적으면
  // 슬래시가 둘(`http://203.0.113.1`)이라 이 예외에 걸리지 않는다. 즉 진짜
  // IP 는 계속 잡힌다. (2026-09-23: User-Agent 예시가 오탐으로 막혔다)
  const isVersionAfterName = (line, idx) =>
    line[idx - 1] === "/" && /[A-Za-z]/.test(line[idx - 2] ?? "");

  lines.forEach((line, i) => {
    // 버전 번호(1.24.0.1 같은 것)와 혼동되지 않도록 앞뒤 문맥이 버전이면 건너뛴다
    if (/\b(v|version|버전)\s*\d/i.test(line)) return;
    for (const m of line.matchAll(RE)) {
      const [a, b, c, d] = m.slice(1).map(Number);
      if ([a, b, c, d].some(n => n > 255)) continue;
      if (isAllowed(a, b)) continue;
      if (isVersionAfterName(line, m.index)) continue;
      findings.push({ line: i + 1, ip: m[0], snippet: mask(line.trim()).slice(0, 90) });
    }
  });
  return findings;
}

/**
 * 시크릿 탐지 — CLAUDE.md 「보안 스크러빙」 의 의심 패턴을 코드로 옮긴 것.
 *
 * 규칙표와 마스킹은 secret-patterns.mjs 에 있다 (출력하는 모든 검사가 같은 곳을 거치게).
 * 막는 것(blocking)은 오탐이 거의 없는 형태뿐이다. hex · base64 · 인스턴스
 * 도메인은 글에 정상적으로 나올 수 있어서 경고만 한다 (2026-09-23 에 User-Agent
 * 예시가 IP 검사에 걸려 막힌 선례).
 *
 * matched: 막는 것은 앞 6자, 경고는 앞 4자 + 길이. hex 는 앞 6자만 봐도 24비트가
 * 새서 경고 쪽을 더 줄였다.
 */
export function detectSecrets(text) {
  const out = [];
  text.split(/\r?\n/).forEach((line, i) => {
    for (const h of scanLine(line)) {
      out.push({
        line: i + 1,
        kind: h.kind,
        matched: h.blocking
          // 차단·경고 모두 앞 4자 + 길이로 통일한다. 6자는 hex 24비트를
          // 드러낸다 (2026-11-14 2차 점검 S-9).
          ? `${h.value.slice(0, 4)}…(${h.value.length}자)`
          : `${h.value.slice(0, 4)}…(${h.value.length}자)`,
        blocking: h.blocking,
      });
    }
  });
  return out;
}

// ---------- 번역 축 검사 ----------

async function listMd(dir) {
  try {
    // `_` 로 시작하는 글은 콘텐츠 로더(`**/[^_]*.md`)가 발행에서 뺀다.
    // CLAUDE.md 가 종료 글을 숨기는 방식이라, 여기서도 같은 기준으로 건너뛴다.
    return (await fs.readdir(dir))
      .filter(f => f.endsWith(".md") && !f.startsWith("_"))
      .sort();
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

const slugOf = f => f.replace(/\.md$/, "");

async function isDraft(file) {
  const body = await fs.readFile(file, "utf8");
  const fm = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return !!fm && /^draft:\s*true\s*$/m.test(fm[1]);
}

// `koOnly: true` 인 글은 영어판을 두지 않기로 한 것이다. 짝이 없어도 정상이다.
// (2026-11-14, blog-beyond-astropaper — 살아있는 문서라 번역이 토큰 상한에 걸렸다)
async function isKoOnly(file) {
  const body = await fs.readFile(file, "utf8");
  const fm = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return !!fm && /^koOnly:\s*true\s*$/m.test(fm[1]);
}

/**
 * KO 에 있는데 EN 이 없는 글(missing)과 그 반대(orphans).
 * KO 만 커밋하면 언어 스위치가 홈으로 fallback 되어 방문자가 이탈한다
 * (CLAUDE.md 「자주 하는 실수」 1번). draft 는 번역하지 않는 게 정상이라 뺀다.
 */
export async function checkTranslationPairs({ koDir, enDir }) {
  const ko = await listMd(koDir);
  const en = new Set((await listMd(enDir)).map(slugOf));
  const koSlugs = new Set(ko.map(slugOf));

  const missing = [];
  for (const f of ko) {
    if (en.has(slugOf(f))) continue;
    if (await isDraft(path.join(koDir, f))) continue;
    if (await isKoOnly(path.join(koDir, f))) continue;
    missing.push(slugOf(f));
  }
  const orphans = [...en].filter(s => !koSlugs.has(s)).sort();
  return { missing, orphans };
}

// 파일마다 `git log` 를 부르면 190회에 3초 넘게 걸린다. 훅에서 돌 명령이라
// 한 번만 불러 파일별 최신 커밋 시각 표를 만든다.
function gitCommitTimes(dirs) {
  const times = new Map();
  let out = "";
  try {
    out = execFileSync(
      "git",
      ["log", "--format=%ct", "--name-only", "--", ...dirs.map(d => path.relative(REPO_ROOT, d))],
      { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 }
    );
  } catch {
    return times;
  }
  let current = null;
  for (const line of out.split("\n")) {
    if (/^\d+$/.test(line)) current = Number(line);
    // 최신 커밋부터 나오므로 처음 본 시각이 그 파일의 마지막 수정이다.
    else if (line && current != null && !times.has(line)) times.set(line, current);
  }
  return times;
}

/**
 * KO 가 EN 보다 나중에 커밋된 글. 작성자가 일부러 미룰 수 있어서 경고만 한다.
 * 커밋 시각 조회는 인자로 받는다 — 기본값만 git 을 부르므로 테스트가 가짜를 넣는다.
 */
export async function checkDivergence({
  koDir,
  enDir,
  commitTimeOf,
}) {
  if (!commitTimeOf) {
    const table = gitCommitTimes([koDir, enDir]);
    commitTimeOf = f => table.get(path.relative(REPO_ROOT, f).replaceAll("\\", "/")) ?? null;
  }
  const en = new Set(await listMd(enDir));
  const out = [];
  for (const f of await listMd(koDir)) {
    if (!en.has(f)) continue;
    const k = await commitTimeOf(path.join(koDir, f));
    const e = await commitTimeOf(path.join(enDir, f));
    if (!Number.isFinite(k) || !Number.isFinite(e) || k <= e) continue;
    out.push({ slug: slugOf(f), days: Math.floor((k - e) / 86400) });
  }
  return out;
}

async function referencedHashes(dir) {
  const hashes = new Map(); // hash → 참조한 파일들
  for (const f of await walk(dir).catch(() => [])) {
    const body = await fs.readFile(f, "utf8");
    for (const m of body.matchAll(/\/assets\/mermaid\/([0-9a-f]+)\.svg/g)) {
      if (!hashes.has(m[1])) hashes.set(m[1], new Set());
      hashes.get(m[1]).add(f);
    }
  }
  return hashes;
}

/**
 * EN 글 본문에 한글이 남았는지. 번역이 빠뜨린 문장을 잡는다.
 * 제외: frontmatter 의 tags (한국어 태그는 일부러 verbatim 유지한다), 코드 블록,
 * 인라인 코드. 고유명사 때문에 오탐이 날 수 있어 경고로만 쓴다.
 */
export function detectKoreanInEnglishPost(text) {
  const HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
  const out = [];
  let inFence = false;
  let inFront = false;
  let inTags = false;
  text.split(/\r?\n/).forEach((line, i) => {
    if (i === 0 && /^---\s*$/.test(line)) {
      inFront = true;
      return;
    }
    if (inFront) {
      if (/^---\s*$/.test(line)) {
        inFront = false;
        return;
      }
      if (/^tags:/.test(line)) {
        inTags = true;
        return; // 한 줄짜리 `tags: [a, b]` 도 여기서 같이 건너뛴다
      }
      if (inTags && /^\s+-\s|^\s*$/.test(line)) return;
      inTags = false;
    }
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    // 태그 링크는 한국어가 정상이다 — 파이프라인이 tags 를 verbatim 유지하므로
    // EN 글도 `/en/tags/용어정리` 를 가리킨다 (CLAUDE.md 번역 절).
    const visible = line
      .replace(/`[^`]*`/g, "")
      .replace(/\]\((?:\/en)?\/tags\/[^)]*\)/g, "]()");
    if (HANGUL.test(visible)) {
      out.push({ line: i + 1, text: mask(line.trim()).slice(0, 90) });
    }
  });
  return out;
}

/**
 * EN 글이 참조하는 SVG 의 **보이는 텍스트**(<p> · <text>)에 한글이 있는지.
 * id 속성은 보지 않는다 — 서브그래프 id 가 한글인 그림이 실제로 있고,
 * 화면에 안 나오며 바꾸면 엣지 선언과 어긋난다 (설계안 §3).
 */
export async function checkEnDiagramKorean({ enDir, assetDir }) {
  const out = [];
  const HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
  for (const hash of [...(await referencedHashes(enDir)).keys()].sort()) {
    let svg;
    try {
      svg = await fs.readFile(path.join(assetDir, `${hash}.svg`), "utf8");
    } catch (e) {
      if (e.code === "ENOENT") continue; // 파일 자체가 없는 건 링크 검사의 몫
      throw e;
    }
    const texts = [];
    // flowchart 는 라벨을 <p> 로, sequenceDiagram 은 <text> 로 그린다.
    // 둘 다 보지 않으면 시퀀스 그림이 검사에서 통째로 빠진다. id · class 속성은 안 본다.
    for (const m of svg.matchAll(/<(p|text)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
      const t = m[2].replace(/<[^>]*>/g, "").trim();
      if (HANGUL.test(t)) texts.push(t);
    }
    if (texts.length > 0) out.push({ hash, texts });
  }
  return out;
}

/**
 * 참조되는 SVG 마다 다시 렌더할 원본(.mmd)이 있는지.
 * 없으면 당장은 증상이 없지만 다른 기기에서 EN 그림을 다시 만들 재료가 없다.
 * 되살린 원본(restored/)도 인정한다.
 */
export async function checkMermaidSources({ blogDir, mmdDir, restoredDir }) {
  const out = [];
  for (const hash of [...(await referencedHashes(blogDir)).keys()].sort()) {
    const has = async d => {
      try {
        await fs.access(path.join(d, `${hash}.mmd`));
        return true;
      } catch {
        return false;
      }
    };
    if ((await has(mmdDir)) || (await has(restoredDir))) continue;
    out.push({ hash });
  }
  return out;
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

// 시크릿 검사는 .md 만이 아니라 저장소의 추적 파일 전부를 본다. 집 IP 사고가 난 곳은
// deploy/ 의 비-md 파일이었고, 작성자가 터미널 출력을 붙이는 src/000-inbox.md ·
// server/*.py 도 예전 범위 밖이었다. 대신 시크릿이 있을 수 없는 것만 뺀다.
const SECRET_SCAN_EXCLUDE_DIRS = ["node_modules/", "dist/", "public/assets/", "tests/", ".git/"];
// app.js 는 번들러가 만든 파일이라 한 줄에 수백 자 hex 표가 들어 있다 (CLAUDE.md: 생성 파일).
const SECRET_SCAN_EXCLUDE_FILES = ["pnpm-lock.yaml", "server/scratch-ui/app.js"];
const BINARY_EXT = /\.(svg|png|jpe?g|webp|gif|ico|mp4|webm|woff2?|ttf|otf|pdf|zip)$/i;

export function isSecretScanTarget(rel) {
  const p = rel.replaceAll("\\", "/");
  if (SECRET_SCAN_EXCLUDE_DIRS.some(d => p.startsWith(d) || p.includes("/" + d))) return false;
  if (SECRET_SCAN_EXCLUDE_FILES.includes(p) || p === "pnpm-lock.yaml") return false;
  return !BINARY_EXT.test(p);
}

// 아직 add 하지 않은 새 파일도 포함한다 (커밋 직전에 돌릴 검사라서).
function trackedFiles() {
  const out = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  return [...new Set(out.split("\0").filter(Boolean))]
    .filter(isSecretScanTarget)
    .map(f => path.join(REPO_ROOT, f));
}

async function walkAny(target) {
  const stat = await fs.stat(target);
  if (stat.isFile()) return [target];
  const files = [];
  for (const e of await fs.readdir(target, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const p = path.join(target, e.name);
    if (e.isDirectory()) files.push(...(await walkAny(p)));
    else if (e.isFile() && !BINARY_EXT.test(p)) files.push(p);
  }
  return files;
}

async function main() {
  // 경로를 인자로 받는다 (여러 개 가능) — 2단계에서 훅이 스테이지된 파일 목록을 넘긴다.
  const argPaths = process.argv.slice(2).map(a => path.resolve(a));
  const targets = argPaths.length > 0
    ? argPaths
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
  const filesWithSecrets = [];
  const secretWarnings = [];

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

  // 시크릿은 기존 검사보다 넓은 범위(추적 파일 전부)로 따로 돈다.
  let secretFiles = [];
  if (argPaths.length > 0) {
    for (const t of argPaths) {
      try {
        secretFiles.push(...(await walkAny(t)));
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
    }
  } else {
    secretFiles = trackedFiles();
  }
  for (const file of secretFiles) {
    let content;
    try {
      content = await fs.readFile(file, "utf8");
    } catch (e) {
      if (e.code === "ENOENT") continue; // 지웠지만 아직 추적 중인 파일
      throw e;
    }
    if (content.includes("\0")) continue; // 확장자가 없는 바이너리
    const secrets = detectSecrets(content);
    const hard = secrets.filter(x => x.blocking);
    if (hard.length > 0) filesWithSecrets.push({ file, secrets: hard });
    const soft = secrets.filter(x => !x.blocking);
    if (soft.length > 0) secretWarnings.push({ file, secrets: soft });
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

  if (filesWithSecrets.length > 0) {
    console.log(`\n🔴 시크릿으로 보이는 값:`);
    for (const { file, secrets } of filesWithSecrets) {
      console.log(`  ${relPath(file)}`);
      for (const f of secrets) console.log(`    L${f.line}: [${f.kind}] ${f.matched}`);
    }
    console.log(
      "  → 발행을 멈추세요. 이미 push 했다면 마스킹보다 키 재발급이 먼저입니다.\n"
    );
  }

  if (secretWarnings.length > 0) {
    console.log(`\n⚠️  시크릿일 수도 있는 값 (경고 — 확인만 하세요):`);
    for (const { file, secrets } of secretWarnings) {
      for (const f of secrets) {
        console.log(`  ${relPath(file)} L${f.line}: [${f.kind}] ${f.matched}`);
      }
    }
    console.log("");
  }

  // 번역 축 검사는 저장소 전체를 볼 때만 의미가 있다 (경로 하나만 넘기면 건너뛴다).
  let pairFail = false;
  if (argPaths.length === 0) {
    const blogDir = path.join(REPO_ROOT, "src/data/blog");
    const koDir = path.join(blogDir, "ko");
    const enDir = path.join(blogDir, "en");

    const { missing, orphans } = await checkTranslationPairs({ koDir, enDir });
    if (missing.length > 0 || orphans.length > 0) {
      pairFail = true;
      console.log(`\n🔴 KO/EN 짝이 맞지 않는다:`);
      for (const s of missing) console.log(`  EN 없음: ${s}`);
      for (const s of orphans) console.log(`  KO 없음 (EN 만 있음): ${s}`);
      console.log("  → KO 만 커밋하면 언어 스위치가 홈으로 fallback 된다.\n");
    }

    // 같은 날 커밋은 순서 차이일 뿐이라 경고에서 뺀다.
    const diverged = (await checkDivergence({ koDir, enDir })).filter(d => d.days >= 1);
    if (diverged.length > 0) {
      console.log(`\n⚠️  KO 가 EN 보다 나중에 고쳐졌다 (경고):`);
      for (const d of diverged) {
        console.log(`  ${d.slug} — ${d.days}일 앞섬 → pnpm translate one ${d.slug}`);
      }
      console.log("");
    }

    const koreanInEn = [];
    for (const f of await listMd(enDir)) {
      const hits = detectKoreanInEnglishPost(await fs.readFile(path.join(enDir, f), "utf8"));
      if (hits.length > 0) koreanInEn.push({ slug: slugOf(f), hits });
    }
    if (koreanInEn.length > 0) {
      console.log(`\n⚠️  EN 글 본문에 한글이 남아 있다 (경고 — 고유명사일 수 있다):`);
      for (const { slug, hits } of koreanInEn) {
        console.log(`  ${slug} — L${hits.slice(0, 5).map(h => h.line).join(", L")}${hits.length > 5 ? ` 외 ${hits.length - 5}곳` : ""}`);
      }
      console.log("");
    }

    const enKorean = await checkEnDiagramKorean({
      enDir,
      assetDir: path.join(REPO_ROOT, "public/assets/mermaid"),
    });
    if (enKorean.length > 0) {
      console.log(`\n⚠️  EN 글이 참조하는 그림에 한글이 남아 있다 (경고):`);
      for (const { hash, texts } of enKorean) {
        console.log(`  ${hash}.svg — ${texts.slice(0, 3).join(" / ")}`);
      }
      console.log("");
    }

    const noSource = await checkMermaidSources({
      blogDir,
      mmdDir: path.join(REPO_ROOT, "src/data/mermaid"),
      restoredDir: path.join(REPO_ROOT, "src/data/mermaid/restored"),
    });
    if (noSource.length > 0) {
      console.log(`\n⚠️  원본(.mmd)이 없는 그림 (경고 — 다시 렌더할 수 없다):`);
      for (const { hash } of noSource) console.log(`  ${hash}.svg`);
      console.log("");
    }
  }

  const hardFail =
    filesWithMermaid.length > 0 ||
    filesWithIp.length > 0 ||
    filesWithSecrets.length > 0 ||
    pairFail;
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

// 직접 실행일 때만 스캔한다. 테스트(tests/check-markdown.test.mjs)가 위
// 탐지 함수를 import 하므로, 가드가 없으면 import 만으로 전체 스캔이 돌고
// 결과에 따라 process.exit 까지 한다.
const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch(err => {
    console.error(err);
    process.exit(2);
  });
}
