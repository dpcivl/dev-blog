import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  detectSecrets,
  detectKoreanInEnglishPost,
  checkTranslationPairs,
  checkDivergence,
  checkEnDiagramKorean,
  checkMermaidSources,
} from "../scripts/check-markdown.mjs";

// 하네스 설계안 1단계 「검사 확장」. 지침(CLAUDE.md 보안 스크러빙)에만 있던 패턴과
// 번역 축 검사를 코드로 옮긴 것이다. 지침만 있으면 세션이 바뀔 때 잊는다 —
// 2026-09-06 공인 IP 유출이 그렇게 났다.
//
// 아래 키 모양 문자열은 전부 가짜다. 이 파일은 tests/ 에 있어 check:md 대상이
// 아니고, 실제 키 형식만 흉내 낸 값이라 어떤 서비스에도 통하지 않는다.

// 조립해서 쓴다 — 저장소 전체를 grep 하는 시크릿 스캐너가 이 파일을 오탐하지 않게.
const A = "abcdefghijklmnopqrstuvwxyz0123456789";

describe("detectSecrets — 알려진 키 접두사 (차단)", () => {
  const cases = [
    ["sk-", "sk-" + A.slice(0, 40)],
    ["sk_live_", "sk_live_" + A.slice(0, 24)],
    ["sk_test_", "sk_test_" + A.slice(0, 24)],
    ["ghp_", "ghp_" + A.slice(0, 36)],
    ["gho_", "gho_" + A.slice(0, 36)],
    ["github_pat_", "github_pat_" + A.slice(0, 30)],
  ];

  for (const [name, secret] of cases) {
    it(`${name} 키를 잡고 blocking 으로 표시한다`, async () => {
      const found = detectSecrets(`키는 ${secret} 이다`);
      const hit = found.find((f) => f.kind === "prefix");
      expect(hit, name).toBeTruthy();
      expect(hit.blocking).toBe(true);
      expect(hit.line).toBe(1);
    });
  }

  it("코드 블록 안에 든 키도 잡는다", async () => {
    // 에러 로그 · 명령 출력에 섞이는 게 가장 흔한 유출 경로다
    const text = ["```bash", `export KEY=${"ghp_" + A.slice(0, 36)}`, "```"].join("\n");
    expect(detectSecrets(text).some((f) => f.kind === "prefix" && f.blocking)).toBe(true);
  });

  it("줄번호를 원문 기준으로 센다", async () => {
    const text = ["첫 줄", "", `셋째 줄 ${"sk-" + A.slice(0, 40)}`].join("\n");
    expect(detectSecrets(text)[0].line).toBe(3);
  });
});

describe("detectSecrets — JWT (차단)", () => {
  const jwt =
    "eyJhbGciOiJIUzI1NiJ9" + "." + "eyJzdWIiOiJ0ZXN0In0" + "." + "c2lnbmF0dXJlYWJjZGVm";

  it("eyJ 로 시작하는 JWT 를 잡고 blocking 으로 표시한다", async () => {
    const found = detectSecrets(`Authorization: Bearer ${jwt}`);
    const hit = found.find((f) => f.kind === "jwt");
    expect(hit).toBeTruthy();
    expect(hit.blocking).toBe(true);
  });
});

describe("detectSecrets — 경고만 하는 것", () => {
  it("32자리 이상 hex 를 잡되 blocking 이 아니다", async () => {
    const hex = "0123456789abcdef".repeat(2); // 32자
    const found = detectSecrets(`해시는 ${hex} 였다`);
    const hit = found.find((f) => f.kind === "hex32");
    expect(hit).toBeTruthy();
    expect(hit.blocking).toBe(false);
  });

  it("64자리 hex(sha256) 도 잡는다", async () => {
    const hex = "0123456789abcdef".repeat(4);
    expect(detectSecrets(hex).some((f) => f.kind === "hex32")).toBe(true);
  });

  it("*.supabase.co 를 잡되 blocking 이 아니다", async () => {
    const found = detectSecrets("주소는 https://abcdefghij.supabase.co/auth/v1/token 이다");
    const hit = found.find((f) => f.kind === "instance-domain");
    expect(hit).toBeTruthy();
    expect(hit.blocking).toBe(false);
  });

  it("*.vercel.app 를 잡되 blocking 이 아니다", async () => {
    const found = detectSecrets("배포본은 my-blog-abc123.vercel.app 에 있었다");
    const hit = found.find((f) => f.kind === "instance-domain");
    expect(hit).toBeTruthy();
    expect(hit.blocking).toBe(false);
  });

  it("20자 이상 base64 (= padding 포함) 를 잡되 blocking 이 아니다", async () => {
    const found = detectSecrets("값은 QWxhZGRpbjpvcGVuIHNlc2FtZVRlc3Q= 였다");
    const hit = found.find((f) => f.kind === "base64");
    expect(hit).toBeTruthy();
    expect(hit.blocking).toBe(false);
  });
});

