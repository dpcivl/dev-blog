import type { CollectionEntry } from "astro:content";
import postFilter from "./postFilter";
import { SITE } from "@/config";

export interface PublishActivity {
  /** 열 우선(주 단위 7일씩) 일별 발행 편수. 길이 = weeks * 7 */
  data: number[];
  /** 각 셀에 대응하는 날짜 (YYYY-MM-DD). data 와 같은 순서/길이 */
  dates: string[];
  /** 창 안의 총 발행 편수 */
  total: number;
  weeks: number;
  firstDate: string;
  lastDate: string;
  /**
   * 발행이 있었던 날짜만 담은 맵 (YYYY-MM-DD → 편수).
   * 클라이언트가 "오늘" 기준으로 창을 다시 계산할 때 쓴다.
   * 정적 사이트라 빌드 시점 날짜가 박제되므로, 이 맵이 없으면
   * 배포를 안 한 동안 잔디가 멈춘 것처럼 보인다.
   */
  counts: Record<string, number>;
}

/** SITE.timezone 기준 YYYY-MM-DD 로 포맷 (UTC 발행 시각의 날짜 밀림 방지) */
function localDateKey(d: Date): string {
  // en-CA 는 YYYY-MM-DD 형식을 준다
  return d.toLocaleDateString("en-CA", { timeZone: SITE.timezone });
}

/**
 * 발행 활동 히트맵 데이터를 만든다.
 *
 * - 주 시작 요일은 일요일. 마지막 열은 오늘이 속한 주.
 * - `days` 만큼의 기간을 주 단위로 올림해서 채운다 (기본 90일 → 13주 = 91칸).
 * - 예약 발행 · draft 는 postFilter 로 제외.
 */
export function getPublishActivity(
  posts: CollectionEntry<"blog">[],
  days = 90
): PublishActivity {
  const published = posts.filter(postFilter);

  // 날짜별 발행 편수
  const counts: Record<string, number> = {};
  for (const post of published) {
    const key = localDateKey(new Date(post.data.pubDatetime));
    counts[key] = (counts[key] ?? 0) + 1;
  }

  // 오늘이 속한 주의 토요일(마지막 칸)까지 채운다
  const today = new Date(`${localDateKey(new Date())}T00:00:00`);
  const lastCell = new Date(today);
  lastCell.setDate(lastCell.getDate() + (6 - lastCell.getDay()));

  const weeks = Math.max(1, Math.ceil(days / 7));
  const cellCount = weeks * 7;
  const start = new Date(lastCell);
  start.setDate(start.getDate() - (cellCount - 1));

  const data: number[] = [];
  const dates: string[] = [];
  let total = 0;
  for (let i = 0; i < cellCount; i++) {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    const key = localDateKey(day);
    const n = counts[key] ?? 0;
    data.push(n);
    dates.push(key);
    total += n;
  }

  return {
    data,
    dates,
    total,
    weeks,
    firstDate: dates[0] ?? "",
    lastDate: dates[dates.length - 1] ?? "",
    counts,
  };
}

export default getPublishActivity;
