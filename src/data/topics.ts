import { SERIES } from "@/data/series";

/**
 * 홈 입력창이 먼저 뒤지는 주제 표.
 *
 * Pagefind 는 블로그 글만 색인한다. 포트폴리오 페이지는 `noIndex` 와
 * `data-pagefind-ignore` 로 일부러 빼뒀기 때문에(구글 결과에 안 띄우려는 것),
 * "julgot" 을 쳐도 검색으로는 안 잡힌다.
 *
 * 그래서 별칭 표를 따로 둔다. 인덱스의 비공개 성격을 그대로 두면서도
 * 입력창에서는 답이 나온다. 요약은 손으로 적는다 — 포트폴리오 frontmatter 의
 * description 에서 사실만 옮기고, 없는 말은 만들지 않는다.
 *
 * 시리즈는 src/data/series.ts 를 그대로 끌어다 쓴다. 두 군데 적으면 갈라진다.
 */
export interface Topic {
  id: string;
  kind: "포트폴리오" | "시리즈" | "페이지" | "태그";
  title: string;
  summary: string;
  href: string;
  /** 카드 우측에 붙는 짧은 부가 정보 (기간 · 상태 등) */
  meta?: string;
  /** 이 말이 들어오면 이 주제를 띄운다. 전부 소문자 · 공백 없이 적을 것 */
  aliases: string[];
  /** 카드 아래에 붙는 목록. "최신 글" · "포트폴리오 전체" 처럼 답이 목록인 질문용 */
  items?: { title: string; desc?: string; href: string }[];
}

const PORTFOLIO: Topic[] = [
  {
    id: "julgot",
    kind: "포트폴리오",
    title: "줄곧 (Julgot) — 성취 전용 일기",
    summary:
      "'1등 아니면 0점' 패턴을 거꾸로 뒤집어, 잘한 것만 기록하는 일기 앱. Next.js · PWA · Supabase 로 1인 개발했고 2026-07-13 에 웹 PWA v0.3.2 를 배포했다.",
    href: "/portfolio#julgot",
    meta: "2026-06 ~ · 운영 중",
    aliases: ["julgot", "줄곧", "일기", "일기앱", "성취", "pwa"],
  },
  {
    id: "presearch",
    kind: "포트폴리오",
    title: "presearch — 검색량이 튀었는데 주가는 조용한 종목 찾기",
    summary:
      "국내 중형주 중 검색량이 급증했지만 주가는 아직 안 움직인 것을 골라내는 워치리스트. FastAPI · BigQuery · Cloud Run 으로 수집·분석하고 React 로 차트를 그린다.",
    href: "/portfolio#presearch",
    meta: "2026-07 ~ · 진행 중",
    aliases: ["presearch", "프리서치", "주식", "종목", "워치리스트", "검색량"],
  },
  {
    id: "blog-infra",
    kind: "포트폴리오",
    title: "개인 블로그 인프라 (parkhyo.in)",
    summary:
      "지금 보고 계신 사이트 자체. AstroPaper 에서 출발했지만 표현 계층은 직접 교체했고, 2026-09 에 Vercel 에서 AWS Lightsail 자체 운영으로 옮겼다.",
    href: "/portfolio#blog-infra",
    meta: "2026-05 ~ · 운영 중",
    aliases: [
      "블로그",
      "블로그인프라",
      "parkhyo",
      "parkhyo.in",
      "astro",
      "이블로그",
      "lightsail",
      "인프라",
    ],
  },
  {
    id: "prev-job",
    kind: "포트폴리오",
    title: "이전 직장 — 임베디드 HW → SW 전환 트랙",
    summary:
      "환경 계측 IoT · 엣지 AI · IoT 통신 R&D 를 한 회사에서 HW 에서 SW 로 옮겨가며 담당했다. 강우량계 데이터로거, 화재 감지 엣지 AI, LoRa 적합성 테스트 등 5개 프로젝트.",
    href: "/portfolio#prev-job",
    meta: "2022-10 ~ 2025-12",
    aliases: [
      "이전직장",
      "전직장",
      "임베디드",
      "경력",
      "커리어",
      "강우량계",
      "엣지ai",
      "lora",
    ],
  },
];

