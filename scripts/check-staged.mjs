// 커밋 직전, **스테이지된 내용**에서 비밀값을 찾는다. pre-commit 훅이 부른다.
//
// 왜 작업 트리가 아니라 스테이지인가 (2026-11-14 보안 점검 S-5):
// `git add <시크릿 든 파일>` → 편집으로 그 줄을 지움 → `git commit` 하면,
// 작업 트리를 보는 검사는 통과하지만 **커밋에는 시크릿이 남는다.**
//
// 왜 diff 를 파싱하지 않는가 (2026-11-14 2차 보안 점검):
// 처음에는 `git diff --cached` 의 `+` 줄만 봤다. 세 가지로 뚫렸고 전부 재현됐다.
//   1. 본문이 `++…` 로 시작하면 diff 에서 `+++…` 가 되어 헤더로 오인돼 버려졌다.
//      글에 diff 를 인용하면 자연히 생긴다 — 고의가 아니어도 밟는다
//   2. `--diff-filter=ACM` 이 rename 을 버려, `git mv` 와 수정을 한 커밋에 담으면
//      0줄을 봤다. CLAUDE.md 6번이 지시하는 정규 작업이다
//   3. `.gitattributes` 에 `*.md -diff` 한 줄이면 diff 가 통째로 비어 영구히 꺼졌다
// 그래서 diff 를 믿지 않고 **스테이지에 들어간 파일 내용(blob)을 직접 읽는다.**
// 세 경로가 한꺼번에 막힌다.

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanLine, mask } from "./secret-patterns.mjs";
import { isSecretScanTarget } from "./check-markdown.mjs";

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
}

/**
 * 스테이지에 올라간 경로들. rename 도 포함된다 (`-z` 라 파일명에 개행이 있어도 안전).
 * @returns {string[]}
 */
export function stagedPaths() {
  const out = git(["diff", "--cached", "--name-only", "-z", "--no-renames"]);
  return out.split("\0").filter(Boolean);
}

/** 스테이지에 있는 그 경로의 내용. 삭제됐으면 null. */
export function stagedContent(file) {
  try {
    return git(["show", `:${file}`]);
  } catch {
    return null; // 삭제된 경로
  }
}

/**
 * @returns {{blocking: Array, warning: Array, scanned: number, skipped: string[]}}
 */
export function scanStagedFiles(files, read = stagedContent) {
  const blocking = [];
  const warning = [];
  const skipped = [];
  let scanned = 0;

  for (const file of files) {
    if (!isSecretScanTarget(file)) {
      skipped.push(file);
      continue;
    }
    const content = read(file);
    if (content === null) {
      skipped.push(file);
      continue;
    }
    if (content.includes("\0")) {
      skipped.push(file); // 바이너리
      continue;
    }
    scanned++;
    content.split(/\r?\n/).forEach((text, i) => {
      for (const hit of scanLine(text)) {
        const row = {
          file,
          line: i + 1,
          kind: hit.kind,
          // 값은 절대 그대로 담지 않는다 — 이 결과가 터미널과 CI 로그에 찍힌다.
          masked: hit.value.slice(0, 4) + `…(${hit.value.length}자)`,
          // 줄 전체가 아니라 걸린 자리 주변만. 줄 전체를 담으면 같은 줄의
          // 다른 비밀값이 평문으로 샌다 (2차 점검 S-8: AWS 시크릿은 40자
          // 영숫자라 mask() 의 어떤 규칙에도 안 걸린다).
          context: mask(text.slice(Math.max(0, hit.index - 12), hit.index + hit.value.length + 12)).trim(),
        };
        (hit.blocking ? blocking : warning).push(row);
      }
    });
  }
  return { blocking, warning, scanned, skipped };
}

function main() {
  let files;
  try {
    files = stagedPaths();
  } catch (err) {
    // 스테이지를 못 읽으면 막는다. 검사를 못 돌린 채 통과시키지 않는다.
    console.error("🔴 스테이지 목록을 읽지 못해 커밋을 멈춥니다:", err.message);
    process.exit(1);
  }
  if (!files.length) process.exit(0);

  let result;
  try {
    result = scanStagedFiles(files);
  } catch (err) {
    console.error("🔴 스테이지 내용을 읽지 못해 커밋을 멈춥니다:", err.message);
    process.exit(1);
  }

  const { blocking, warning } = result;

  if (warning.length) {
    console.log("\n⚠️  확인해보세요 (커밋은 막지 않습니다):");
    for (const w of warning.slice(0, 20)) {
      console.log(`  ${w.file}:${w.line}  [${w.kind}] ${w.masked}`);
    }
    if (warning.length > 20) console.log(`  … 외 ${warning.length - 20}건`);
  }

  if (blocking.length) {
    console.log("\n🔴 커밋하려는 내용에 비밀값으로 보이는 것이 있습니다:");
    for (const b of blocking.slice(0, 20)) {
      console.log(`  ${b.file}:${b.line}  [${b.kind}] ${b.masked}`);
      console.log(`      …${b.context}…`);
    }
    if (blocking.length > 20) console.log(`  … 외 ${blocking.length - 20}건`);
    console.log("\n  → 그 줄을 지우고 다시 커밋하세요.");
    console.log("  → 이미 push 한 값이라면 마스킹보다 키 재발급이 먼저입니다.");
    console.log("  → 오탐이라면 scripts/secret-patterns.mjs 의 규칙을 좁히세요.");
    console.log("     (git commit --no-verify 로 넘길 수 있지만, CI 가 push 뒤에");
    console.log("      같은 검사를 다시 돌립니다.)\n");
    process.exit(1);
  }

  process.exit(0);
}

// check-markdown.mjs 와 같은 방식으로 판정한다. `new URL("file://"+argv[1])` 은
// 경로에 `#` 나 `%` 가 있으면 깨져서 main() 이 조용히 안 돌았다 (2차 점검 S-7).
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
