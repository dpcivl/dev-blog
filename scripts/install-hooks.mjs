// git 훅을 이 저장소에 건다. package.json 의 `prepare` 가 부른다
// (= `pnpm install` 뒤 자동).
//
// 왜 셸 한 줄이 아닌가:
// `git config core.hooksPath .githooks || true` 로 쓰면 Windows 의 cmd.exe 가
// `true` 라는 명령을 찾는다. git config 가 실패하는 바로 그 상황에서 prepare 가
// 의도와 다르게 깨진다 (2026-11-14 보안 점검 S-6 부작용).
//
// 알아둘 것 (같은 점검의 지적):
// `.git/hooks` 는 클론에 실리지 않는다 — 클론이 곧 코드 실행이 되지 않게 하려는
// git 의 설계다. 저장소 안 폴더를 가리키는 `core.hooksPath` 는 그 성질을 되돌린다.
// 즉 **저장소에 들어온 내용이 이 기기에서 실행될 수 있다**. 1인 저장소라 지금
// 위험은 낮지만, 「GitHub 계정이 뚫리면 무엇이 되나」의 답에 로컬 코드 실행이
// 더해진 것은 사실이다. 그래서 `.githooks/*` 는 얇게 유지하고 실제 검사는
// `scripts/` 에 둔다.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WANT = ".githooks";

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function main() {
  // git 저장소가 아니면 조용히 넘어간다 (tarball 설치 등).
  try {
    git(["rev-parse", "--git-dir"]);
  } catch {
    return;
  }
  if (!existsSync(path.join(ROOT, WANT))) return;

  let current = "";
  try {
    current = git(["config", "--local", "core.hooksPath"]);
  } catch {
    /* 미설정 */
  }
  if (current === WANT) return;

  if (current) {
    console.log(`훅 경로를 ${current} → ${WANT} 로 바꿉니다.`);
  }
  try {
    // --local 로 못박는다. 전역 설정을 건드리지 않기 위해서다.
    git(["config", "--local", "core.hooksPath", WANT]);
    console.log(`✓ git 훅을 걸었습니다 (${WANT}). 끄려면 git config --unset core.hooksPath`);
  } catch (err) {
    // 훅을 못 걸었다고 설치를 실패시키지 않는다. 대신 조용히 넘어가지도 않는다.
    console.warn(`⚠ git 훅을 걸지 못했습니다: ${err.message}`);
    console.warn(`  직접 거세요: git config core.hooksPath ${WANT}`);
  }
}

main();
