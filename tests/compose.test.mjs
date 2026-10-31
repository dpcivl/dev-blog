import { describe, it, expect } from "vitest";
import matter from "gray-matter";

import * as composeModule from "../server/scratch-ui/src/compose.js";

const { composeManuscript } = composeModule;

// 원고 조립은 DOM 을 읽지 않는 순수 함수다. 덩어리 [{title, body}] 와
// 메타 {title, description, tags} 를 받아 마크다운 문자열을 낸다.
//
// 이 문자열은 scratch 저장소 posts/<slug>.md 로 커밋되고, 다음 세션이 집어서
// 블로그에 올린다. 그래서 두 가지가 틀리면 조용히 새어나간다.
//   - 빈 칸에 자리표시자(<제목>)가 글자로 박혀 그대로 배포된다
//   - YAML 이 깨져 빌드가 죽거나, 값이 다른 타입으로 읽힌다
// frontmatter 는 문자열 비교가 아니라 실제 파서(gray-matter)로 읽어서 확인한다.

const compose = (sections, meta = {}) => composeManuscript(sections, meta);

// 본문만 보고 싶을 때. frontmatter 가 있든 없든 본문 부분만 돌려준다.
const bodyOf = out => matter(out).content.trim();

// ───────────────────────────────────────────────────────────────
// (1) 덩어리 → 본문
// ───────────────────────────────────────────────────────────────
describe("composeManuscript — 덩어리를 본문으로", () => {
  it("제목이 있는 덩어리는 `## 제목` 다음에 빈 줄, 그 다음 본문이 온다", () => {
    const out = compose([{ title: "상황", body: "막혔다" }]);
    expect(out).toBe("## 상황\n\n막혔다\n");
  });

  it("제목이 빈 덩어리는 `##` 줄 없이 본문만 나온다", () => {
    const out = compose([{ title: "", body: "도입 문단" }]);
    expect(out).toBe("도입 문단\n");
    expect(out).not.toMatch(/^##/m);
  });

  it("제목이 공백뿐이거나 없어도 `##` 줄을 만들지 않는다", () => {
    for (const title of ["   ", "\t", undefined, null]) {
      const out = compose([{ title, body: "본문" }]);
      expect(out, `title=${JSON.stringify(title)}`).toBe("본문\n");
    }
  });

  it("제목 앞뒤 공백은 다듬는다", () => {
    expect(compose([{ title: "  원인  ", body: "x" }])).toBe("## 원인\n\nx\n");
  });

  // 목업 fileText() 가 합친 문자열(`## 제목\n\n` + 본문)을 걸러서, 제목만 있는
  // 칸은 남는다. 뼈대 프리셋(상황 → 시도 → 원인 → 회고)으로 칸을 깔아두고 하나를
  // 못 채운 채 저장했을 때 칸이 조용히 사라지지 않게 하려는 것이다. 빈 제목은 눈에
  // 보여서 고칠 수 있지만, 사라진 칸은 작성자가 짜둔 구조의 흔적까지 없앤다.
  it("본문이 비거나 공백뿐이어도 제목이 있으면 제목은 남는다", () => {
    for (const body of ["", " \n\t \n", undefined]) {
      const out = compose([
        { title: "남는다", body: "내용" },
        { title: "제목만", body },
      ]);
      expect(out, `body=${JSON.stringify(body)}`).toMatch(/^## 제목만\s*$/m);
      expect(out).toContain("## 남는다\n\n내용");
      // 빈 본문 자리에 자리표시자를 채워 넣지 않는다
      expect(out).not.toMatch(/<[^>\n]+>/);
    }
  });

  it("제목만 있는 덩어리 하나도 `## 제목` 으로 남는다", () => {
    expect(compose([{ title: "제목만", body: "" }]).trim()).toBe("## 제목만");
  });

  it("제목도 본문도 빈 덩어리는 통째로 빠진다", () => {
    const out = compose([
      { title: "남는다", body: "내용" },
      { title: "", body: "" },
      { title: "  ", body: " \n\t " },
      { title: undefined, body: undefined },
    ]);
    expect(out).toBe("## 남는다\n\n내용\n");
  });

  it("덩어리 사이는 빈 줄 하나로 갈린다", () => {
    const out = compose([
      { title: "A", body: "a" },
      { title: "B", body: "b" },
    ]);
    expect(out).toBe("## A\n\na\n\n## B\n\nb\n");
  });

  it("제목 없는 덩어리와 있는 덩어리가 섞여도 사이는 빈 줄 하나다", () => {
    const out = compose([
      { title: "", body: "도입" },
      { title: "원인", body: "이유" },
    ]);
    expect(out).toBe("도입\n\n## 원인\n\n이유\n");
  });

  it("덩어리 순서가 입력 그대로 유지된다", () => {
    const titles = ["다", "가", "라", "나"];
    const out = compose(titles.map(t => ({ title: t, body: `${t} 본문` })));
    const found = [...out.matchAll(/^## (.+)$/gm)].map(m => m[1]);
    expect(found).toEqual(titles);
  });

  it("본문 앞뒤 공백·빈 줄은 다듬는다", () => {
    const out = compose([{ title: "T", body: "\n\n  본문  \n\n\n" }]);
    expect(out).toBe("## T\n\n본문\n");
  });

  it("본문 안쪽 줄바꿈은 건드리지 않는다 — 연속 빈 줄과 줄 끝 공백 포함", () => {
    // 줄 끝 공백 둘은 마크다운 강제 줄바꿈이고, 목록·코드는 줄 구조가 곧 내용이다
    const body = "첫 줄  \n둘째 줄\n\n\n\n셋째 문단\n- 목록 1\n- 목록 2";
    const out = compose([{ title: "T", body }]);
    expect(out).toBe(`## T\n\n${body}\n`);
  });

  it("입력 덩어리 배열과 객체를 바꾸지 않는다", () => {
    const sections = [{ title: " A ", body: "\n a \n" }];
    const snapshot = JSON.parse(JSON.stringify(sections));
    compose(sections, { title: "t", tags: ["x"] });
    expect(sections).toEqual(snapshot);
  });

  // 기대를 여기서 정한다: 덩어리가 없고 메타도 없으면 빈 문자열이다.
  // 자리표시자 뼈대나 빈 울타리를 만들어 저장하게 두지 않는다.
  it("덩어리가 하나도 없고 메타도 비면 빈 문자열이다", () => {
    expect(compose([], {})).toBe("");
  });

  it("제목도 본문도 전부 빈 덩어리뿐이고 메타도 비면 빈 문자열이다", () => {
    expect(
      compose(
        [
          { title: "", body: "" },
          { title: "  ", body: "  " },
          { title: undefined, body: undefined },
        ],
        {}
      )
    ).toBe("");
  });

  // 위와 같은 이유(뼈대 칸을 지우지 않는다)로, 제목만 있으면 빈 문자열이 아니다.
  it("제목만 있는 덩어리가 있으면 메타가 비어도 빈 문자열이 아니다", () => {
    const out = compose([{ title: "제목만", body: "" }], {});
    expect(out).not.toBe("");
    expect(out).toContain("## 제목만");
  });

  // 기대를 여기서 정한다: 본문이 없어도 메타를 채웠다면 frontmatter 는 남는다.
  it("덩어리가 전부 비어도 메타가 있으면 frontmatter 만 나온다", () => {
    const out = compose([], { title: "제목" });
    const parsed = matter(out);
    expect(parsed.data).toEqual({ title: "제목" });
    expect(parsed.content.trim()).toBe("");
  });

  it("meta 자체가 없어도(undefined) 던지지 않는다", () => {
    expect(() => composeManuscript([{ title: "T", body: "b" }])).not.toThrow();
    expect(composeManuscript([{ title: "T", body: "b" }])).toBe("## T\n\nb\n");
  });
});

// ───────────────────────────────────────────────────────────────
// (2) frontmatter — 목업과 다르다. 빈 칸은 줄째 빠지고 자리표시자는 없다
// ───────────────────────────────────────────────────────────────
describe("composeManuscript — frontmatter", () => {
  const sections = [{ title: "T", body: "본문" }];

  it("세 칸을 다 채우면 title · description · tags 가 그대로 읽힌다", () => {
    const out = compose(sections, {
      title: "loc 는 끝을 포함한다",
      description: "슬라이싱 동작 차이",
      tags: ["pandas", "트러블슈팅"],
    });
    expect(matter(out).data).toEqual({
      title: "loc 는 끝을 포함한다",
      description: "슬라이싱 동작 차이",
      tags: ["pandas", "트러블슈팅"],
    });
  });

  it("frontmatter 는 문서 맨 앞 `---` 울타리 사이에 있고 본문은 그 뒤에 온다", () => {
    const out = compose(sections, { title: "제목" });
    expect(out.startsWith("---\n")).toBe(true);
    expect(matter(out).isEmpty).toBe(false);
    expect(bodyOf(out)).toBe("## T\n\n본문");
  });

  it("빈 칸은 줄째 빠진다 — 제목만 채우면 title 하나뿐이다", () => {
    const out = compose(sections, { title: "제목", description: "", tags: [] });
    expect(Object.keys(matter(out).data)).toEqual(["title"]);
    expect(out).not.toMatch(/^description:/m);
    expect(out).not.toMatch(/^tags:/m);
  });

  it("설명만 채우면 description 하나뿐이다", () => {
    const out = compose(sections, { title: "", description: "한 줄 설명" });
    expect(Object.keys(matter(out).data)).toEqual(["description"]);
    expect(out).not.toMatch(/^title:/m);
  });

  it("공백뿐인 칸은 빈 칸으로 본다", () => {
    const out = compose(sections, {
      title: "   ",
      description: "\t",
      tags: "  ,  , ",
    });
    expect(matter(out).data).toEqual({});
    expect(out).not.toMatch(/^(title|description|tags):/m);
  });

  it("값 앞뒤 공백은 다듬는다", () => {
    const out = compose(sections, { title: "  제목  ", description: " 설명 " });
    expect(matter(out).data).toEqual({ title: "제목", description: "설명" });
  });

  // CLAUDE.md 9번: 「빈 자리를 표시로 남기고 발행하지 않는다. 그대로 배포된다」
  it("빈 칸에 자리표시자(<제목> · <한 줄>)가 결과에 절대 나오지 않는다", () => {
    const cases = [
      {},
      { title: "", description: "", tags: "" },
      { title: "제목만" },
      { description: "설명만" },
      { tags: ["태그만"] },
      { title: "  ", description: "  ", tags: [] },
    ];
    for (const meta of cases) {
      for (const secs of [sections, []]) {
        const out = compose(secs, meta);
        const label = JSON.stringify(meta);
        expect(out, label).not.toContain("<제목>");
        expect(out, label).not.toContain("<한 줄>");
        // 꺾쇠로 감싼 자리표시자 꼴은 전부 금지 (본문에 꺾쇠가 없는 입력이다)
        expect(out, label).not.toMatch(/<[^>\n]+>/);
        // 값 자리에 빈 대괄호 `tags: []` 도 남기지 않는다
        expect(out, label).not.toMatch(/^tags:\s*\[\s*\]\s*$/m);
      }
    }
  });

  it("pubDatetime 이 어떤 경우에도 나오지 않는다", () => {
    // 발행 시점에 세션이 정한다. 미래 시각이 박히면 isPublishTimePassed 에
    // 걸려 production 빌드에서 조용히 빠진다 — 자리 자체를 만들지 않는다.
    const cases = [
      {},
      { title: "제목" },
      { title: "제목", description: "설명", tags: ["a", "b"] },
      { pubDatetime: "2099-01-01T00:00:00Z", title: "제목" }, // 넘겨도 쓰지 않는다
    ];
    for (const meta of cases) {
      const out = compose(sections, meta);
      expect(out, JSON.stringify(meta)).not.toMatch(/pubDatetime/i);
      expect(matter(out).data).not.toHaveProperty("pubDatetime");
    }
  });

  it("draft · featured 같은 발행 필드도 만들지 않는다", () => {
    const out = compose(sections, { title: "제목", description: "설명", tags: ["a"] });
    expect(Object.keys(matter(out).data).sort()).toEqual(["description", "tags", "title"]);
  });

  it("tags 가 비면 tags 줄이 없다 — 빈 배열 · 빈 문자열 · 없음", () => {
    for (const tags of [[], "", undefined, null, [""], ["  ", ""]]) {
      const out = compose(sections, { title: "제목", tags });
      expect(out, JSON.stringify(tags)).not.toMatch(/^tags:/m);
      expect(matter(out).data).not.toHaveProperty("tags");
    }
  });

  it("tags 를 배열로 받으면 목록으로 나온다", () => {
    const out = compose(sections, { title: "제목", tags: ["astro", "pandas"] });
    expect(matter(out).data.tags).toEqual(["astro", "pandas"]);
  });

  it("tags 를 쉼표 문자열로 받으면 쪼개고 공백과 빈 조각을 버린다", () => {
    const out = compose(sections, { title: "제목", tags: " astro ,pandas,, 트러블슈팅 ," });
    expect(matter(out).data.tags).toEqual(["astro", "pandas", "트러블슈팅"]);
  });

  it("배열 태그도 앞뒤 공백을 다듬고 빈 항목을 버린다", () => {
    const out = compose(sections, { title: "제목", tags: [" astro ", "", "  ", "pandas"] });
    expect(matter(out).data.tags).toEqual(["astro", "pandas"]);
  });

  it("한국어 태그가 그대로 살아남는다 — 번역하지도 로마자로 바꾸지도 않는다", () => {
    // 파이프라인이 태그를 verbatim 유지한다. 태그별 유입 통계가 이걸로 이어진다.
    const tags = ["트러블슈팅", "항만도메인", "임베디드 SW"];
    const fromArray = compose(sections, { title: "제목", tags });
    const fromString = compose(sections, { title: "제목", tags: tags.join(",") });
    expect(matter(fromArray).data.tags).toEqual(tags);
    expect(matter(fromString).data.tags).toEqual(tags);
    expect(fromArray).toContain("트러블슈팅");
    expect(fromArray).toContain("항만도메인");
  });

  it("YAML 이 다른 타입으로 읽을 태그(true · null · 숫자)도 문자열로 남는다", () => {
    // 따옴표 없이 쓰면 `- true` 는 불리언, `- 2026` 은 숫자가 된다
    const tags = ["true", "null", "2026", "1.5"];
    const out = compose(sections, { title: "제목", tags });
    expect(matter(out).data.tags).toEqual(tags);
  });

  it("같은 입력이면 같은 결과가 나온다 — 두 번 불러도 달라지지 않는다", () => {
    const meta = { title: "제목", description: "설명", tags: ["a", "b"] };
    expect(compose(sections, meta)).toBe(compose(sections, meta));
  });

  // 기대를 여기서 정한다: 메타가 전부 비면 울타리 `---` 자체를 만들지 않는다.
  // 빈 울타리(`---\n---`)는 쓸모없는 잔재고, 세션이 집었을 때 헷갈린다.
  it("메타가 전부 비면 frontmatter 울타리가 아예 없다", () => {
    for (const meta of [{}, { title: "", description: "", tags: [] }, undefined]) {
      const out = composeManuscript(sections, meta);
      expect(out, JSON.stringify(meta)).toBe("## T\n\n본문\n");
      expect(out).not.toMatch(/^---\s*$/m);
    }
  });
});

// ───────────────────────────────────────────────────────────────
// (3) 망가뜨리지 않는지
// ───────────────────────────────────────────────────────────────
describe("composeManuscript — 본문과 값을 망가뜨리지 않는다", () => {
  it("코드 블록이 그대로 살아남는다 — 안쪽 빈 줄과 들여쓰기 포함", () => {
    const body = [
      "이렇게 했다.",
      "",
      "```python",
      "def f():",
      "",
      "    return 1",
      "```",
      "",
      "끝.",
    ].join("\n");
    const out = compose([{ title: "T", body }], { title: "제목" });
    expect(bodyOf(out)).toBe(`## T\n\n${body}`);
    expect(out).toContain("```python\ndef f():\n\n    return 1\n```");
  });

  it("코드 블록 안에 `##` 줄이 있어도 그대로 둔다", () => {
    const body = "```md\n## 코드 안의 제목\n```";
    const out = compose([{ title: "", body }]);
    expect(out).toBe(`${body}\n`);
  });

  it("본문의 `##` 줄이 덩어리 제목으로 오해되지 않는다 — 제목을 덧붙이지도 지우지도 않는다", () => {
    const out = compose([{ title: "", body: "## 본문에 쓴 소제목\n내용" }]);
    expect(out).toBe("## 본문에 쓴 소제목\n내용\n");
    expect(out.match(/^## /gm)).toHaveLength(1);
  });

  it("제목 있는 덩어리 본문에 `##` 가 있으면 제목과 따로 둘 다 남는다", () => {
    const out = compose([
      { title: "바깥", body: "## 안쪽\n내용" },
      { title: "다음", body: "x" },
    ]);
    expect([...out.matchAll(/^## (.+)$/gm)].map(m => m[1])).toEqual(["바깥", "안쪽", "다음"]);
  });

  it("본문에 `---` 가 있어도 frontmatter 울타리와 섞이지 않는다", () => {
    const body = "위\n\n---\n\n아래";
    const out = compose([{ title: "T", body }], { title: "제목", tags: ["a"] });
    const parsed = matter(out);
    expect(parsed.data).toEqual({ title: "제목", tags: ["a"] });
    expect(parsed.content).toContain("위\n\n---\n\n아래");
    // 울타리 두 개 + 본문의 `---` 하나
    expect(out.match(/^---$/gm)).toHaveLength(3);
  });

  // 파서로 왕복시키는 요구는 걷어냈다. 이 파일은 Astro 가 읽지 않는다 —
  // src/scratch/posts/ 는 .gitignore 대상이고 콘텐츠 컬렉션(src/data/blog/)이
  // 아니다. 다음 세션이 글자로 읽을 뿐이라, 지켜야 할 성질은 본문이 결과에
  // 그대로 들어 있다는 것이다. (막으려면 빈 `---` 울타리가 원고 맨 위에 남는다.)
  it("본문이 `---` 로 시작해도 결과 문자열에 본문이 그대로 들어 있다", () => {
    const body = "---\nfoo: bar\n---\n본문";
    for (const meta of [{}, { title: "제목" }]) {
      const out = compose([{ title: "", body }], meta);
      expect(out, JSON.stringify(meta)).toContain(body);
    }
  });

  it("이미지 참조 `![](assets/…/x.png)` 의 경로가 그대로 남는다", () => {
    // 서버는 이미지를 옮기지 않는다. 세션이 옮기려면 경로가 원문 그대로여야 한다.
    const body = "화면은 이렇다.\n\n![](assets/20261031-메모/1730-ab12.png)\n\n![설명](assets/메모/x.webp)";
    const out = compose([{ title: "T", body }], { title: "제목" });
    expect(out).toContain("![](assets/20261031-메모/1730-ab12.png)");
    expect(out).toContain("![설명](assets/메모/x.webp)");
    expect(out).not.toContain("/assets/posts/");
  });

  it("본문의 HTML(영상 태그 한 줄)도 손대지 않는다", () => {
    const video =
      '<video src="/assets/posts/x/demo.mp4" autoplay muted loop playsinline width="100%"></video>';
    const out = compose([{ title: "T", body: video }]);
    expect(out).toContain(video);
  });

  it("본문에 꺾쇠 자리표시자 꼴이 있으면 작성자가 쓴 것이니 지우지 않는다", () => {
    // 자리표시자 금지는 구현이 만들어 넣는 것에 대한 규칙이다. 본문은 원문 그대로다.
    const out = compose([{ title: "T", body: "제네릭은 `Vec<T>` 로 쓴다" }]);
    expect(out).toContain("`Vec<T>`");
  });

  // 제목·설명에 YAML 특수문자가 들어간다. 따옴표 없이 `title: a: b` 로 쓰면
  // 파서가 던지거나 값이 잘린다. 값이 입력과 같게 읽혀야 한다.
  describe("YAML 특수문자가 들어간 값", () => {
    const sections = [{ title: "T", body: "본문" }];

    const risky = [
      ["콜론+공백", "파이썬: 첫걸음"],
      ["쉼표", "loc, iloc 차이"],
      ["콜론+쉼표", "결론: loc, iloc, at"],
      ["샵(주석으로 읽힘)", "C# 과 F# 비교"],
      ["공백 앞 샵", "포트 번호 #3000 번"],
      ["큰따옴표", '"따옴표"로 시작하는 제목'],
      ["작은따옴표", "it's 안 되는 이유"],
      ["안에 큰따옴표", '그가 "안 된다" 고 했다'],
      ["대괄호로 시작", "[WIP] 정리 중"],
      ["중괄호로 시작", "{중괄호} 시작"],
      ["별표로 시작", "*강조* 로 시작"],
      ["앰퍼샌드로 시작", "& 로 시작"],
      ["느낌표로 시작", "!중요 표시"],
      ["퍼센트로 시작", "%d 포맷"],
      ["물음표+공백", "? 로 시작하는 제목"],
      ["하이픈+공백으로 시작", "- 로 시작하는 제목"],
      ["백슬래시", "경로는 C:\\dev\\blog"],
      ["백틱", "`loc` 와 `iloc`"],
      ["@ 로 시작", "@dpcivl 의 메모"],
    ];

    for (const [label, value] of risky) {
      it(`제목에 ${label} 이 있어도 YAML 이 깨지지 않고 같은 값으로 읽힌다`, () => {
        const out = compose(sections, { title: value });
        expect(matter(out).data.title).toBe(value);
      });
    }

    it("설명에 콜론·쉼표·샵이 섞여도 같은 값으로 읽힌다", () => {
      const description = "원인: 인덱스, 정렬 # 둘 다 확인";
      const out = compose(sections, { title: "제목", description });
      expect(matter(out).data.description).toBe(description);
    });

    it("태그 항목에 쉼표·콜론이 있어도(배열 입력) 하나의 태그로 읽힌다", () => {
      const tags = ["a, b", "c: d", "# e"];
      const out = compose(sections, { title: "제목", tags });
      expect(matter(out).data.tags).toEqual(tags);
    });

    it("YAML 특수문자 때문에 본문이 밀리거나 사라지지 않는다", () => {
      const out = compose(sections, { title: "결론: loc, iloc", description: "a: b" });
      expect(bodyOf(out)).toBe("## T\n\n본문");
    });

    it("한국어 제목이 이스케이프(\\uXXXX)로 바뀌지 않는다", () => {
      // JSON.stringify 로 감싸면 안전하지만 한글이 그대로여야 사람이 읽는다
      const out = compose(sections, { title: "파이썬: 첫걸음", tags: ["한글태그"] });
      expect(out).toContain("파이썬: 첫걸음");
      expect(out).not.toMatch(/\\u[0-9a-fA-F]{4}/);
    });
  });
});

// ───────────────────────────────────────────────────────────────
// (4) slug 규칙 — 화면이 보내기 전에 걸러야 서버와 어긋나지 않는다
// ───────────────────────────────────────────────────────────────
// 서버 규칙: ^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$  (2~80자)
// compose.js 가 export 한 함수 가운데 이름에 slug 가 들어간 것을 찾는다.
const slugEntry = Object.entries(composeModule).find(
  ([name, value]) => typeof value === "function" && /slug/i.test(name)
);
const slugCheck = slugEntry?.[1];

// 불리언을 돌려주면 그대로, 오류 문자열/null 을 돌려주면 「오류 없음」을 통과로 본다
const accepts = value => {
  const r = slugCheck(value);
  return typeof r === "boolean" ? r : r == null || r === "";
};

describe.skipIf(!slugCheck)(
  `slug 검사 (${slugEntry?.[0] ?? "compose.js 가 slug 검사를 내보내지 않음"})`,
  () => {
    it.each(["ab", "a1", "9z", "my-post", "a-b-c", "2026-10-31-note", "loc-vs-iloc", "a--b"])(
      "허용한다: %s",
      s => {
        expect(accepts(s)).toBe(true);
      }
    );

    it("길이 경계 — 2자와 80자는 허용하고 1자와 81자는 거부한다", () => {
      expect(accepts("a".repeat(2))).toBe(true);
      expect(accepts("a".repeat(80))).toBe(true);
      expect(accepts("a")).toBe(false);
      expect(accepts("a".repeat(81))).toBe(false);
    });

    it("1글자는 서버처럼 거부한다 (숫자 한 글자도)", () => {
      expect(accepts("a")).toBe(false);
      expect(accepts("7")).toBe(false);
    });

    it.each([
      ["빈 문자열", ""],
      ["대문자", "My-Post"],
      ["밑줄", "my_post"],
      ["공백", "my post"],
      ["슬래시", "a/b"],
      ["경로 탈출", "../etc"],
      ["앞 하이픈", "-ab"],
      ["뒤 하이픈", "ab-"],
      ["한글", "한글제목"],
      ["확장자", "post.md"],
      ["점", "a.b"],
      ["뒤 줄바꿈", "ab\n"],
      ["앞 공백", " ab"],
      ["뒤 공백", "ab "],
    ])("거부한다: %s", (_label, s) => {
      expect(accepts(s)).toBe(false);
    });

    it("문자열이 아닌 값(undefined · null · 숫자)은 던지지 않고 거부한다", () => {
      for (const v of [undefined, null, 12]) {
        expect(() => slugCheck(v)).not.toThrow();
        expect(accepts(v)).toBe(false);
      }
    });
  }
);
