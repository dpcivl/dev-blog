import type { CollectionEntry } from "astro:content";
import postFilter from "@/utils/postFilter";

export interface SeriesDef {
  id: string;
  title: string;
  description: string;
  /** 이 시리즈에 속하는 글을 판별하는 태그 */
  tag: string;
}

/**
 * 시리즈 정의 — 새 시리즈 추가 시 여기에 항목 추가.
 * /series 페이지와 홈의 시리즈 타일 · 글 목록 라벨이 모두 이 목록을 공유한다.
 */
export const SERIES: SeriesDef[] = [
  {
    id: "llm",
    title: "LLM 공부 일지",
    description:
      'Claude API · RAG · MCP · Eval · LangGraph — LLM 을 실제로 만지면서 정리한 학습 노트. 문법 훑기가 아니라 "안 되는 것부터 만나서 이해하기" 방향.',
    tag: "LLM공부",
  },
  {
    id: "backend",
    title: "백엔드 공부 일지",
    description:
      "자바 · Spring Boot · 상용화에 필요한 백엔드 감각을 채우는 학습 노트. Python / C++ 배경에서 시작해 계약성 · 서비스 가용성 · 빌드 도구 순으로 확장 중.",
    tag: "백엔드공부",
  },
  {
    id: "agv",
    title: "AGV 자율주행 사이드 프로젝트 일지",
    description:
      "라즈베리파이 5 + STM32 + RS485 조합으로 자율주행 로봇을 만드는 과정의 진행 일지. 프레임 조립 → ROS2 셋업 → 노드 작성 → 통신 → 모터 제어 순으로 시리즈화.",
    tag: "AGV",
  },
  {
    id: "vocab",
    title: "바이브코딩을 위한 용어 정리",
    description:
      "AI에게 정확히 시키기 위한 영역별 어휘 정리. 본문 + 인터랙티브 playground 패턴으로 진행 중.",
    tag: "용어정리",
  },
  {
    id: "k-newdeal",
    title: "K-뉴딜 아카데미 — 스마트항만 · 해양물류 데이터 실무",
    description:
      "SK플래닛 부산 스마트항만 · 해양물류 데이터 실무 과정에서 들은 강의 기록. 데이터 분석을 하려면 도메인부터 알아야 한다는 말에서 출발해 항만의 구조와 수출입 흐름을 잡고, 데이터의 이해와 pandas 실습으로 이어간다.",
    tag: "K-뉴딜아카데미",
  },
  {
    id: "programmers",
    title: "프로그래머스 SQL 풀이",
    description:
      "SQL 을 실제로 쓰면서 배우려고 프로그래머스 문제를 하나씩 푼 기록. 정답 코드보다 그 문제에서 처음 알게 된 절 · 함수와 막혔던 지점을 남긴다.",
    tag: "프로그래머스",
  },
];

export interface SeriesSummary extends SeriesDef {
  count: number;
  firstDate?: Date;
  lastDate?: Date;
}

/**
 * 각 시리즈의 글 수 · 기간을 집계한다. 글이 0편인 시리즈는 제외.
 * 홈 지표와 시리즈 타일이 같은 값을 쓰도록 한 곳에서 계산한다.
 */
export function getSeriesSummary(
  posts: CollectionEntry<"blog">[]
): SeriesSummary[] {
  const published = posts.filter(postFilter);

  return SERIES.map(s => {
    const matched = published
      .filter(p => p.data.tags?.includes(s.tag))
      .sort(
        (a, b) =>
          new Date(a.data.pubDatetime).getTime() -
          new Date(b.data.pubDatetime).getTime()
      );
    return {
      ...s,
      count: matched.length,
      firstDate: matched[0]?.data.pubDatetime,
      lastDate: matched[matched.length - 1]?.data.pubDatetime,
    };
  }).filter(s => s.count > 0);
}

/**
 * 글 한 편이 속한 시리즈를 찾는다 (첫 매치). 없으면 undefined.
 * 홈 글 목록의 우측 라벨에 사용 — blog frontmatter 에 series 필드가 없어
 * 태그 매핑으로 대신한다.
 */
export function findSeriesOf(
  post: CollectionEntry<"blog">
): SeriesDef | undefined {
  return SERIES.find(s => post.data.tags?.includes(s.tag));
}
