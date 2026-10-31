import { describe, it, expect } from "vitest";

import { detectAccidentalStrikethrough } from "../scripts/translate/validate.mjs";

// `~1.5~2주` 처럼 물결을 둘 쓰면 마크다운이 취소선으로 읽는다. 발행본에
// 글자가 그어진 채 나가는데 빌드도 링크 검사도 통과하므로 조용히 새어나간다.
describe("detectAccidentalStrikethrough", () => {
  it("숫자 범위에 쓴 물결 짝을 잡는다", () => {
    const found = detectAccidentalStrikethrough("기간은 ~1.5~2주 걸렸다");
    expect(found).toHaveLength(1);
    expect(found[0].matched).toBe("~1.5~");
    expect(found[0].line).toBe(1);
  });

  it("줄번호를 원문 기준으로 센다", () => {
    const text = ["첫 줄", "", "소요 ~3~4일"].join("\n");
    expect(detectAccidentalStrikethrough(text)[0].line).toBe(3);
  });

  it("의도한 취소선(물결 둘)은 통과시킨다", () => {
    // inbox 의 「처리 완료」 항목이 이 표기를 쓴다
    expect(detectAccidentalStrikethrough("~~처리 완료~~")).toHaveLength(0);
  });

  it("코드 블록 안의 물결은 통과시킨다", () => {
    const text = ["```bash", "rm -rf ~/tmp ~/cache", "```"].join("\n");
    expect(detectAccidentalStrikethrough(text)).toHaveLength(0);
  });

  it("인라인 코드 안의 물결도 통과시킨다", () => {
    expect(detectAccidentalStrikethrough("경로는 `~/dev ~/blog` 다")).toHaveLength(
      0
    );
  });

  it("코드 블록을 지워도 뒤쪽 줄번호가 밀리지 않는다", () => {
    // 블록을 공백으로 바꾸고 줄바꿈은 남기는 구현이라 번호가 유지된다
    const text = ["```js", "const a = 1;", "```", "", "소요 ~3~4일"].join("\n");
    const found = detectAccidentalStrikethrough(text);
    expect(found).toHaveLength(1);
    expect(found[0].line).toBe(5);
  });

  it("짝이 없는 물결 하나는 잡지 않는다", () => {
    expect(detectAccidentalStrikethrough("약 ~3일 걸린다")).toHaveLength(0);
  });
});