describe("detectSecrets — 마스킹", () => {
  // 이 검사가 CI 로그에 키를 다시 흘리면 막으려던 일을 직접 하는 셈이다.
  it("matched 에 원래 값 전체가 들어 있지 않다", async () => {
    const secrets = [
      "sk-" + A.slice(0, 40),
      "ghp_" + A.slice(0, 36),
      "github_pat_" + A.slice(0, 30),
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2lnbmF0dXJlYWJjZGVm",
      "0123456789abcdef".repeat(2),
    ];
    for (const s of secrets) {
      const found = detectSecrets(`값 ${s} 끝`);
      expect(found.length, s).toBeGreaterThan(0);
      for (const f of found) {
        expect(f.matched.includes(s), s).toBe(false);
        // 뒷부분이 새지 않았는지도 본다
        expect(f.matched.includes(s.slice(-10)), s).toBe(false);
      }
    }
  });

  // 차단·경고 모두 앞 4자 + 길이로 통일했다. 6자는 hex 를 24비트 드러낸다
  // (2026-11-14 2차 보안 점검 S-9).
  it("matched 는 앞 4자 + 길이 형식이다", async () => {
    const secret = "ghp_" + A.slice(0, 36);
    const [hit] = detectSecrets(secret);
    expect(hit.matched).toBe(`${secret.slice(0, 4)}…(${secret.length}자)`);
  });
});

