// Internal link checker for blog posts.
// Scans src/data/blog/**/*.md and reports broken:
//   - post links   (/posts/<slug>, /en/posts/<slug>)
//   - anchor links (/posts/<slug>#<anchor>)
//   - asset paths  (/assets/...)
//   - tag links    (/tags/<slug>, /en/tags/<slug>)
//   - route links  (/about, /portfolio, /series, /playground, ...)
// External links (http/https) are skipped — see check-links-external.mjs.

import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import GithubSlugger from "github-slugger";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, "$1"));
const BLOG_DIR = path.join(ROOT, "src", "data", "blog");
const PUBLIC_DIR = path.join(ROOT, "public");

// Routes that exist as pages (not derived from content collections)
const KNOWN_ROUTES = new Set([
  "/",
  "/about",
  "/about/",
  "/archives",
  "/archives/",
  "/portfolio",
  "/portfolio/",
  "/playground",
  "/playground/",
  "/series",
  "/series/",
  "/rss.xml",
  "/en",
  "/en/",
  "/en/about",
  "/en/about/",
]);

const MD_LINK = /\[([^\]]*)\]\(([^)]+)\)/g;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

function extractLinks(text) {
  const links = [];
  const rx = new RegExp(MD_LINK.source, MD_LINK.flags);
  let m;
  while ((m = rx.exec(text)) !== null) {
    links.push({ text: m[1], url: m[2].trim() });
  }
  return links;
}

// Load all blog posts, indexed by lang + slug.
async function loadPosts() {
  const files = await walk(BLOG_DIR);
  const posts = new Map(); // key: `${lang}/${slug}` → { file, data, body, headingIds }
  for (const file of files) {
    const rel = path.relative(BLOG_DIR, file);
    const parts = rel.split(path.sep);
    if (parts.length < 2) continue;
    const lang = parts[0]; // ko | en
    const base = path.basename(file, ".md");
    if (base.startsWith("_")) continue; // hidden
    const raw = await readFile(file, "utf8");
    const parsed = matter(raw);
    if (parsed.data?.draft === true) continue;
    const slugger = new GithubSlugger();
    const headingIds = new Set();
    for (const line of parsed.content.split("\n")) {
      const h = /^#{1,6}\s+(.+?)\s*$/.exec(line);
      if (h) headingIds.add(slugger.slug(h[1]));
    }
    posts.set(`${lang}/${base}`, {
      file,
      lang,
      slug: base,
      data: parsed.data,
      body: parsed.content,
      headingIds,
    });
  }
  return posts;
}

// Collect the set of tag slugs used across all non-draft posts.
function collectTagSlugs(posts) {
  const kr = new Set();
  const en = new Set();
  const slugger = new GithubSlugger();
  const kebab = t => {
    slugger.reset();
    return slugger.slug(String(t));
  };
  for (const p of posts.values()) {
    const tags = p.data?.tags || [];
    const target = p.lang === "en" ? en : kr;
    for (const t of tags) target.add(kebab(t));
  }
  return { kr, en };
}

function classify(url) {
  if (/^https?:\/\//i.test(url)) return { kind: "external" };
  if (url.startsWith("mailto:")) return { kind: "external" };
  if (url.startsWith("#")) return { kind: "same-page", anchor: url.slice(1) };
  if (!url.startsWith("/")) return { kind: "relative" };

  const [pathPart, anchor] = url.split("#");

  // /assets/...
  if (pathPart.startsWith("/assets/")) {
    return { kind: "asset", path: pathPart };
  }

  // /posts/<slug> or /en/posts/<slug>
  let m = pathPart.match(/^\/(?:en\/)?posts\/([^/]+)\/?$/);
  if (m) {
    const lang = pathPart.startsWith("/en/") ? "en" : "ko";
    return { kind: "post", lang, slug: m[1], anchor: anchor || null };
  }

  // /tags/<slug> (with optional pagination)
  m = pathPart.match(/^\/(?:en\/)?tags\/([^/]+)(?:\/\d+)?\/?$/);
  if (m) {
    const lang = pathPart.startsWith("/en/") ? "en" : "ko";
    return { kind: "tag", lang, slug: m[1], anchor: anchor || null };
  }

  return { kind: "route", path: pathPart, anchor: anchor || null };
}

function checkLink(link, post, ctx) {
  const { posts, tagSlugs } = ctx;
  const c = classify(link.url);
  switch (c.kind) {
    case "external":
    case "relative":
      return null; // out of scope for internal check
    case "same-page": {
      if (!c.anchor) return null;
      if (!post.headingIds.has(c.anchor)) {
        return `missing anchor: #${c.anchor}`;
      }
      return null;
    }
    case "asset": {
      const filePath = path.join(PUBLIC_DIR, c.path.replace(/^\//, ""));
      if (!existsSync(filePath)) return `asset not found: ${c.path}`;
      return null;
    }
    case "post": {
      const target = posts.get(`${c.lang}/${c.slug}`);
      if (!target) return `post not found: /${c.lang === "en" ? "en/" : ""}posts/${c.slug}`;
      if (c.anchor && !target.headingIds.has(c.anchor)) {
        return `anchor missing in target post: /${c.lang === "en" ? "en/" : ""}posts/${c.slug}#${c.anchor}`;
      }
      return null;
    }
    case "tag": {
      const set = c.lang === "en" ? tagSlugs.en : tagSlugs.kr;
      if (!set.has(c.slug)) return `tag not used by any post: /${c.lang === "en" ? "en/" : ""}tags/${c.slug}`;
      return null;
    }
    case "route": {
      const p = c.path;
      if (KNOWN_ROUTES.has(p) || KNOWN_ROUTES.has(p + "/") || KNOWN_ROUTES.has(p.replace(/\/$/, ""))) {
        return null;
      }
      // Playground sub-pages (dynamic) — skip verifying until we grow more of these
      if (p.startsWith("/playground/")) return null;
      // Portfolio slug pages
      if (p.startsWith("/portfolio/")) return null;
      return `unknown route: ${p}`;
    }
  }
  return null;
}

async function main() {
  const posts = await loadPosts();
  const tagSlugs = collectTagSlugs(posts);
  const ctx = { posts, tagSlugs };

  const problems = []; // { file, url, text, reason }
  let linkCount = 0;

  for (const post of posts.values()) {
    // Extract links from body + description (frontmatter)
    const sources = [
      { where: "body", text: post.body },
      { where: "description", text: String(post.data?.description || "") },
    ];
    for (const src of sources) {
      for (const link of extractLinks(src.text)) {
        linkCount++;
        const reason = checkLink(link, post, ctx);
        if (reason) {
          problems.push({
            file: path.relative(ROOT, post.file),
            where: src.where,
            url: link.url,
            text: link.text,
            reason,
          });
        }
      }
    }
  }

  const postCount = posts.size;
  console.log(`Scanned ${postCount} posts, ${linkCount} internal-eligible links.`);
  if (problems.length === 0) {
    console.log("✅ No broken internal links.");
    return;
  }

  // Group by file
  const byFile = new Map();
  for (const p of problems) {
    if (!byFile.has(p.file)) byFile.set(p.file, []);
    byFile.get(p.file).push(p);
  }

  console.log(`❌ Found ${problems.length} broken link(s) in ${byFile.size} file(s):\n`);
  for (const [file, list] of byFile) {
    console.log(`  ${file}`);
    for (const p of list) {
      console.log(`    - [${p.where}] ${p.reason}`);
      console.log(`        link: [${p.text}](${p.url})`);
    }
    console.log();
  }
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
