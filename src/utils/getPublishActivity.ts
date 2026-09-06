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
 * - 마지막 칸은 **오늘**. 아직 오지 않은 날짜는 그리지 않는다 (마지막 열이 짧아진다).
 * - 시작일은 `today - (days-1)` 을 그 주 일요일까지 당긴 날 — 첫 열은 꽉 찬 한 주가 되고,
 *   결과적으로 `days` 이상을 덮는다.
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

  const today = new Date(`${localDateKey(new Date())}T00:00:00`);
  const lastCell = today;

  // days 일 전으로 간 뒤 그 주 일요일까지 당긴다
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  start.setDate(start.getDate() - start.getDay());

  const cellCount =
    Math.round((lastCell.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) +
    1;
  const weeks = Math.ceil(cellCount / 7);

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