describe("detectSecrets — 오탐 방지", () => {
  it("평범한 한국어 본문은 통과시킨다", async () => {
    const text = [
      "오늘은 nginx 설정을 고쳤다. 서버는 정적 파일만 서빙한다.",
      "skeleton 이라는 낱말과 task-runner, desk-top 같은 단어가 있다.",
    ].join("\n");
    expect(detectSecrets(text)).toHaveLength(0);
  });

  it("7자리 커밋 해시는 통과시킨다", async () => {
    expect(detectSecrets("커밋 7f666bc 와 1a8be7e 를 봤다")).toHaveLength(0);
  });

  it("sk- 로 시작하지 않는 단어(task-, disk-, risk-)는 통과시킨다", async () => {
    // 접두사 검사가 단어 중간의 `sk-` 에 걸리면 코드 블록 대부분이 막힌다
    const text = ["```bash", "task-runner --disk-usage --risk-level high", "```"].join("\n");
    expect(detectSecrets(text)).toHaveLength(0);
  });

  it("빈 문자열은 빈 배열을 돌려준다", async () => {
    expect(detectSecrets("")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 파일을 만지는 검사들. 임시 디렉토리에서 돈다 — 실제 src/data/blog 를 보지 않는다.

let root;
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "check-md-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function put(file, content = "") {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}
const post = (draft) => `---\ntitle: t\ndraft: ${draft}\n---\n\n본문\n`;

describe("checkTranslationPairs", () => {
  // CLAUDE.md 「자주 하는 실수」 1번 — KO 만 커밋하면 언어 스위치가 홈으로 fallback 된다
  it("짝이 맞으면 빈 배열을 돌려준다", async () => {
    put(path.join(root, "ko/a.md"), post(false));
    put(path.join(root, "en/a.md"), post(false));
    expect(await checkTranslationPairs({ koDir: path.join(root, "ko"), enDir: path.join(root, "en") }))
      .toEqual({ missing: [], orphans: [] });
  });

  it("KO 만 있으면 missing 에 slug 가 든다", async () => {
    put(path.join(root, "ko/a.md"), post(false));
    put(path.join(root, "ko/b.md"), post(false));
    put(path.join(root, "en/a.md"), post(false));
    const r = await checkTranslationPairs({ koDir: path.join(root, "ko"), enDir: path.join(root, "en") });
    expect(r.missing).toEqual(["b"]);
    expect(r.orphans).toEqual([]);
  });

  it("EN 만 있으면 orphans 에 slug 가 든다", async () => {
    put(path.join(root, "ko/a.md"), post(false));
    put(path.join(root, "en/a.md"), post(false));
    put(path.join(root, "en/z.md"), post(false));
    const r = await checkTranslationPairs({ koDir: path.join(root, "ko"), enDir: path.join(root, "en") });
    expect(r.orphans).toEqual(["z"]);
    expect(r.missing).toEqual([]);
  });

  it("draft: true 인 KO 는 EN 이 없어도 missing 에 안 든다", async () => {
    put(path.join(root, "ko/wip.md"), post(true));
    put(path.join(root, "ko/a.md"), post(false));
    put(path.join(root, "en/a.md"), post(false));
    const r = await checkTranslationPairs({ koDir: path.join(root, "ko"), enDir: path.join(root, "en") });
    expect(r.missing).toEqual([]);
  });

  it("draft: false 는 draft 로 취급하지 않는다", async () => {
    put(path.join(root, "ko/pub.md"), post(false));
    mkdirSync(path.join(root, "en"), { recursive: true });
    const r = await checkTranslationPairs({ koDir: path.join(root, "ko"), enDir: path.join(root, "en") });
    expect(r.missing).toEqual(["pub"]);
  });

  it("frontmatter 가 비어 있어도 draft 가 아닌 것으로 본다", async () => {
    // 값이 빈 채로 와도 터지지 않고 발행 대상으로 센다
    put(path.join(root, "ko/bare.md"), "본문만 있다\n");
    mkdirSync(path.join(root, "en"), { recursive: true });
    const r = await checkTranslationPairs({ koDir: path.join(root, "ko"), enDir: path.join(root, "en") });
    expect(r.missing).toEqual(["bare"]);
  });
});

describe("checkDivergence", () => {
  const DAY = 86400;
  const setup = () => {
    put(path.join(root, "ko/a.md"), post(false));
    put(path.join(root, "en/a.md"), post(false));
    return { koDir: path.join(root, "ko"), enDir: path.join(root, "en") };
  };
  // 파일 경로의 언어 폴더로 시각을 정하는 가짜. git 을 부르지 않는다.
  const fake = (ko, en) => (file) => (file.includes(`${path.sep}ko${path.sep}`) ? ko : en);

  it("KO 가 EN 보다 나중에 커밋됐으면 잡고 days 를 계산한다", async () => {
    // blog-beyond-astropaper 가 88일 밀렸던 사고를 흉내 낸다
    const dirs = setup();
    const r = await checkDivergence({ ...dirs, commitTimeOf: fake(1_000_000 + 88 * DAY, 1_000_000) });
    expect(r).toEqual([{ slug: "a", days: 88 }]);
  });

  it("EN 이 더 최신이면 잡지 않는다", async () => {
    const dirs = setup();
    expect(await checkDivergence({ ...dirs, commitTimeOf: fake(1_000_000, 1_000_000 + 5 * DAY) }))
      .toEqual([]);
  });

  it("시각이 같으면 잡지 않는다", async () => {
    // 같은 커밋으로 둘을 함께 올린 보통의 경우다
    const dirs = setup();
    expect(await checkDivergence({ ...dirs, commitTimeOf: fake(1_000_000, 1_000_000) })).toEqual([]);
  });

  it("글마다 따로 계산한다", async () => {
    put(path.join(root, "ko/a.md"), post(false));
    put(path.join(root, "en/a.md"), post(false));
    put(path.join(root, "ko/b.md"), post(false));
    put(path.join(root, "en/b.md"), post(false));
    const times = { a: [1_000_000 + 7 * DAY, 1_000_000], b: [1_000_000, 1_000_000] };
    const commitTimeOf = (file) => {
      const slug = path.basename(file, ".md");
      return file.includes(`${path.sep}ko${path.sep}`) ? times[slug][0] : times[slug][1];
    };
    const r = await checkDivergence({
      koDir: path.join(root, "ko"),
      enDir: path.join(root, "en"),
      commitTimeOf,
    });
    expect(r).toEqual([{ slug: "a", days: 7 }]);
  });

  it("커밋 시각을 못 구하면(null) 터지지 않고 잡지도 않는다", async () => {
    // 아직 커밋 전인 새 글 · 얕은 clone 에서 git log 가 비어 나오는 경우
    const dirs = setup();
    expect(await checkDivergence({ ...dirs, commitTimeOf: fake(null, 1_000_000) })).toEqual([]);
    expect(await checkDivergence({ ...dirs, commitTimeOf: fake(1_000_000, null) })).toEqual([]);
  });

  it("EN 짝이 없는 글은 갈라짐 대상이 아니다 (짝 검사 몫이다)", async () => {
    put(path.join(root, "ko/solo.md"), post(false));
    mkdirSync(path.join(root, "en"), { recursive: true });
    const r = await checkDivergence({
      koDir: path.join(root, "ko"),
      enDir: path.join(root, "en"),
      commitTimeOf: () => 1_000_000,
    });
    expect(r).toEqual([]);
  });
});

describe("checkEnDiagramKorean", () => {
  // EN 글이 한국어 그림을 참조하면 영어 독자가 못 읽는다. 렌더를 번역보다 먼저
  // 돌리면 생기는 사고인데 빌드도 링크 검사도 통과해서 조용히 나간다.
  const HASH = "0123456789abcdef";
  const enPost = (hash) =>
    `---\ntitle: t\n---\n\n<img src="/assets/mermaid/${hash}.svg" alt="diagram" />\n`;
  const svg = (inner, id = "mermaid-1") =>
    `<svg id="${id}" xmlns="http://www.w3.org/2000/svg"><foreignObject>${inner}</foreignObject></svg>`;

  const run = async () =>
    await checkEnDiagramKorean({
      enDir: path.join(root, "en"),
      assetDir: path.join(root, "mermaid"),
    });

  it("<p> 안에 한글이 있으면 잡고 해시와 텍스트를 돌려준다", async () => {
    put(path.join(root, "en/a.md"), enPost(HASH));
    put(
      path.join(root, `mermaid/${HASH}.svg`),
      svg('<span class="nodeLabel"><p>세션 — 서버가 기억한다</p></span>')
    );
    const r = await run();
    expect(r).toHaveLength(1);
    expect(r[0].hash).toBe(HASH);
    expect(r[0].texts.join(" ")).toContain("세션");
  });

  it("id 속성에만 한글이 있으면 잡지 않는다", async () => {
    // 실제로 id="mermaid-13-세션" 인 SVG 가 있다. id 는 화면에 안 나타나고
    // 바꾸면 엣지 선언과 어긋난다.
    put(path.join(root, "en/a.md"), enPost(HASH));
    put(
      path.join(root, `mermaid/${HASH}.svg`),
      svg(
        '<span class="nodeLabel"><p>Session — The server remembers</p></span>',
        "mermaid-13-세션"
      ).replace("<foreignObject>", '<g id="flowchart-세션-0"><foreignObject>').replace("</foreignObject>", "</foreignObject></g>")
    );
    expect(await run()).toEqual([]);
  });

  it("영어만 든 그림은 통과시킨다", async () => {
    put(path.join(root, "en/a.md"), enPost(HASH));
    put(path.join(root, `mermaid/${HASH}.svg`), svg("<p>Client</p><p>Server</p>"));
    expect(await run()).toEqual([]);
  });

  it("EN 글이 참조하지 않는 SVG 는 한글이 있어도 보지 않는다", async () => {
    // 같은 폴더에 KO 글이 쓰는 한국어 그림이 잔뜩 있다
    put(path.join(root, "en/a.md"), enPost(HASH));
    put(path.join(root, `mermaid/${HASH}.svg`), svg("<p>Client</p>"));
    put(path.join(root, "mermaid/ffffffffffffffff.svg"), svg("<p>한국어 그림</p>"));
    expect(await run()).toEqual([]);
  });

  it("한글이 든 <p> 만 texts 에 담는다", async () => {
    put(path.join(root, "en/a.md"), enPost(HASH));
    put(path.join(root, `mermaid/${HASH}.svg`), svg("<p>Client</p><p>서버</p>"));
    const r = await run();
    expect(r[0].texts).toEqual(["서버"]);
  });

  it("참조한 SVG 파일이 없어도 터지지 않는다", async () => {
    put(path.join(root, "en/a.md"), enPost(HASH));
    mkdirSync(path.join(root, "mermaid"), { recursive: true });
    await expect(run()).resolves.toBeDefined();
  });
});

describe("checkMermaidSources", () => {
  // .mmd 원본이 없으면 다른 기기에서 다시 렌더할 수 없다. 당장은 증상이 없어서
  // 조용히 지나간다.
  const HASH = "0123456789abcdef";
  const md = `---\ntitle: t\n---\n\n<img src="/assets/mermaid/${HASH}.svg" alt="d" />\n`;
  const run = async () =>
    await checkMermaidSources({
      blogDir: path.join(root, "blog"),
      mmdDir: path.join(root, "mmd"),
      restoredDir: path.join(root, "restored"),
    });

  beforeEach(() => {
    put(path.join(root, "blog/ko/a.md"), md);
    mkdirSync(path.join(root, "mmd"), { recursive: true });
    mkdirSync(path.join(root, "restored"), { recursive: true });
  });

  it("mmdDir 에 원본이 있으면 통과한다", async () => {
    put(path.join(root, `mmd/${HASH}.mmd`), "flowchart LR\n  A --> B\n");
    expect(await run()).toEqual([]);
  });

  it("restoredDir 에만 있어도 통과한다", async () => {
    put(path.join(root, `restored/${HASH}.mmd`), "flowchart LR\n  A --> B\n");
    expect(await run()).toEqual([]);
  });

  it("둘 다 없으면 해시를 잡는다", async () => {
    expect(await run()).toEqual([{ hash: HASH }]);
  });

  it("EN 글이 참조하는 해시도 본다", async () => {
    put(path.join(root, "blog/en/a.md"), md.replace(HASH, "fedcba9876543210"));
    put(path.join(root, `mmd/${HASH}.mmd`), "flowchart LR\n");
    expect(await run()).toEqual([{ hash: "fedcba9876543210" }]);
  });

  it("같은 해시를 여러 글이 써도 한 번만 보고한다", async () => {
    put(path.join(root, "blog/en/a.md"), md);
    expect(await run()).toEqual([{ hash: HASH }]);
  });
});

// ---------------------------------------------------------------------------
// 2회차 — 새 패턴 · 우회 · 마스킹한 글 · 오탐

const blocking = (text) => detectSecrets(text).filter((f) => f.blocking);

describe("detectSecrets — 새 패턴 (전부 차단)", () => {
  const cases = [
    ["ghs_", "ghs_" + A.slice(0, 36)],
    ["ghu_", "ghu_" + A.slice(0, 36)],
    ["ghr_", "ghr_" + A.slice(0, 36)],
    ["AWS AKIA", "AKIA" + "ABCDEFGHIJKLMNOP"],
    ["Google AIza", "AIza" + "SyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q"],
    ["Slack xoxb-", "xoxb-" + "1234567890-abcdefghij"],
    ["Slack xoxp-", "xoxp-" + "1234567890-abcdefghij"],
  ];
  for (const [name, secret] of cases) {
    it(`${name} 를 잡고 blocking 으로 표시한다`, () => {
      expect(blocking(`값은 ${secret} 이다`), name).not.toHaveLength(0);
    });
  }

  it("OPENSSH 개인키 블록을 잡는다", () => {
    const text = [
      "```",
      "-----BEGIN OPENSSH " + "PRIVATE KEY-----",
      "b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW",
      "-----END OPENSSH " + "PRIVATE KEY-----",
      "```",
    ].join("\n");
    expect(blocking(text)).not.toHaveLength(0);
  });

  it("scheme://user:pass@host 자격증명 URL 을 잡고 비밀번호를 출력에 싣지 않는다", () => {
    const pw = "hunter2" + "passw0rd";
    const found = blocking(`접속은 postgres://admin:${pw}@db.internal.example:5432/app 로 했다`);
    expect(found).not.toHaveLength(0);
    for (const f of found) expect(f.matched.includes(pw)).toBe(false);
  });

  it("user:pass 가 없는 평범한 URL 은 통과시킨다", () => {
    expect(blocking("https://example.com:8080/path?a=b 를 열었다")).toHaveLength(0);
  });
});

describe("detectSecrets — 우회가 막힌다", () => {
  // 전부 실제로 재현된 구멍이다
  it("앞에 _ 가 붙은 TOKEN_ghp_… 를 잡는다 (\\b 가 성립하지 않는 자리)", () => {
    expect(blocking("TOKEN_" + "ghp_" + A.slice(0, 36))).not.toHaveLength(0);
  });

  it("퍼센트 인코딩된 ghp%5F… 를 잡는다", () => {
    expect(blocking("?token=" + "ghp%5F" + A.slice(0, 36))).not.toHaveLength(0);
  });

  it("앞에 글자가 붙은 xsk-ant-… 를 잡는다", () => {
    expect(blocking("x" + "sk-ant-" + A.slice(0, 40))).not.toHaveLength(0);
  });
});

describe("detectSecrets — 마스킹한 글은 통과한다", () => {
  // CLAUDE.md 보안 절이 REDACTED_* 로 마스킹하라고 지시한다. 그 지시를 따른 글이
  // 막히면 검사가 지침과 싸우는 셈이다.
  const masked = [
    "sk-ant-api03-REDACTED_KEY_HERE",
    "sk-ant-<your_key_here>",
    "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
    "sk-EXAMPLEEXAMPLEEXAMPLEEXAMPLE",
    "ghp_REDACTED_TOKEN_PLACEHOLDER_0000",
  ];
  for (const m of masked) {
    it(`${m} 는 차단하지 않는다`, () => {
      expect(blocking(`키는 ${m} 로 적는다`)).toHaveLength(0);
    });
  }

  it("sk- 로 시작하는 긴 kebab URL 경로(sk-learn-tutorial-getting-started)는 통과한다", () => {
    expect(
      blocking("https://example.com/docs/sk-learn-tutorial-getting-started 를 봤다")
    ).toHaveLength(0);
  });
});

describe("detectSecrets — 40자 hex", () => {
  const hex40 = "0123456789abcdef0123456789abcdef01234567";

  it("40자 hex 는 경고(blocking 아님)로 잡는다", () => {
    // 레거시 OAuth 토큰 · Mailgun 키가 정확히 40자 hex 다
    const hit = detectSecrets(`토큰 ${hex40}`).find((f) => f.kind === "hex32");
    expect(hit).toBeTruthy();
    expect(hit.blocking).toBe(false);
  });

  it("같은 줄에 commit 이 있으면 전체 SHA 도 통과한다", () => {
    expect(detectSecrets(`commit ${hex40}`)).toHaveLength(0);
  });

  it("같은 줄에 sha 가 있으면 통과한다", () => {
    expect(detectSecrets(`sha: ${hex40}`)).toHaveLength(0);
  });

  it("7~12자 커밋 해시는 계속 통과한다", () => {
    expect(detectSecrets("7f666bc 1a8be7e59a3c")).toHaveLength(0);
  });
});

describe("detectKoreanInEnglishPost", () => {
  it("본문에 남은 한글 줄을 원문 줄번호로 돌려준다", () => {
    const text = ["---", "title: t", "---", "", "English line", "남은 한국어 문장", ""].join("\n");
    const r = detectKoreanInEnglishPost(text);
    expect(r).toHaveLength(1);
    expect(r[0].line).toBe(6);
    expect(r[0].text).toContain("한국어");
  });

  it("frontmatter 의 tags 는 예외다 (태그는 번역하지 않는다)", () => {
    const text = ["---", "title: t", "tags:", "  - 트러블슈팅", "  - astro", "---", "", "English only"].join("\n");
    expect(detectKoreanInEnglishPost(text)).toEqual([]);
  });

  it("코드 블록 안의 한글은 예외다", () => {
    // 로그 · 출력은 작성자가 본 그대로 둔다
    const text = ["English", "", "```txt", "가열로 (유사도: 0.8145)", "```"].join("\n");
    expect(detectKoreanInEnglishPost(text)).toEqual([]);
  });

  it("인라인 코드 안의 한글은 예외다", () => {
    expect(detectKoreanInEnglishPost("The label is `가열로` in the DB")).toEqual([]);
  });

  it("인라인 코드 밖의 한글은 같은 줄이어도 잡는다", () => {
    expect(detectKoreanInEnglishPost("The label `x` 가열로 stays")).toHaveLength(1);
  });

  it("영어뿐인 글은 빈 배열이다", () => {
    expect(detectKoreanInEnglishPost("---\ntitle: t\n---\n\nAll English.\n")).toEqual([]);
  });
});

describe("checkTranslationPairs — _ 접두사", () => {
  // blog 로더가 `[^_]*.md` 라 _ 로 시작하는 글은 발행되지 않는다
  const dirs = () => ({ koDir: path.join(root, "ko"), enDir: path.join(root, "en") });

  it("짝이 없는 _ KO 글은 missing 에 안 든다", async () => {
    put(path.join(root, "ko/_hidden.md"), post(false));
    mkdirSync(path.join(root, "en"), { recursive: true });
    expect((await checkTranslationPairs(dirs())).missing).toEqual([]);
  });

  it("_ KO 글의 EN 짝이 있어도 orphans 에 안 든다", async () => {
    put(path.join(root, "ko/_hidden.md"), post(false));
    put(path.join(root, "en/_hidden.md"), post(false));
    expect((await checkTranslationPairs(dirs())).orphans).toEqual([]);
  });
});

describe("checkEnDiagramKorean — 시퀀스 다이어그램", () => {
  // mermaid 는 flowchart 만 <p> 로 그리고 시퀀스는 <text> 로 그린다
  const HASH = "abcdef0123456789";
  const enPost = `---\ntitle: t\n---\n\n<img src="/assets/mermaid/${HASH}.svg" alt="d" />\n`;
  const run = () =>
    checkEnDiagramKorean({ enDir: path.join(root, "en"), assetDir: path.join(root, "mermaid") });
  const seed = (inner) => {
    put(path.join(root, "en/a.md"), enPost);
    put(path.join(root, `mermaid/${HASH}.svg`), `<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`);
  };

  it("<text> 안의 한글을 잡는다", async () => {
    seed('<text x="1" y="2">서버가 응답한다</text>');
    const r = await run();
    expect(r).toHaveLength(1);
    expect(r[0].hash).toBe(HASH);
  });

  it("<tspan> 안의 한글을 잡는다", async () => {
    seed('<text x="1"><tspan x="1">브라우저</tspan></text>');
    expect(await run()).toHaveLength(1);
  });

  it("영어뿐인 <text> 는 통과하고 id 의 한글은 여전히 안 본다", async () => {
    seed('<g id="actor-세션"><text>Server</text></g>');
    expect(await run()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 종료 코드와 출력. main() 이 export 되지 않아서 CLI 를 임시 git 저장소에서 돌린다.
// ⚠️ 이 블록은 구현에 「루트를 바꾸는 이음매」가 있어야 돈다. 지금 CLI 는 cwd 를 무시하고
// 스크립트 위치의 실저장소만 본다 (임시 저장소에 심은 시크릿이 안 잡히는 것으로 확인).
// 여기서는 환경변수 CHECK_MD_ROOT=<저장소 루트> 로 가정했다. 이름은 구현이 정하면 바꾼다.
// 대상은 `git ls-files` 기준이라 가정한다.

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../scripts/check-markdown.mjs");

function git(cwd, args, env = {}) {
  return execFileSync("git", args, { cwd, env: { ...process.env, ...env }, stdio: "pipe" });
}

function runCli(cwd) {
  try {
    const out = execFileSync("node", [SCRIPT], { cwd, env: { ...process.env, CHECK_MD_ROOT: cwd }, stdio: "pipe", encoding: "utf8" });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: String(e.stdout) + String(e.stderr) };
  }
}

describe("check-markdown CLI — 종료 코드와 출력", () => {
  const HASH = "0123456789abcdef";
  const goodPost = (body = "본문") => `---\ntitle: t\ndraft: false\n---\n\n${body}\n`;
  const enBody = (body = "Body") => `---\ntitle: t\ndraft: false\n---\n\n${body}\n`;

  let repo;
  const write = (rel, content) => put(path.join(repo, rel), content);
  const commit = (msg, date = "2026-01-01T00:00:00Z") => {
    git(repo, ["add", "-A"]);
    git(repo, ["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "-m", msg], {
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date,
    });
  };

  beforeEach(() => {
    repo = path.join(root, "repo");
    mkdirSync(repo, { recursive: true });
    git(repo, ["init", "-q"]);
    write("src/data/blog/ko/a.md", goodPost());
    write("src/data/blog/en/a.md", enBody());
    commit("base");
  });

  it("깨끗한 저장소는 exit 0 이다 (아래 테스트의 기준선)", () => {
    expect(runCli(repo).code).toBe(0);
  });

  describe("차단 — exit 1", () => {
    it("시크릿(blocking)이 있으면 exit 1", () => {
      write("src/data/blog/ko/a.md", goodPost("키는 " + "ghp_" + A.slice(0, 36)));
      commit("secret");
      expect(runCli(repo).code).toBe(1);
    });

    it("KO 만 있고 EN 짝이 없으면 exit 1", () => {
      write("src/data/blog/ko/b.md", goodPost());
      commit("ko only");
      expect(runCli(repo).code).toBe(1);
    });

    it("미렌더 mermaid 블록이 있으면 exit 1", () => {
      write("src/data/blog/ko/a.md", goodPost("```mermaid\nflowchart LR\n  A --> B\n```"));
      commit("mermaid");
      expect(runCli(repo).code).toBe(1);
    });

    it("공인 IP 가 있으면 exit 1", () => {
      write("src/data/blog/ko/a.md", goodPost("서버는 8.8.8.8 이다"));
      commit("ip");
      expect(runCli(repo).code).toBe(1);
    });

    it("본문 밖(deploy/ 문서)의 시크릿도 잡는다 — git ls-files 범위", () => {
      write("deploy/README.md", "키 " + "ghp_" + A.slice(0, 36) + "\n");
      commit("deploy secret");
      expect(runCli(repo).code).toBe(1);
    });
  });

  describe("경고 — exit 0 이어야 한다", () => {
    it("경고급 시크릿(40자 hex)만 있으면 exit 0", () => {
      write("src/data/blog/ko/a.md", goodPost("값 0123456789abcdef0123456789abcdef01234567"));
      commit("hex");
      expect(runCli(repo).code).toBe(0);
    });

    it("KO 가 EN 보다 나중에 커밋돼 갈라져도 exit 0", () => {
      write("src/data/blog/ko/a.md", goodPost("고쳤다"));
      commit("ko later", "2026-03-01T00:00:00Z");
      expect(runCli(repo).code).toBe(0);
    });

    it("EN 그림에 한글이 있어도 exit 0", () => {
      write("src/data/blog/en/a.md", enBody(`<img src="/assets/mermaid/${HASH}.svg" alt="d" />`));
      write(`public/assets/mermaid/${HASH}.svg`, "<svg><text>한국어</text></svg>");
      commit("ko diagram in en");
      expect(runCli(repo).code).toBe(0);
    });

    it(".mmd 원본이 없어도 exit 0", () => {
      write("src/data/blog/ko/a.md", goodPost(`<img src="/assets/mermaid/${HASH}.svg" alt="d" />`));
      write(`public/assets/mermaid/${HASH}.svg`, "<svg><text>Server</text></svg>");
      commit("no mmd");
      expect(runCli(repo).code).toBe(0);
    });

    it("EN 본문에 한국어가 남아도 exit 0", () => {
      write("src/data/blog/en/a.md", enBody("번역 안 된 문장"));
      commit("ko in en");
      expect(runCli(repo).code).toBe(0);
    });
  });

  describe("출력에 평문 비밀값이 없다", () => {
    // 2026-11-14: 공인 IP 검사가 같은 줄을 90자 평문으로 찍어서 AWS 키와
    // 비밀번호가 CI 로그에 그대로 나왔다. detectSecrets 반환값만 봐서는 못 잡는다.
    it("IP 와 토큰이 같은 줄에 있어도 토큰 원본을 출력하지 않는다", () => {
      const token = "ghp_" + A.slice(0, 36);
      const aws = "AKIA" + "ABCDEFGHIJKLMNOP";
      write("src/data/blog/ko/a.md", goodPost(`서버 8.8.8.8 에 ${token} 와 ${aws} 로 접속했다`));
      commit("ip + token");
      const { code, out } = runCli(repo);
      expect(code).toBe(1);
      expect(out.length).toBeGreaterThan(0);
      expect(out.includes(token)).toBe(false);
      expect(out.includes(aws)).toBe(false);
      expect(out.includes(token.slice(6))).toBe(false);
    });

    it("IP 와 같은 줄의 비밀번호 URL 을 출력하지 않는다", () => {
      const pw = "hunter2" + "passw0rd";
      write("src/data/blog/ko/a.md", goodPost(`postgres://admin:${pw}@8.8.8.8:5432/app`));
      commit("ip + url");
      const { out } = runCli(repo);
      expect(out.includes(pw)).toBe(false);
    });

    it("취소선 snippet 줄에 든 토큰도 출력하지 않는다", () => {
      const token = "ghp_" + A.slice(0, 36);
      write("src/data/blog/ko/a.md", goodPost(`기간은 ~1.5~2주 이고 키는 ${token}`));
      commit("strike + token");
      const { out } = runCli(repo);
      expect(out.includes(token)).toBe(false);
      expect(out.includes(token.slice(6))).toBe(false);
    });

    it("시크릿 차단 출력에도 원본이 없다", () => {
      const token = "sk-ant-" + A.slice(0, 40);
      write("src/data/blog/ko/a.md", goodPost(`키 ${token}`));
      commit("sk");
      const { code, out } = runCli(repo);
      expect(code).toBe(1);
      expect(out.includes(token)).toBe(false);
      expect(out.includes(token.slice(10))).toBe(false);
    });
  });
});
