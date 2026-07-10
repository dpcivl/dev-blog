// Local pre-render for mermaid diagrams.
//
// Workflow:
//   1. Author writes ```mermaid``` code blocks in a post's markdown (KR and/or EN)
//   2. Runs `pnpm mermaid:render`
//   3. This script:
//      - Scans src/data/blog/**/*.md for ```mermaid``` blocks
//      - Hashes each block's content (first 16 hex chars of SHA256)
//      - Renders any missing SVGs to public/assets/mermaid/<hash>.svg (via Playwright)
//      - Rewrites the original MD in-place, replacing the ```mermaid``` block with
//        <img src="/assets/mermaid/<hash>.svg" alt="..." style="max-width:100%;height:auto;" />
//   4. Author commits SVGs + rewritten MD together
//
// Why: Vercel's build environment can't reliably run Chromium, so remark-mermaidjs
// throws silently and drops post bodies. Pre-rendering shifts the render off Vercel
// entirely — the site only serves static SVG images.
//
// Alt text: add a `%% alt: description here` line at the top of the mermaid block.
// Mermaid treats %% as a comment, so it doesn't affect rendering. If missing, the
// script warns and uses a generic "mermaid diagram" fallback.
//
// Orphan detection: any *.svg in public/assets/mermaid/ that no rewritten MD
// references (by hash filename) is flagged at the end. Delete manually or add
// --gc to purge on the next run.
//
// Usage:
//   node scripts/render-mermaid.mjs          # render + rewrite (default)
//   node scripts/render-mermaid.mjs --dry    # detect + render, but don't rewrite MD
//   node scripts/render-mermaid.mjs --gc     # also delete orphaned SVGs

import { readdir, readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMermaidRenderer } from "mermaid-isomorphic";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BLOG_DIR = path.join(ROOT, "src", "data", "blog");
const ASSET_DIR = path.join(ROOT, "public", "assets", "mermaid");

const MERMAID_BLOCK = /```mermaid\r?\n([\s\S]*?)\r?\n```/g;
// Only touch hash-shaped filenames on orphan cleanup; leave legacy named SVGs alone.
const HASH_FILE = /^[0-9a-f]{16}\.svg$/;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry");
const gc = args.includes("--gc");

function contentHash(source) {
  // Ignore `%% alt: ...` comment lines when hashing so alt-only edits don't
  // regenerate a byte-identical SVG.
  const clean = source
    .split("\n")
    .filter(l => !/^%%\s*alt:/i.test(l))
    .join("\n")
    .trim();
  return createHash("sha256").update(clean).digest("hex").slice(0, 16);
}

function extractAlt(source) {
  const m = source.match(/^%%\s*alt:\s*(.+)$/im);
  return m ? m[1].trim() : null;
}

function escapeHtmlAttr(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function walkMd(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walkMd(full)));
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

