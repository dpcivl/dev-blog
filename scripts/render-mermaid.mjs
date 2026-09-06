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
//        <img src="/assets/mermaid/<hash>.svg" alt="..." width="W" height="H"
//             style="max-width:min(100%, Wpx);height:auto;" />
//        (W/H come from the SVG viewBox — see svgSize() for why they're required)
//      - Re-syncs those width/height attributes on every run, so a sizing change
//        propagates to already-published posts
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
// 이미 <img> 로 치환된 참조. 블록은 1회 렌더 후 사라지므로, 이 참조까지
// 세지 않으면 GC 가 살아 있는 SVG 를 전부 고아로 판정한다.
const IMG_REF = /\/assets\/mermaid\/([0-9a-f]{16})\.svg/g;
// Only touch hash-shaped filenames on orphan cleanup; leave legacy named SVGs alone.
const HASH_FILE = /^[0-9a-f]{16}\.svg$/;
// 이미 박혀 있는 mermaid <img> 태그 전체. 크기 속성을 다시 계산해 덮어쓰는 데 쓴다.
const IMG_TAG = /<img\s+src="\/assets\/mermaid\/([0-9a-f]{16})\.svg"[^>]*\/?>/g;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry");
const gc = args.includes("--gc");

// mermaid 는 루트 <svg> 에 width="100%" 를 박아 내보낸다. 그 SVG 를 <img> 로
// 불러오면 브라우저가 "고유 너비 없음" 으로 판정해서 width:auto 를 컨테이너 폭으로
// 채운다. 세로로 긴 순서도가 본문 폭(816px)까지 늘어나 2500px 높이로 렌더되던 원인.
// viewBox 에서 실제 크기를 읽어 <img> 에 못박는다. 가로세로를 함께 주므로
// 이미지가 늦게 와도 자리가 밀리지 않는다(CLS).
function svgSize(svg) {
  const vb = svg.match(/viewBox="([\d.\s-]+)"/);
  if (!vb) return null;
  const [, , w, h] = vb[1].trim().split(/\s+/).map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { w: Math.round(w), h: Math.round(h) };
}

// altEscaped 는 이미 속성용으로 이스케이프된 문자열이어야 한다(이중 이스케이프 방지).
function buildImgTag(hash, altEscaped, size) {
  const dims = size ? ` width="${size.w}" height="${size.h}"` : "";
  const cap = size ? `min(100%, ${size.w}px)` : "100%";
  return `<img src="/assets/mermaid/${hash}.svg" alt="${altEscaped}"${dims} style="max-width:${cap};height:auto;" />`;
}

// 이미 발행된 글에 박혀 있는 <img> 태그의 크기 속성을 SVG 실제 크기로 맞춘다.
// 크기 규칙이 바뀌어도 다음 실행 때 전체 글이 따라오도록 매번 돌린다.
async function syncExistingImgTags(files) {
  let touched = 0;
  for (const file of files) {
    const before = await readFile(file, "utf8");
    const tags = [...before.matchAll(new RegExp(IMG_TAG.source, IMG_TAG.flags))];
    if (tags.length === 0) continue;
    let after = before;
    for (const t of tags.reverse()) {
      const alt = t[0].match(/alt="([^"]*)"/)?.[1] ?? "mermaid diagram";
      const rebuilt = buildImgTag(t[1], alt, await sizeOf(t[1]));
      if (rebuilt === t[0]) continue;
      after = after.slice(0, t.index) + rebuilt + after.slice(t.index + t[0].length);
    }
    if (after === before) continue;
    await writeFile(file, after, "utf8");
    touched++;
    console.log(`  ↻ Resized ${path.relative(ROOT, file)}`);
  }
  return touched;
}

async function sizeOf(hash) {
  const p = path.join(ASSET_DIR, `${hash}.svg`);
  if (!existsSync(p)) return null;
  return svgSize(await readFile(p, "utf8"));
}

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
  const referenced = new Set(); // 이미 <img> 로 박혀 있는 해시
  for (const file of files) {
    const content = await readFile(file, "utf8");
    const ref = new RegExp(IMG_REF.source, IMG_REF.flags);
    let rm;
    while ((rm = ref.exec(content)) !== null) referenced.add(rm[1]);
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
    if (!dryRun) await syncExistingImgTags(files);
    await runGc(referenced);
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
    if (gc) await runGc(new Set([...seenHashes, ...referenced]));
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
      const imgTag = buildImgTag(job.hash, escapeHtmlAttr(job.alt || "mermaid diagram"), await sizeOf(job.hash));
      content = content.slice(0, job.index) + imgTag + content.slice(job.index + job.matchLen);
      replaced++;
    }
    await writeFile(file, content, "utf8");
    console.log(`  → Rewrote ${list.length} block(s) in ${path.relative(ROOT, file)}`);
  }

  const resized = await syncExistingImgTags(files);

  console.log(`\n== Summary ==`);
  console.log(`  Rendered new: ${toRender.length}`);
  console.log(`  Cache hits:   ${seenHashes.size - toRender.length}`);
  console.log(`  MD blocks →   <img>: ${replaced}`);
  console.log(`  Resized files: ${resized}`);

  await runGc(new Set([...seenHashes, ...referenced]));
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
