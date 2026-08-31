import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { slugifyStr } from "./slugify";
import { SITE } from "../config";

const BLOG_PATH = "src/data/blog";
const LANGS = ["ko", "en"] as const;

type Lang = (typeof LANGS)[number];

/**
 * 언어별로 "글이 minPosts 편 미만인 태그" 의 slug 집합을 만든다.
 *
 * 태그 페이지는 계속 생성하되(사이트 안에서는 탐색에 쓰인다) sitemap 에서만 빼기
 * 위한 목록이다. astro.config.ts 의 sitemap filter 가 이걸 쓴다.
 *
 * astro.config.ts 는 `astro:content` 를 못 쓰므로 마크다운을 직접 읽는다.
 * 판정 기준은 utils/postFilter.ts 와 같아야 한다 (draft 제외 + 발행 시각 경과).
 */
export function getThinTagSlugs(minPosts = 2): Record<Lang, Set<string>> {
  const result = { ko: new Set<string>(), en: new Set<string>() };

  for (const lang of LANGS) {
    const dir = path.resolve(process.cwd(), BLOG_PATH, lang);
    if (!fs.existsSync(dir)) continue;

    const counts = new Map<string, number>();

    for (const file of fs.readdirSync(dir)) {
      // content.config.ts 의 glob 패턴 `**/[^_]*.md` 와 동일하게 `_` 접두 파일 제외
      if (!file.endsWith(".md") || file.startsWith("_")) continue;

      const { data } = matter(fs.readFileSync(path.join(dir, file), "utf8"));
      if (data.draft) continue;

      const pub = new Date(data.pubDatetime).getTime();
      if (Date.now() <= pub - SITE.scheduledPostMargin) continue;

      for (const tag of data.tags ?? []) {
        const slug = slugifyStr(String(tag));
        counts.set(slug, (counts.get(slug) ?? 0) + 1);
      }
    }

    for (const [slug, count] of counts) {
      if (count < minPosts) result[lang].add(slug);
    }
  }

  return result;
}
