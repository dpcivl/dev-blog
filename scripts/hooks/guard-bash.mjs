// PreToolUse / Bash — 비밀 파일을 건드리는 명령을 막는다.
//
// 왜 권한 목록으로 안 되는가 (2026-11-14, 하네스 3단계):
// `.claude/settings.json` 의 Bash 규칙은 **명령 문자열의 앞부분만** 본다.
//   Read(.env) 차단 → Read 도구만 막는다. `cat .env` 는 못 막는다
//   Bash(rm -rf *)  → `rm -r -f` 는 안 걸린다
//   무엇으로 감싸든 (`sh -c '…'`, `$(…)`) 앞부분이 달라진다
// 여기서는 명령 **전체**를 보고 판단한다.
//
// 판단은 보수적으로 한다. 오탐으로 막히면 작업이 멈추고, 그러면 사람이
// 훅을 꺼버린다 — 하네스가 가장 흔하게 죽는 길이다.

import { readFileSync } from "node:fs";

// 이름만으로 비밀이라고 볼 수 있는 것들. 예시 파일은 뺀다.
const SECRET_PATH = [
  { re: /(^|[\s"'=/])\.env(\.[A-Za-z0-9_-]+)?(?![A-Za-z0-9_.-])/, what: ".env" },
  { re: /\bid_(rsa|ed25519|ecdsa|dsa)\b(?!\.pub)/, what: "SSH 개인키" },
  { re: /\.(pem|p12|pfx|keystore|jks)\b/, what: "인증서·키 파일" },
  { re: /\bdeploy\/[^\s"']*(key|secret|credential)[^\s"']*/i, what: "배포 키" },
  { re: /\bid_rsa\b|\bauthorized_keys\b/, what: "SSH 자격 파일" },
];

// 예시·템플릿은 비밀이 아니다.
const EXAMPLE = /\.env\.(example|sample|template|dist)\b/;

// 로그 읽기 전용 키 (2026-11-14~). 서버의 `logsro` 계정에만 등록돼 있고 그 계정은
// sudo 가 없고 adm 그룹으로 로그만 읽는다. 세션이 통계 진단을 직접 하려고 만들었다.
//
// 허용하는 건 딱 한 모양 — 명령이 이 키로 logsro 에 ssh 하는 것으로 시작하고,
// 키 이름이 그 자리에 한 번만 나올 때. `cat` 으로 키를 읽거나 다른 계정에 쓰는
// 것은 막는다. 운영 키(*.pem)는 여전히 위 규칙에 걸린다.
const RO_KEY_MENTION = /parkhyo-logs-ro(?!\.pub)/g;
const RO_KEY_USE = /^\s*ssh\s+-i\s+~\/\.ssh\/parkhyo-logs-ro\s+logsro@parkhyo\.in(\s|$)/;

export function judge(command) {
  if (typeof command !== "string" || !command.trim()) return null;

  // 예시 파일만 건드리는 명령은 통과. (.env.example 은 저장소에 있다)
  let stripped = command.replace(new RegExp(EXAMPLE.source, "g"), "");

  const roMentions = stripped.match(RO_KEY_MENTION) || [];
  if (roMentions.length === 1 && RO_KEY_USE.test(stripped)) {
    stripped = stripped.replace(RO_KEY_MENTION, "");
  } else if (roMentions.length > 0) {
    return {
      what: "로그 읽기 전용 키",
      matched: "parkhyo-logs-ro",
      reason:
        `로그 읽기 전용 키는 \`ssh -i ~/.ssh/parkhyo-logs-ro logsro@parkhyo.in …\` ` +
        `모양으로만 쓸 수 있습니다. 키 파일을 읽거나 다른 계정에 쓰는 명령은 막습니다.`,
    };
  }

  for (const { re, what } of SECRET_PATH) {
    const m = stripped.match(re);
    if (!m) continue;
    return {
      what,
      matched: m[0].trim().slice(0, 40),
      reason:
        `명령이 ${what} 를 건드립니다. 이 저장소는 공개 GitHub + 공개 배포라 ` +
        `한 번 나간 값은 회수가 안 됩니다.\n` +
        `  · 값이 필요하면 작성자에게 직접 물어보세요\n` +
        `  · 예시가 필요하면 .env.example 을 쓰세요\n` +
        `  · 꼭 읽어야 하면 작성자가 직접 터미널에서 확인합니다`,
    };
  }
  return null;
}

function main() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    process.exit(0); // 입력을 못 읽으면 판단하지 않는다 (막지도 않는다)
  }
  const verdict = judge(payload?.tool_input?.command);
  if (!verdict) process.exit(0);

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: verdict.reason,
      },
      systemMessage: `🔒 비밀 파일 접근을 막았습니다 (${verdict.what})`,
    })
  );
  process.exit(0);
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith("guard-bash.mjs");
if (invokedDirectly) main();
