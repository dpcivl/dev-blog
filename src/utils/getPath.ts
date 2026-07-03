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

  const basePath = includeBase
    ? isEnglish
      ? "/en/posts"
      : "/posts"
    : "";

  // slug = last segment of id
  const blogId = id.split("/");
  const slug = blogId.length > 0 ? blogId.slice(-1) : blogId;

  if (!pathSegments || pathSegments.length < 1) {
    return [basePath, slug].join("/");
  }

  return [basePath, ...pathSegments, slug].join("/");
}
