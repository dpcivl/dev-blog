// SessionStart — 두 저장소 상태와 준비된 메모를 세션에 알린다.
//
// CLAUDE.md 의 「세션 시작 루틴」은 main 과 src/scratch 를 pull 하고 준비된
// 메모를 찾으라고 한다. 지금은 세션이 기억해서 하는 일이다.
//
// **여기서 pull 을 대신 돌리지 않는다.** 그 루틴은 dirty 면 stash → pull →
// stash pop 이고 충돌하면 사람에게 물어야 한다. 훅은 그 판단을 할 수 없고,
// 세션이 시작하기도 전에 작업 트리를 건드리는 것은 위험하다.
// 상태만 읽어서 알리고, 무엇을 할지는 세션이 정한다.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");

function git(args, cwd = ROOT) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    }).trim();
  } catch {
    return null;
  }
}

function repoState(cwd, label) {
  if (!existsSync(path.join(cwd, ".git"))) return null;
  const dirty = git(["status", "--porcelain"], cwd);
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  // fetch 하지 않는다 (네트워크·시간). 마지막으로 받아둔 것과만 비교한다.
  const counts = git(["rev-list", "--left-right", "--count", "@{upstream}...HEAD"], cwd);
  const [behind, ahead] = (counts || "0\t0").split(/\s+/).map(Number);
  return {
    label,
    branch,
    dirty: dirty ? dirty.split("\n").filter(Boolean).length : 0,
    behind: behind || 0,
    ahead: ahead || 0,
  };
}

/** 첫 줄이 「준비됨」인 메모, 그리고 웹 에디터가 만든 원고 */
function scratchWork() {
  const dir = path.join(ROOT, "src", "scratch");
  const ready = [];
  const drafts = [];
  try {
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".md")) continue;
      const first = readFileSync(path.join(dir, f), "utf8").split("\n", 1)[0] ?? "";
      if (/^<!--\s*✅\s*준비됨/.test(first)) ready.push(f);
    }
  } catch {
    /* scratch 가 없는 기기 */
  }
  try {
    for (const f of readdirSync(path.join(dir, "posts"))) {
      if (f.endsWith(".md")) drafts.push(`posts/${f}`);
    }
  } catch {
    /* posts/ 없음 */
  }
  return { ready, drafts };
}

function main() {
  const rows = [repoState(ROOT, "main"), repoState(path.join(ROOT, "src", "scratch"), "scratch")].filter(Boolean);
  const { ready, drafts } = scratchWork();

  const parts = rows.map(r => {
    const bits = [];
    if (r.behind) bits.push(`${r.behind} behind`);
    if (r.ahead) bits.push(`${r.ahead} ahead`);
    if (r.dirty) bits.push(`미커밋 ${r.dirty}`);
    return `${r.label}: ${bits.length ? bits.join(" · ") : "깨끗"}`;
  });
  if (ready.length) parts.push(`준비됨 ${ready.length}개: ${ready.join(", ")}`);
  if (drafts.length) parts.push(`원고 ${drafts.length}개: ${drafts.join(", ")}`);

  const context = [
    `[세션 시작 상태 — 훅이 읽은 것, pull 은 하지 않았다]`,
    parts.map(p => `  ${p}`).join("\n"),
    ``,
    `ahead/behind 는 마지막으로 fetch 해둔 것 기준이다. CLAUDE.md 의 세션 시작`,
    `루틴(pull · 준비된 메모 확인)은 그대로 수행한다 — 이 알림이 그것을 대신하지 않는다.`,
  ].join("\n");

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context },
      suppressOutput: true,
    })
  );
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith("session-start.mjs");
if (invokedDirectly) main();
