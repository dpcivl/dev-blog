// Convert PNG/JPG images under public/assets/posts/ to WebP and rewrite
// blog post references.
//
// - Uses `sharp` (already a dep from Astro's image pipeline)
// - Quality 82 (near-lossless for screenshots, ~50-70% smaller than PNG)
// - Rewrites MD references (both `.png` → `.webp` in raw <img src="…"> and
//   markdown ![]() links)
// - Deletes original PNG/JPG after successful conversion + reference rewrite
//
// SVGs are left alone (already efficient, no raster to compress).
//
// Usage:
//   node scripts/convert-images-to-webp.mjs           # convert + rewrite + delete originals
//   node scripts/convert-images-to-webp.mjs --dry     # convert only, no rewrite/delete
//   node scripts/convert-images-to-webp.mjs --keep    # convert + rewrite, keep originals

import { readdir, readFile, writeFile, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const IMG_ROOT = path.join(ROOT, "public", "assets", "posts");
const BLOG_ROOT = path.join(ROOT, "src", "data", "blog");
const WEBP_QUALITY = 82;

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const keep = args.includes("--keep");

async function walk(dir, filter) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full, filter)));
    else if (filter(entry.name)) out.push(full);
  }
  return out;
}

function isRasterImage(name) {
  return /\.(png|jpg|jpeg)$/i.test(name);
}

function isMd(name) {
  return name.endsWith(".md");
}

function bytes(n) {
  if (n > 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  if (n > 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

async function main() {
  console.log(`Scanning ${path.relative(ROOT, IMG_ROOT)}…`);
  const images = await walk(IMG_ROOT, isRasterImage);
  console.log(`Found ${images.length} raster image(s).\n`);

  const conversions = []; // { src, dst, srcSize, dstSize, urlOld, urlNew }
  let failed = 0;
  let skipped = 0;

  for (const src of images) {
    const dst = src.replace(/\.(png|jpg|jpeg)$/i, ".webp");
    try {
      const [{ size: srcSize }] = await Promise.all([stat(src)]);
      await sharp(src).webp({ quality: WEBP_QUALITY }).toFile(dst);
      const { size: dstSize } = await stat(dst);
      // Only keep WebP if it's actually smaller — some tiny screenshots
      // compress worse as WebP than as PNG.
      if (dstSize >= srcSize) {
        await unlink(dst);
        skipped++;
        console.log(`  · ${path.basename(src)} — WebP not smaller (${bytes(srcSize)} vs ${bytes(dstSize)}), keeping PNG`);
        continue;
      }
      const rel = path.relative(path.join(ROOT, "public"), src).replace(/\\/g, "/");
      const relWebp = path.relative(path.join(ROOT, "public"), dst).replace(/\\/g, "/");
      conversions.push({
        src,
        dst,
        srcSize,
        dstSize,
        urlOld: `/${rel}`,
        urlNew: `/${relWebp}`,
      });
      const pct = ((1 - dstSize / srcSize) * 100).toFixed(0);
      console.log(`  ✓ ${path.basename(src)} → ${path.basename(dst)} (${bytes(srcSize)} → ${bytes(dstSize)}, -${pct}%)`);
    } catch (err) {
      console.error(`  ✗ ${src}: ${err.message}`);
      failed++;
    }
  }

  if (conversions.length === 0) {
    console.log("\nNo images converted.");
    return;
  }

  const totalOld = conversions.reduce((s, c) => s + c.srcSize, 0);
  const totalNew = conversions.reduce((s, c) => s + c.dstSize, 0);
  console.log(`\n== Conversion summary ==`);
  console.log(`  Converted: ${conversions.length}, Failed: ${failed}`);
  console.log(`  Total: ${bytes(totalOld)} → ${bytes(totalNew)} (-${((1 - totalNew / totalOld) * 100).toFixed(0)}%)`);

  if (dry) {
    console.log(`\n(--dry) Skipping MD rewrite + original deletion.`);
    // Clean up the .webp files we just wrote — dry mode shouldn't leave artifacts
    for (const c of conversions) await unlink(c.dst).catch(() => {});
    return;
  }

  // Rewrite MD references
  console.log(`\nRewriting MD references…`);
  const mdFiles = await walk(BLOG_ROOT, isMd);
  const urlMap = new Map(conversions.map(c => [c.urlOld, c.urlNew]));
  let rewriteCount = 0;
  for (const md of mdFiles) {
    let content = await readFile(md, "utf8");
    let touched = false;
    for (const [oldUrl, newUrl] of urlMap) {
      if (content.includes(oldUrl)) {
        content = content.split(oldUrl).join(newUrl);
        touched = true;
      }
    }
    if (touched) {
      await writeFile(md, content, "utf8");
      rewriteCount++;
      console.log(`  → ${path.relative(ROOT, md)}`);
    }
  }
  console.log(`  MD files updated: ${rewriteCount}`);

  if (keep) {
    console.log(`\n(--keep) Preserving originals. WebP files coexist with PNG/JPG.`);
    return;
  }

  // Delete originals
  console.log(`\nDeleting originals…`);
  let deleted = 0;
  for (const c of conversions) {
    await unlink(c.src);
    deleted++;
  }
  console.log(`  Deleted: ${deleted}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
