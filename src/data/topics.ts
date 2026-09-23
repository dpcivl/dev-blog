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
  kind: "포트폴리오" | "시리즈" | "페이지";
  title: string;
  summary: string;
  href: string;
  /** 카드 우측에 붙는 짧은 부가 정보 (기간 · 상태 등) */
  meta?: string;
  /** 이 말이 들어오면 이 주제를 띄운다. 전부 소문자 · 공백 없이 적을 것 */
  aliases: string[];
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
    id: "portfolio",
    kind: "페이지",
    title: "포트폴리오",
    summary:
      "직접 만들고 배포한 것들을 모아둔 페이지. 접속 가능한 사이트가 있는 프로젝트만 올린다.",
    href: "/portfolio",
    aliases: [
      "포트폴리오",
      "portfolio",
      "프로젝트",
      "만든것",
      "작업물",
      "만든거",
    ],
  },
  {
    id: "about",
    kind: "페이지",
    title: "소개",
    summary: "박효인이 누구인지, 무엇에 관심이 있는지.",
    href: "/about",
    aliases: ["소개", "about", "누구", "자기소개", "프로필"],
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

/**
 * 입력한 말과 맞는 주제를 찾는다.
 *
 * 완전히 같은 것을 먼저 주고, 없으면 별칭을 포함하는 것까지 본다.
 * 두 글자 미만은 아무것도 안 준다 — 한 글자로는 뭐든 걸린다.
 */
export function findTopics(query: string, limit = 3): Topic[] {
  const q = norm(query);
  if (q.length < 2) return [];

  const exact: Topic[] = [];
  const partial: Topic[] = [];

  for (const t of TOPICS) {
    const keys = [norm(t.id), norm(t.title), ...t.aliases.map(norm)];
    if (keys.some(k => k === q)) exact.push(t);
    else if (keys.some(k => k.includes(q) || q.includes(k))) partial.push(t);
  }

  return [...exact, ...partial].slice(0, limit);
}
