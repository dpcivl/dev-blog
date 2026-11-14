import { describe, it, expect } from "vitest";

import { judge } from "../scripts/hooks/guard-bash.mjs";
import { scanFile } from "../scripts/hooks/scan-written.mjs";

// 권한 목록(.claude/settings.json)의 Bash 규칙은 명령 문자열의 **앞부분만**
// 본다. `Read(.env)` 차단은 Read 도구만 막고 `cat .env` 는 못 막는다.
// 이 훅은 명령 전체를 보고 판단한다 (하네스 4단계).
//
// 오탐이 더 위험하다 — 막히면 작업이 멈추고, 그러면 사람이 훅을 꺼버린다.

describe("guard-bash — 막아야 하는 것", () => {
  const blocked = [
    ["cat .env", ".env"],
    ["head -5 .env.production", ".env"],
    ["grep ANTHROPIC .env", ".env"],
    ["sh -c 'cat .env'", "감싸도 명령 전체를 본다"],
    ["python3 -c \"print(open('.env').read())\"", "다른 언어로 읽어도"],
    ["git add -f .env", "gitignore 를 무시하고 add"],
    ["cat deploy/ssh/deploy_key", "배포 키"],
    ["cat ~/.ssh/id_rsa", "SSH 개인키"],
    ["openssl rsa -in server.pem", "인증서"],
  ];
  for (const [cmd, why] of blocked) {
    it(`${why}: ${cmd}`, () => {
      expect(judge(cmd), cmd).not.toBeNull();
    });
  }
});

describe("guard-bash — 통과해야 하는 것", () => {
  const allowed = [
    ".env.example 은 저장소에 있는 예시다",
    "pnpm translate one some-slug",
    "ls -la src/data/blog",
    "cat src/data/blog/ko/post.md",
    "git log --oneline -20",
    "cat package.json",
    "grep -rn environment docs/",
    "node scripts/check-markdown.mjs",
    "pnpm check:md",
    "echo 'env 라는 낱말이 들어간 문장'",
  ];
  for (const cmd of allowed) {
    it(`통과: ${cmd.slice(0, 40)}`, () => {
      expect(judge(cmd), cmd).toBeNull();
    });
  }

  it("cat .env.example 은 통과한다", () => {
    expect(judge("cat .env.example")).toBeNull();
  });

  it("빈 명령·비문자열은 판단하지 않는다", () => {
    expect(judge("")).toBeNull();
    expect(judge(undefined)).toBeNull();
    expect(judge(null)).toBeNull();
  });
});

describe("scan-written", () => {
  const A = "abcdefghijklmnopqrstuvwxyz0123456789";
  const read = text => () => text;

  it("방금 쓴 글의 비밀값을 잡는다", () => {
    const hits = scanFile("src/data/blog/ko/x.md", read(`키 sk-ant-${A} 다`));
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].blocking).toBe(true);
  });

  it("값을 그대로 담지 않는다", () => {
    const secret = `sk-ant-${A}`;
    const hits = scanFile("src/data/blog/ko/x.md", read(`키 ${secret} 다`));
    expect(hits[0].masked).not.toContain(secret);
    expect(hits[0].masked).not.toContain(secret.slice(8));
  });

  it("깨끗한 글은 아무것도 내지 않는다", () => {
    expect(scanFile("src/data/blog/ko/x.md", read("평범한 문장이다"))).toEqual([]);
  });

  it("검사 대상이 아닌 경로는 보지 않는다", () => {
    expect(scanFile("tests/fixture.md", read(`키 sk-ant-${A}`))).toEqual([]);
    expect(scanFile("a.svg", read(`키 sk-ant-${A}`))).toEqual([]);
  });

  it("읽기에 실패해도 터지지 않는다", () => {
    expect(
      scanFile("src/data/blog/ko/x.md", () => {
        throw new Error("ENOENT");
      })
    ).toEqual([]);
  });
});
