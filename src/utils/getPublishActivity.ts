import type { CollectionEntry } from "astro:content";
import postFilter from "./postFilter";
import { SITE } from "@/config";

export interface PublishActivity {
  /** 열 우선(주 단위 7일씩) 일별 발행 편수. 길이 = weeks * 7 */
  data: number[];
  /** 각 셀에 대응하는 날짜 (YYYY-MM-DD). data 와 같은 순서/길이 */
  dates: string[];
  /** 집계에 포함된 총 발행 편수 */
  total: number;
  weeks: number;
  firstDate: string;
  lastDate: string;
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
 * - `weeks` 를 넘기지 않으면 첫 발행일이 포함되는 주부터 오늘까지로 자동 산정한다.
 *   (블로그 시작이 2026-05-05 라 52주로 고정하면 대부분이 빈칸으로 남는다)
 * - 예약 발행 · draft 는 postFilter 로 제외.
 */
export function getPublishActivity(
  posts: CollectionEntry<"blog">[],
  weeks?: number
): PublishActivity {
  const published = posts.filter(postFilter);

  // 날짜별 발행 편수
  const counts = new Map<string, number>();
  for (const post of published) {
    const key = localDateKey(new Date(post.data.pubDatetime));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // 오늘이 속한 주의 토요일(마지막 칸)까지 채운다
  const today = new Date(`${localDateKey(new Date())}T00:00:00`);
  const lastCell = new Date(today);
  lastCell.setDate(lastCell.getDate() + (6 - lastCell.getDay()));

  let resolvedWeeks = weeks;
  if (!resolvedWeeks) {
    const keys = [...counts.keys()].sort();
    const firstKey = keys[0];
    if (!firstKey) {
      resolvedWeeks = 12;
    } else {
      const first = new Date(`${firstKey}T00:00:00`);
      // 첫 발행일이 속한 주의 일요일
      const firstSunday = new Date(first);
      firstSunday.setDate(firstSunday.getDate() - firstSunday.getDay());
      const days =
        Math.round(
          (lastCell.getTime() - firstSunday.getTime()) / (24 * 60 * 60 * 1000)
        ) + 1;
      resolvedWeeks = Math.max(1, Math.ceil(days / 7));
    }
  }

  const cellCount = resolvedWeeks * 7;
  const start = new Date(lastCell);
  start.setDate(start.getDate() - (cellCount - 1));

  const data: number[] = [];
  const dates: string[] = [];
  let total = 0;
  for (let i = 0; i < cellCount; i++) {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    const key = localDateKey(day);
    const n = counts.get(key) ?? 0;
    data.push(n);
    dates.push(key);
    total += n;
  }

  return {
    data,
    dates,
    total,
    weeks: resolvedWeeks,
    firstDate: dates[0] ?? "",
    lastDate: dates[dates.length - 1] ?? "",
  };
}

export default getPublishActivity;
