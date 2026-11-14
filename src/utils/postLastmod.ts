import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const BLOG_PATH = "src/data/blog";
const LANGS = ["ko", "en"] as const;

/**
 * 글 URL 경로(`/posts/<slug>/` · `/en/posts/<slug>/`) → 마지막 수정 시각.
 *
 * sitemap 의 `<lastmod>` 를 채우는 데 쓴다. 없으면 크롤러가 어떤 글이 새로 생기거나
 * 바뀌었는지 알 수 없어서 다시 수집하는 순서가 밀린다 (2026-11-14 에 504개 URL 중
 * lastmod 가 0개였고, 네이버 로봇은 14일간 글을 4번만 가져갔다).
 *
 * 값은 frontmatter 의 `modDatetime ?? pubDatetime` 이다. git 커밋 시각은 쓰지 않는다 —
 * CI 의 checkout 이 얕아서 모든 글이 같은 시각이 되고, 그건 없느니만 못한 값이다.
 *
 * 글이 아닌 페이지(홈 · 태그 · 목록)는 넣지 않는다. 정확한 값이 없는데 오늘 날짜를
 * 박으면 매 배포마다 "다 바뀌었다" 고 말하는 셈이 된다.
 *
 * astro.config.ts 는 `astro:content` 를 못 쓰므로 마크다운을 직접 읽는다
 * (utils/thinTags.ts 와 같은 이유).
 */
export function getPostLastmod(): Map<string, Date> {
  const result = new Map<string, Date>();

  for (const lang of LANGS) {
    const dir = path.resolve(process.cwd(), BLOG_PATH, lang);
    if (!fs.existsSync(dir)) continue;

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".md") || file.startsWith("_")) continue;

      const { data } = matter(fs.readFileSync(path.join(dir, file), "utf8"));
      const date = new Date(data.modDatetime ?? data.pubDatetime);
      if (Number.isNaN(date.getTime())) continue;

      const slug = file.slice(0, -".md".length).toLowerCase();
      const prefix = lang === "en" ? "/en/posts/" : "/posts/";
      result.set(`${prefix}${slug}/`, date);
    }
  }

  return result;
}
