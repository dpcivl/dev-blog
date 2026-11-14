// PostToolUse / Write·Edit — 방금 쓴 파일에서 비밀값을 찾는다.
//
// 왜 커밋 훅으로 부족한가:
// pre-commit 은 커밋할 때 잡는다. 그 사이에 글이 길어지고 맥락이 흐려진다.
// 여기서 잡으면 **쓴 직후, 그 줄이 아직 눈앞에 있을 때** 알 수 있다.
//
// 막지 않는다 — 알리기만 한다. 글을 쓰는 중에 차단이 끼어들면 작업이 끊기고,
// 커밋 훅과 CI 가 뒤에서 같은 것을 다시 본다.

import { readFileSync } from "node:fs";
import path from "node:path";
import { scanLine } from "../secret-patterns.mjs";
import { isSecretScanTarget } from "../check-markdown.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");

export function scanFile(absPath, read = p => readFileSync(p, "utf8")) {
  const rel = path.relative(ROOT, absPath).replaceAll("\\", "/");
  // 저장소 밖이거나 검사 대상이 아니면 보지 않는다.
  if (rel.startsWith("..") || !isSecretScanTarget(rel)) return [];

  let content;
  try {
    content = read(absPath);
  } catch {
    return [];
  }
  if (content.includes("\0")) return [];

  const hits = [];
  content.split(/\r?\n/).forEach((text, i) => {
    for (const h of scanLine(text)) {
      hits.push({
        file: rel,
        line: i + 1,
        kind: h.kind,
        blocking: h.blocking,
        masked: h.value.slice(0, 4) + `…(${h.value.length}자)`,
      });
    }
  });
  return hits;
}

function main() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    process.exit(0);
  }
  const file = payload?.tool_response?.filePath || payload?.tool_input?.file_path;
  if (!file) process.exit(0);

  const hits = scanFile(path.resolve(file));
  if (!hits.length) process.exit(0);

  const blocking = hits.filter(h => h.blocking);
  const lines = (blocking.length ? blocking : hits)
    .slice(0, 5)
    .map(h => `  ${h.file}:${h.line} [${h.kind}] ${h.masked}`)
    .join("\n");

  process.stdout.write(
    JSON.stringify({
      systemMessage:
        (blocking.length ? "🔴 방금 쓴 파일에 비밀값으로 보이는 값이 있습니다" : "⚠️ 방금 쓴 파일에서 확인할 값") +
        `\n${lines}` +
        (blocking.length ? "\n  → 커밋 전에 지우세요. pre-commit 이 막습니다." : ""),
      suppressOutput: true,
    })
  );
  process.exit(0);
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith("scan-written.mjs");
if (invokedDirectly) main();