async function main() {
  await mkdir(ASSET_DIR, { recursive: true });
  const files = await walkMd(BLOG_DIR);

  // Collect all mermaid blocks up-front so we can batch-render.
  const jobs = []; // { file, source, hash, alt, index, matchLen }
  for (const file of files) {
    const content = await readFile(file, "utf8");
    const rx = new RegExp(MERMAID_BLOCK.source, MERMAID_BLOCK.flags);
    let m;
    while ((m = rx.exec(content)) !== null) {
      const source = m[1];
      const hash = contentHash(source);
      const alt = extractAlt(source);
      jobs.push({
        file,
        source,
        hash,
        alt,
        index: m.index,
        matchLen: m[0].length,
      });
    }
  }

  if (jobs.length === 0) {
    console.log("No ```mermaid``` blocks found in src/data/blog/**/*.md.");
    await runGc(new Set());
    return;
  }

  // Warn about missing alt text
  const missingAlt = jobs.filter(j => !j.alt);
  if (missingAlt.length > 0) {
    console.log(`\n⚠️  ${missingAlt.length} block(s) missing alt text.`);
    console.log(`   Add \`%% alt: description\` as the first line inside the mermaid block for accessibility.\n`);
  }

  // Render missing SVGs
  const toRender = [];
  const seenHashes = new Set();
  for (const job of jobs) {
    if (seenHashes.has(job.hash)) continue;
    seenHashes.add(job.hash);
    const svgPath = path.join(ASSET_DIR, `${job.hash}.svg`);
    if (!existsSync(svgPath)) {
      toRender.push({ hash: job.hash, source: job.source, svgPath });
    }
  }

  console.log(`Found ${jobs.length} block(s) across ${new Set(jobs.map(j => j.file)).size} file(s). Unique: ${seenHashes.size}. To render: ${toRender.length}.`);

  if (toRender.length > 0) {
    console.log(`\nRendering ${toRender.length} new SVG(s) via Playwright…`);
    const renderer = createMermaidRenderer();
    const results = await renderer(toRender.map(r => r.source));
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const t = toRender[i];
      if (r.status === "fulfilled") {
        await writeFile(t.svgPath, r.value.svg, "utf8");
        console.log(`  ✓ ${t.hash}.svg`);
      } else {
        console.error(`  ✗ ${t.hash}: ${r.reason?.message || r.reason}`);
      }
    }
  }

  if (dryRun) {
    console.log(`\n(--dry) Skipping MD rewrite. ${jobs.length} block(s) would be replaced with <img> tags.`);
    if (gc) await runGc(seenHashes);
    return;
  }

  // Rewrite MD files (group jobs by file, replace end→start to preserve indices)
  const byFile = new Map();
  for (const job of jobs) {
    if (!byFile.has(job.file)) byFile.set(job.file, []);
    byFile.get(job.file).push(job);
  }

  let replaced = 0;
  for (const [file, list] of byFile) {
    // Sanity: only proceed if every referenced SVG exists on disk.
    const missing = list.filter(j => !existsSync(path.join(ASSET_DIR, `${j.hash}.svg`)));
    if (missing.length > 0) {
      console.log(`  SKIP ${path.relative(ROOT, file)} (${missing.length} block(s) still un-rendered)`);
      continue;
    }
    let content = await readFile(file, "utf8");
    list.sort((a, b) => b.index - a.index);
    for (const job of list) {
      const altText = job.alt || "mermaid diagram";
      const imgTag = `<img src="/assets/mermaid/${job.hash}.svg" alt="${escapeHtmlAttr(altText)}" style="max-width:100%;height:auto;" />`;
      content = content.slice(0, job.index) + imgTag + content.slice(job.index + job.matchLen);
      replaced++;
    }
    await writeFile(file, content, "utf8");
    console.log(`  → Rewrote ${list.length} block(s) in ${path.relative(ROOT, file)}`);
  }

  console.log(`\n== Summary ==`);
  console.log(`  Rendered new: ${toRender.length}`);
  console.log(`  Cache hits:   ${seenHashes.size - toRender.length}`);
  console.log(`  MD blocks →   <img>: ${replaced}`);

  await runGc(seenHashes);
}

async function runGc(usedHashes) {
  const existing = await readdir(ASSET_DIR).catch(() => []);
  const orphans = existing
    .filter(f => HASH_FILE.test(f))
    .filter(f => !usedHashes.has(f.replace(/\.svg$/, "")));
  if (orphans.length === 0) return;
  if (gc) {
    for (const o of orphans) {
      await unlink(path.join(ASSET_DIR, o));
      console.log(`  🗑  Removed orphan ${o}`);
    }
    console.log(`  Deleted ${orphans.length} orphan SVG(s).`);
  } else {
    console.log(`\n⚠️  ${orphans.length} orphan SVG(s) (hash-named, no MD reference):`);
    for (const o of orphans) console.log(`    ${o}`);
    console.log(`  Rerun with --gc to delete them.`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
