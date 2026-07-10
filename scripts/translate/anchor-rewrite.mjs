// Post-translation anchor rewrite.
//
// The Anthropic translator preserves anchor fragments verbatim (as instructed
// by prompt.mjs). But English target posts have English heading slugs, so a
// preserved KR anchor points to a heading that doesn't exist. This module
// rewrites those anchors after translation by mapping KR heading → EN heading
// at the same positional index in the target post.
//
// Assumption: heading count and order are 1:1 between KR and EN of any post
// (enforced by prompt.mjs rules 4 & 6). Position-based mapping is safe.
//
// If the target EN post doesn't exist yet (translation dependency ordering),
// the anchor is left alone — check-links.mjs will catch it later.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import GithubSlugger from "github-slugger";

const MD_LINK = /\[([^\]]*)\]\(([^)]+)\)/g;

// Extract markdown headings from a document, respecting fenced code blocks.
// Returns { list: [{slug, text, level}], bySlug: Map<slug, index> }.
function extractHeadings(content) {
  const slugger = new GithubSlugger();
  const list = [];
  const bySlug = new Map();
  let inFence = false;
  for (const line of content.split("\n")) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const h = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!h) continue;
    const text = h[2];
    const slug = slugger.slug(text);
    list.push({ slug, text, level: h[1].length });
    bySlug.set(slug, list.length - 1);
  }
  return { list, bySlug };
}

/**
 * Rewrite anchors in translated EN content to match EN target post heading slugs.
 *
 * @param {object} opts
 * @param {string} opts.enContent - Translated EN markdown (from the model)
 * @param {string} opts.koContent - Original KR markdown
 * @param {string} opts.blogDir  - Absolute path to `src/data/blog` (contains ko/, en/)
 * @returns {Promise<{content: string, rewrites: Array<{oldAnchor: string, newAnchor: string, targetSlug: string}>}>}
 */
export async function rewriteAnchors({ enContent, koContent, blogDir }) {
  const koSelf = extractHeadings(koContent);
  const enSelf = extractHeadings(enContent);
  const targetCache = new Map(); // slug -> {ko, en} | null

  // Collect all links from EN content in one pass
  const links = [];
  const rx = new RegExp(MD_LINK.source, MD_LINK.flags);
  let m;
  while ((m = rx.exec(enContent)) !== null) {
    links.push({ full: m[0], text: m[1], url: m[2], index: m.index });
  }

  const replacements = [];
  for (const link of links) {
    if (!link.url.includes("#")) continue;
    const hashAt = link.url.indexOf("#");
    const pathPart = link.url.slice(0, hashAt);
    const anchor = link.url.slice(hashAt + 1);
    if (!anchor) continue;

    let targetKo, targetEn, targetLabel;

    if (pathPart === "" || pathPart === "./") {
      // Same-page anchor
      targetKo = koSelf;
      targetEn = enSelf;
      targetLabel = "(same page)";
    } else {
      const mm = pathPart.match(/^\/(?:en\/)?posts\/([^/]+)\/?$/);
      if (!mm) continue; // not a blog post link — skip (tag/route/asset/etc.)
      const slug = mm[1];
      targetLabel = slug;

      if (!targetCache.has(slug)) {
        const koFile = path.join(blogDir, "ko", `${slug}.md`);
        const enFile = path.join(blogDir, "en", `${slug}.md`);
        if (!existsSync(koFile) || !existsSync(enFile)) {
          targetCache.set(slug, null);
          continue;
        }
        try {
          const koText = await readFile(koFile, "utf8");
          const enText = await readFile(enFile, "utf8");
          targetCache.set(slug, {
            ko: extractHeadings(koText),
            en: extractHeadings(enText),
          });
        } catch {
          targetCache.set(slug, null);
        }
      }
      const cached = targetCache.get(slug);
      if (!cached) continue;
      targetKo = cached.ko;
      targetEn = cached.en;
    }

    // Already valid EN anchor — nothing to do
    if (targetEn.bySlug.has(anchor)) continue;

    // Find matching KR heading (by KR slug) → map to EN heading at same index
    const idx = targetKo.bySlug.get(anchor);
    if (idx === undefined) continue; // unknown anchor — leave alone
    const enHead = targetEn.list[idx];
    if (!enHead) continue;

    const newUrl = `${pathPart}#${enHead.slug}`;
    const newLink = `[${link.text}](${newUrl})`;
    replacements.push({
      full: link.full,
      newLink,
      index: link.index,
      oldAnchor: anchor,
      newAnchor: enHead.slug,
      targetSlug: targetLabel,
    });
  }

  // Apply replacements from end to start so earlier indices stay valid
  replacements.sort((a, b) => b.index - a.index);
  let out = enContent;
  for (const r of replacements) {
    out = out.slice(0, r.index) + r.newLink + out.slice(r.index + r.full.length);
  }

  return {
    content: out,
    rewrites: replacements.map(r => ({
      oldAnchor: r.oldAnchor,
      newAnchor: r.newAnchor,
      targetSlug: r.targetSlug,
    })),
  };
}