const PAGES: Topic[] = [
  {
    // 요약은 /about 에 작성자가 직접 쓴 문장을 그대로 옮긴다.
    // 자기소개 카피를 내가 지어내지 않는다 (CLAUDE.md 지침 4번).
    id: "about",
    kind: "페이지",
    title: "박효인 (Park Hyoin)",
    summary:
      "임베디드 HW 1년 / 임베디드 SW 2년 2개월 의 실무 경험과 엣지 AI 프로젝트 경험이 있습니다. 문과 출신으로 임베디드 하드웨어 설계로 커리어를 시작해 C · Python 을 독학하고 임베디드 SW 로 옮겨갔습니다.",
    href: "/about",
    aliases: [
      "소개",
      "about",
      "누구",
      "자기소개",
      "프로필",
      "박효인",
      "parkhyoin",
      "hyoin",
      "작성자",
      "주인장",
    ],
  },
  {
    id: "archives",
    kind: "페이지",
    title: "전체 글",
    summary: "발행한 글을 날짜순으로 모아 본다.",
    href: "/archives",
    aliases: ["전체글", "아카이브", "archives", "목록", "전체"],
  },
];

/** 시리즈는 series.ts 를 그대로 옮겨 담는다 */
const SERIES_TOPICS: Topic[] = SERIES.map(s => ({
  id: `series-${s.id}`,
  kind: "시리즈" as const,
  title: s.title,
  summary: s.description,
  href: `/series#${s.id}`,
  aliases: [s.id, s.tag, s.title].map(norm),
}));

export const TOPICS: Topic[] = [...PORTFOLIO, ...SERIES_TOPICS, ...PAGES];

/** 비교용 정규화 — 글자와 숫자만 남긴다. "parkhyo.in" 과 "parkhyo in" 이 같아진다 */
export function norm(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/** 질의를 낱말로 쪼갠다. 조사를 떼고 두 글자 이상만 남긴다 */
export function tokens(query: string): string[] {
  return query
    .split(/[\s,.?!·…"'\u201c\u201d\u2018\u2019()[\]]+/)
    .map(w => w.replace(/[은는이가을를의에서로와과도만]$/u, "") || w)
    .map(norm)
    .filter(w => w.length >= 2);
}

/**
 * 입력한 말과 맞는 주제를 찾는다.
 *
 * 낱말 단위까지 보는 게 핵심이다. "이 블로그는 어떤 글로 구성되어 있나요?" 처럼
 * 문장으로 물으면 통째로는 어떤 별칭과도 안 맞는다. 조사를 떼고 낱말로 쪼개야
 * "구성되어" 가 「구성」 에 닿는다.
 *
 * 점수: 전체가 별칭과 똑같으면 3, 낱말 하나가 똑같으면 2, 어느 쪽이든 포함하면 1.
 * 같은 점수면 더 긴 별칭이 맞은 쪽을 앞에 둔다 — 우연히 걸린 짧은 말보다 낫다.
 */
export function findTopics(query: string, limit = 3): Topic[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const words = tokens(query);

  const scored: { t: Topic; score: number; len: number }[] = [];

  for (const t of TOPICS) {
    const keys = [norm(t.id), norm(t.title), ...t.aliases.map(norm)].filter(
      k => k.length >= 2
    );
    // 점수와 길이를 "가장 잘 맞은 별칭 하나" 기준으로 같이 잡는다.
    // 따로 최대값을 취하면, 약하게 걸린 긴 별칭의 길이가 강하게 걸린
    // 짧은 별칭에 얹혀서 순위가 뒤집힌다.
    let score = 0;
    let len = 0;
    for (const k of keys) {
      let s = 0;
      if (k === q) s = 3;
      else if (words.includes(k)) s = 2;
      else if (k.includes(q) || q.includes(k)) s = 1;
      else if (words.some(w => w.includes(k) || k.includes(w))) s = 1;
      if (s > score || (s === score && s > 0 && k.length > len)) {
        score = s;
        len = k.length;
      }
    }
    if (score > 0) scored.push({ t, score, len });
  }

  scored.sort((a, b) => b.score - a.score || b.len - a.len);
  // 1등보다 확실히 약한 것은 버린다. 곁다리 카드가 답을 흐린다
  const top = scored[0]?.score ?? 0;
  return scored
    .filter(x => x.score >= top - 1 && !(top === 3 && x.score < 3))
    .slice(0, limit)
    .map(x => x.t);
}
