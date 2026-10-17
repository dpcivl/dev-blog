import { getCollection } from "astro:content";
import getPostsByTag from "./getPostsByTag";
import getSortedPosts from "./getSortedPosts";
import getUniqueTags from "./getUniqueTags";
import { filterByLang } from "./i18n";
import { SITE } from "@/config";

/**
 * 한국어 페이지의 영어판 주소. 영어판이 없으면 가장 가까운 영어 페이지로 (2026-10-18~).
 *
 * 전에는 주소 앞에 /en 만 붙였다. 영어 번역을 멈춘 뒤로 한국어에만 있는 페이지가
 * 늘어서 — 시리즈 · 플레이그라운드 · 검색 · 영어 글이 없는 태그 · 영어 목록보다 뒤쪽
 * 페이지 — EN 버튼 49개가 없는 주소를 가리키고 있었다.
 *
 * 영어판이 있는지는 영어 페이지들이 getStaticPaths 에서 쓰는 것과 같은 함수 · 같은
 * 기준으로 계산한다. 따로 셈하면 페이지 생성과 버튼이 어긋난다.
 *   목록  src/pages/en/posts/[...page].astro    — 초안 제외 → getSortedPosts
 *   태그  src/pages/en/tags/[tag]/[...page].astro — getUniqueTags · getPostsByTag
 *
 * 글 상세는 여기로 오지 않는다 — PostDetails 가 짝 글을 직접 찾아 넘긴다.
 */
export async function enCounterpart(pathname: string): Promise<string> {
  const p = pathname.endsWith("/") ? pathname : `${pathname}/`;
  if (p === "/") return "/en/";
  if (p === "/about/") return "/en/about/";
  if (p === "/tags/") return "/en/tags/";

  const lastPage = (count: number) =>
    Math.max(1, Math.ceil(count / SITE.postPerPage));

  const list = p.match(/^\/posts\/(?:(\d+)\/)?$/);
  if (list) {
    const n = Number(list[1] ?? 1);
    const posts = filterByLang(
      await getCollection("blog", ({ data }) => !data.draft),
      "en"
    );
    const last = lastPage(getSortedPosts(posts).length);
    return n > 1 && n <= last ? `/en/posts/${n}/` : "/en/posts/";
  }

  const tagPage = p.match(/^\/tags\/([^/]+)\/(?:(\d+)\/)?$/);
  if (tagPage) {
    const [, raw, num] = tagPage;
    const tag = safeDecode(raw);
    const posts = filterByLang(await getCollection("blog"), "en");
    if (!getUniqueTags(posts).some(t => t.tag === tag)) return "/en/tags/";
    const n = Number(num ?? 1);
    const last = lastPage(getPostsByTag(posts, tag).length);
    return n > 1 && n <= last ? `/en/tags/${raw}/${n}/` : `/en/tags/${raw}/`;
  }

  // 시리즈 · 플레이그라운드 · 검색 · 포트폴리오 · 404 등 — 영어판이 없다
  return "/en/";
}

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
