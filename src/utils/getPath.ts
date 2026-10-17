import { BLOG_PATH } from "@/content.config";
import { slugifyStr } from "./slugify";

const LANG_PREFIXES = new Set(["ko", "en"]);

/**
 * Get full path of a blog post
 * @param id - id of the blog post (aka slug, may include `ko/` or `en/` prefix)
 * @param filePath - the blog post full file location
 * @param includeBase - whether to include `/posts` in return value (Korean) or `/en/posts` (English)
 * @returns blog post path
 */
export function getPath(
  id: string,
  filePath: string | undefined,
  includeBase = true
) {
  const rawSegments = filePath
    ?.replace(BLOG_PATH, "")
    .split("/")
    .filter(path => path !== "")
    .filter(path => !path.startsWith("_"))
    .slice(0, -1); // remove filename

  // Detect language from first segment (ko / en)
  const isEnglish = rawSegments?.[0] === "en";

  const pathSegments = rawSegments
    ?.filter(segment => !LANG_PREFIXES.has(segment)) // strip language prefix
    .map(segment => slugifyStr(segment));

  const basePath = includeBase ? (isEnglish ? "/en/posts" : "/posts") : "";

  // slug = last segment of id
  const blogId = id.split("/");
  const slug = blogId.length > 0 ? blogId.slice(-1) : blogId;

  if (!pathSegments || pathSegments.length < 1) {
    return [basePath, slug].join("/");
  }

  return [basePath, ...pathSegments, slug].join("/");
}

/**
 * 글로 가는 링크 주소 — 끝에 / 를 붙인다 (2026-10-18~).
 *
 * 서버(nginx)는 / 없는 주소를 / 붙은 주소로 301 넘긴다. 링크에 처음부터 붙이면
 * 클릭마다 생기던 왕복 한 번이 없어지고, 비콘이 넘김에 기대지 않고도 글 주소
 * (/posts/<글>/) 로 나간다. 검색엔진에 주는 언어 짝(hreflang)도 대표 주소
 * (canonical, / 있음)와 같아진다.
 *
 * getPath 자체는 그대로 둔다 — OG 이미지 경로(`…/index.png`) · 라우트 이름에도
 * 쓰여서 / 를 붙이면 거기가 깨진다.
 */
export function getPostHref(id: string, filePath: string | undefined) {
  return `${getPath(id, filePath)}/`;
}
