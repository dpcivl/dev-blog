// 시크릿 패턴과 마스킹 — 검사가 출력하는 모든 곳이 이 파일을 거친다.
//
// 왜 한 파일인가: 처음에는 detectSecrets 만 값을 가렸고, 공인 IP 검사의
// snippet 은 줄을 평문으로 찍었다. IP 와 AWS 키가 한 줄에 있으면 키가 그대로
// 출력됐다. 검사 출력이 곧 유출 경로가 되면 검사를 넣은 의미가 없다.
// 그래서 "무엇을 시크릿으로 보나" 와 "출력할 때 어떻게 가리나" 를 같은 규칙표
// 하나에서 만든다. 출력하는 쪽은 mask() 만 부르면 된다.

// 예시·마스킹 결과물은 시크릿이 아니다. CLAUDE.md 가 `REDACTED_*` 마스킹을
// 지시하는데, 그 결과물이 발행을 막으면 지시와 검사가 충돌한다.
const PLACEHOLDER = /REDACTED|xxxx|…|your_key|EXAMPLE/i;

// 낱말 속 우연한 일치(`risk-`, `disk-`)만 거르고 `TOKEN_ghp_…` 같은 접두는 통과시킨다.
const B = "(?<![0-9A-Za-z])";

export const SECRET_RULES = [
  {
    kind: "private-key",
    blocking: true,
    re: /-----BEGIN (?:OPENSSH |RSA |EC |DSA |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/g,
  },
  {
    kind: "prefix",
    blocking: true,
    // 이름이 특이하고 뒤에 긴 본문이 따라와야 하는 것은 앞 글자와 상관없이 잡는다
    // (`xsk-ant-…` 로 우회하는 경우). 짧은 접두사(AKIA · AIza · xox)만 낱말 속
    // 우연한 일치를 거른다.
    re: new RegExp(
      "sk-ant-[A-Za-z0-9_-]{16,}|sk-proj-[A-Za-z0-9_-]{16,}|" +
        // 구버전 OpenAI 키: sk- 뒤가 하이픈 없는 영숫자다. 하이픈이 섞인
        // `sk-learn-tutorial-…` 같은 URL 경로와 이 조건으로 갈린다.
        "sk-[A-Za-z0-9]{32,}|" +
        "gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|" +
        B +
        "(?:sk_(?:live|test)_[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|xox[baprs]-[A-Za-z0-9-]{10,})",
      "g"
    ),
  },
  {
    kind: "jwt",
    blocking: true,
    re: new RegExp(B + "eyJ[A-Za-z0-9_-]{5,}\\.[A-Za-z0-9_-]{5,}(?:\\.[A-Za-z0-9_-]*)?", "g"),
  },
  {
    kind: "credential-url",
    blocking: true,
    // 주소에 아이디:비밀번호가 박힌 형태. 비밀번호 칸이 비었거나 `<…>` 자리표시자면 걸리지 않는다.
    re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@<>]+:[^\s/@<>]+@[^\s/<>]+/gi,
    // 문서 예시로 흔한 비밀번호 낱말은 실제 값이 아니다.
    skip: m => /:(?:pass|password|passwd|pwd|secret|\*+)@/i.test(m),
    // 호스트가 example 인 것까지 자리표시자로 치면 안 된다 — 아이디:비밀번호 부분만 본다.
    placeholderOf: m => m.slice(m.indexOf("://") + 3, m.lastIndexOf("@")),
  },
  {
    kind: "hex32",
    blocking: false,
    // `@` 바로 뒤의 hex 는 GitHub Action 을 커밋 SHA 로 고정한 표기(`uses: x/y@<sha>`)다.
    re: /(?<![0-9A-Za-z@])[0-9a-fA-F]{32,}(?![0-9A-Za-z])/g,
    // 커밋 해시를 적는 줄은 정상이다. 길이로 거르면(40자) 레거시 토큰까지
    // 꺼지므로 같은 줄의 낱말로 판단한다.
    skipLine: line => /commit|sha|git|sourceMappingURL/i.test(line),
  },
  {
    kind: "base64",
    blocking: false,
    re: /(?<![A-Za-z0-9+/=])[A-Za-z0-9+/]{20,}={1,2}(?![A-Za-z0-9+/=])/g,
    // 글자만으로 된 낱말(`CapabilityBoundingSet=`)은 설정 키이지 base64 가 아니다.
    skip: m => !/[0-9+/]/.test(m) || !/[A-Za-z]/.test(m),
  },
  {
    kind: "instance-domain",
    blocking: false,
    re: /\b[A-Za-z0-9-]+\.(?:supabase\.co|vercel\.app)\b/g,
  },
];

// `ghp%5F…` 처럼 퍼센트 인코딩으로 우회하는 경우를 같은 규칙으로 잡는다.
const normalize = line => line.replace(/%5F/gi, "_").replace(/%2D/gi, "-");

// 매치가 `<…>` 로 바로 감싸인 자리표시자인가. 같은 줄에 `<` · `>` 가 어디든 있으면
// 건너뛰는 식으로 느슨하게 보면 HTML 태그 속 진짜 키까지 통과한다.
function insideAngle(line, index, len) {
  return line[index - 1] === "<" && line[index + len] === ">";
}

function isPlaceholder(line, m, rule) {
  const target = rule.placeholderOf ? rule.placeholderOf(m[0]) : m[0];
  return PLACEHOLDER.test(target) || insideAngle(line, m.index, m[0].length);
}

/** 한 줄에서 시크릿 후보를 모두 돌려준다. */
export function scanLine(rawLine) {
  const line = normalize(rawLine);
  const found = [];
  for (const rule of SECRET_RULES) {
    if (rule.skipLine?.(line)) continue;
    for (const m of line.matchAll(rule.re)) {
      if (rule.skip?.(m[0])) continue;
      if (isPlaceholder(line, m, rule)) continue;
      found.push({ kind: rule.kind, blocking: rule.blocking, value: m[0], index: m.index });
    }
  }
  return found;
}

/**
 * 출력용 마스킹. 줄 안의 시크릿 후보를 앞 4자 + `…` 로 바꾼다.
 * 자르기(slice)보다 먼저 불러야 한다 — 먼저 자르면 반쯤 남은 키가 패턴에 안 걸린다.
 */
export function mask(text) {
  let out = text.split("\n").map(rawLine => {
    let line = normalize(rawLine);
    // 뒤에서부터 바꿔야 앞 인덱스가 어긋나지 않는다.
    const hits = scanLine(rawLine).sort((a, b) => b.index - a.index);
    for (const h of hits) {
      line = line.slice(0, h.index) + h.value.slice(0, 4) + "…" + line.slice(h.index + h.value.length);
    }
    return line;
  });
  return out.join("\n");
}
