import { describe, it, expect } from "vitest";

import { scanStagedFiles } from "../scripts/check-staged.mjs";

// 커밋 직전 검사는 **스테이지에 들어간 파일 내용**을 본다.
//
// 처음에는 `git diff --cached` 의 `+` 줄만 봤다가 세 가지로 뚫렸고 전부
// 실제 커밋으로 재현됐다 (2026-11-14 2차 보안 점검). 아래 테스트는 그 셋을
// 박아둔 것이다. diff 파싱으로 돌아가면 전부 깨진다.

const A = "abcdefghijklmnopqrstuvwxyz0123456789";
const KEY = `sk-ant-${A}`;

/** 가짜 스테이지: {경로: 내용} */
const from = map => scanStagedFiles(Object.keys(map), f => map[f] ?? null);

describe("scanStagedFiles — 재현됐던 우회", () => {
  it("++ 로 시작하는 줄도 본다", () => {
    // diff 에서는 `+++…` 가 되어 헤더로 오인됐다. 글에 diff 를 인용하면
    // 자연히 생기는 모양이라 고의가 아니어도 밟는다.
    const { blocking } = from({ "docs/x.md": `++key ${KEY} 다` });
    expect(blocking).toHaveLength(1);
  });

  it("+++ b/ 로 시작하는 본문 줄도 본다", () => {
    const { blocking } = from({ "docs/x.md": `+++ b/tests/x.md\nkey ${KEY}` });
    expect(blocking.length).toBeGreaterThan(0);
    expect(blocking[0].file).toBe("docs/x.md"); // 경로가 본문에 끌려가지 않는다
  });

  it("--- /dev/null 이 본문에 있어도 그 뒤를 계속 본다", () => {
    const { blocking } = from({ "docs/x.md": `+++ /dev/null\nkey ${KEY}` });
    expect(blocking.length).toBeGreaterThan(0);
  });

  it("이름을 바꾸면서 고친 파일도 내용을 본다", () => {
    // --diff-filter=ACM 이 rename 을 버려 0줄을 봤다. CLAUDE.md 6번이
    // 지시하는 `_prefix` 소프트 숨김이 git mv + 수정을 한 커밋에 담는다.
    const { blocking, scanned } = from({ "src/data/portfolio/_x.md": `key ${KEY}` });
    expect(scanned).toBe(1);
    expect(blocking).toHaveLength(1);
  });
});

describe("scanStagedFiles — 차단과 경고", () => {
  it("키 접두사를 차단으로 분류한다", () => {
    const { blocking } = from({ "src/data/blog/ko/a.md": `---\ntitle: x\n---\n키 ${KEY} 다` });
    expect(blocking).toHaveLength(1);
    expect(blocking[0].line).toBe(4);
  });

  it("32자 이상 hex 는 경고로만 분류한다", () => {
    const { blocking, warning } = from({ "docs/x.md": `해시 ${"a".repeat(40)}` });
    expect(blocking).toHaveLength(0);
    expect(warning.length).toBeGreaterThan(0);
  });

  it("깨끗한 파일은 아무것도 내지 않는다", () => {
    const { blocking, warning } = from({ "docs/x.md": "평범한 한국어 문장이다" });
    expect(blocking).toHaveLength(0);
    expect(warning).toHaveLength(0);
  });

  it("삭제된 경로는 건너뛴다", () => {
    const { scanned, skipped } = from({ "docs/gone.md": null });
    expect(scanned).toBe(0);
    expect(skipped).toEqual(["docs/gone.md"]);
  });

  it("바이너리는 건너뛴다", () => {
    const { scanned } = from({ "docs/x.md": `key ${KEY}\0binary` });
    expect(scanned).toBe(0);
  });
});

describe("scanStagedFiles — 값이 새지 않는다", () => {
  // 이 결과가 터미널과 CI 로그, 그리고 에이전트 세션 기록에 찍힌다.
  it("masked 에 원래 값이 들어 있지 않다", () => {
    const { blocking } = from({ "docs/x.md": `키 ${KEY} 다` });
    expect(blocking[0].masked).not.toContain(KEY);
    expect(blocking[0].masked).not.toContain(KEY.slice(8));
  });

  it("같은 줄의 다른 비밀값이 context 로 새지 않는다", () => {
    // AWS 시크릿은 40자 영숫자라 hex 도 아니고 padding 도 없어 mask() 의
    // 어떤 규칙에도 안 걸린다. 줄 전체를 담으면 그대로 샜다 (2차 점검 S-8).
    const aws = "wJalrXUtnFEMI7MDENGbPxRfiCYzKEYabcdEFGHI";
    const { blocking } = from({ "docs/x.md": `AWS_SECRET_ACCESS_KEY=${aws} TOKEN=${KEY}` });
    expect(blocking.length).toBeGreaterThan(0);
    for (const b of blocking) {
      expect(b.context).not.toContain(aws);
    }
  });

  it("context 에도 걸린 값 자체가 들어 있지 않다", () => {
    const { blocking } = from({ "docs/x.md": `서버 203.0.113.1 에서 ${KEY} 로 접속` });
    expect(blocking[0].context).not.toContain(KEY);
  });
});

describe("scanStagedFiles — 검사 범위", () => {
  it("제외 폴더의 파일은 보지 않는다", () => {
    const { scanned } = from({ "tests/fixture.md": `키 ${KEY} 다` });
    expect(scanned).toBe(0);
  });

  it("바이너리 확장자는 보지 않는다", () => {
    const { scanned } = from({ "a.svg": `키 ${KEY} 다` });
    expect(scanned).toBe(0);
  });

  it("블로그 밖의 파일도 본다 — inbox · deploy 설정이 여기 들어온다", () => {
    for (const f of ["src/000-inbox.md", "deploy/nginx/site.conf", "server/svc.py"]) {
      const { blocking } = from({ [f]: `키 ${KEY} 다` });
      expect(blocking.length, f).toBeGreaterThan(0);
    }
  });
});
