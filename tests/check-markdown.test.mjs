import { describe, it, expect } from "vitest";

import {
  detectPublicIp,
  detectUnrenderedMermaid,
} from "../scripts/check-markdown.mjs";

// 이 탐지기는 실제 사고 뒤에 생겼고 두 번 손봤다 (2026-09-06 집 IP 유출,
// 2026-09-23 User-Agent 오탐). 양쪽을 다 고정해두지 않으면 한쪽을 고칠 때
// 다른 쪽이 조용히 되돌아간다.
//
// 고정값으로 8.8.8.8 · 1.1.1.1 을 쓴다. 누구나 아는 공개 DNS 라 작성자에 대해
// 아무것도 드러내지 않는다. `pnpm check:md` 는 tests/ 를 보지 않으므로
// (대상은 src/data/blog · deploy · docs · README · CLAUDE.md) 여기 든 주소가
// 발행 검사에 걸리지도 않는다.
describe("detectPublicIp", () => {
  it("공인 IP 를 잡는다", () => {
    expect(detectPublicIp("서버 주소는 8.8.8.8 이다")).toHaveLength(1);
    expect(detectPublicIp("8.8.8.8 과 1.1.1.1")).toHaveLength(2);
  });

  it("URL 안에 적어도 잡는다", () => {
    // 제품명/버전 예외는 슬래시 하나만 요구하므로 `http://` 는 빠져나가지 못한다
    expect(detectPublicIp("열어보니 http://8.8.8.8/health 였다")).toHaveLength(1);
  });

  it("RFC 5737 문서용 주소는 통과시킨다", () => {
    // 글에 예시가 필요할 때 쓰라고 CLAUDE.md 가 지정한 세 대역이다
    for (const ip of ["192.0.2.1", "198.51.100.1", "203.0.113.1"]) {
      expect(detectPublicIp(`예시는 ${ip} 을 쓴다`), ip).toHaveLength(0);
    }
  });

  it("사설 · 루프백 · 링크로컬은 통과시킨다", () => {
    for (const ip of [
      "10.0.0.5",
      "192.168.0.1",
      "172.17.0.1",
      "127.0.0.1",
      "169.254.1.1",
    ]) {
      expect(detectPublicIp(`주소는 ${ip}`), ip).toHaveLength(0);
    }
  });

  it("제품명 뒤의 버전 번호를 IP 로 오인하지 않는다", () => {
    // 2026-09-23: User-Agent 예시가 오탐으로 막혔다
    expect(
      detectPublicIp("Mozilla/5.0 Chrome/144.0.0.0 Safari/537.36")
    ).toHaveLength(0);
    expect(detectPublicIp("nginx/1.24.0.1 을 쓴다")).toHaveLength(0);
  });

  it("옥텟이 255 를 넘으면 IP 가 아니다", () => {
    expect(detectPublicIp("값은 999.1.1.1")).toHaveLength(0);
  });

  // ⚠️ 아래 둘은 **현재 동작을 고정한 것이고, 바라는 동작이 아니다.**
  // 탐지기를 고치면 이 테스트가 깨진다 — 그때 의도적으로 지우면 된다.
  describe("알려진 구멍", () => {
    it("`version` + 숫자가 있는 줄은 통째로 건너뛴다", () => {
      // 같은 줄에 진짜 공인 IP 가 있어도 놓친다
      expect(
        detectPublicIp("nginx version 1.24 를 쓰고 집 IP 는 8.8.8.8 이다")
      ).toHaveLength(0);
    });

    it("예외의 `버전` 갈래는 죽어 있다", () => {
      // 정규식이 `\b(v|version|버전)` 인데 한글은 \w 가 아니라 \b 가 안 붙는다.
      // 그래서 한글 「버전」은 예외로 동작하지 않고 줄이 그대로 검사된다
      expect(detectPublicIp("버전 2 서버의 주소는 8.8.8.8")).toHaveLength(1);
    });
  });
});

describe("detectUnrenderedMermaid", () => {
  it("렌더 안 된 mermaid 블록을 줄번호로 잡는다", () => {
    const md = ["# 제목", "", "```mermaid", "graph TD", "```", ""].join("\n");
    expect(detectUnrenderedMermaid(md)).toEqual([{ line: 3 }]);
  });

  it("렌더된 img 는 잡지 않는다", () => {
    const md = '<img src="/assets/mermaid/abc123.svg" alt="흐름" />';
    expect(detectUnrenderedMermaid(md)).toHaveLength(0);
  });

  it("언어가 다른 코드 블록은 잡지 않는다", () => {
    expect(detectUnrenderedMermaid("```bash\nls\n```")).toHaveLength(0);
  });
});
