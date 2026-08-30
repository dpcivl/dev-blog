#!/usr/bin/env node
// CLI entry point for the translation pipeline.
//
// Usage:
//   node scripts/translate/translate.mjs sample                # translate 3 sample posts
//   node scripts/translate/translate.mjs one <slug>            # translate a single post by slug
//   node scripts/translate/translate.mjs batch                 # translate all KR posts that don't have EN yet
//   node scripts/translate/translate.mjs dry <slug>            # dry-run: translate + validate but don't write

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { translateOne, makeClient } from "./translate-one.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const KO_DIR = path.join(ROOT, "src/data/blog/ko");
const EN_DIR = path.join(ROOT, "src/data/blog/en");

const SAMPLE_SLUGS = [
  "fems-project-log-02",
  "mcp-study-log-03-resources-and-langgraph",
  "eval-study-log-02-similarity-and-testset-design",
];

async function listKoSlugs() {
  const entries = await fs.readdir(KO_DIR);
  return entries
    .filter(f => f.endsWith(".md") && !f.startsWith("_"))
    .map(f => f.replace(/\.md$/, ""));
}

async function enExists(slug) {
  try {
    await fs.access(path.join(EN_DIR, `${slug}.md`));
    return true;
  } catch {
    return false;
  }
}

function fmt(n) {
  return n.toLocaleString();
}

async function translateSlug(slug, client, opts = {}) {
  const koPath = path.join(KO_DIR, `${slug}.md`);
  const enPath = path.join(EN_DIR, `${slug}.md`);
  const dryRun = opts.dryRun ?? false;

  process.stdout.write(`  → ${slug} ... `);
  const start = Date.now();

  try {
    const result = await translateOne({ koPath, enPath, client, dryRun });
    const secs = ((Date.now() - start) / 1000).toFixed(1);
    const status = result.ok ? "✓" : "✗";
    const anchors = result.anchorRewrites?.length
      ? ` | anchors=${result.anchorRewrites.length}`
      : "";
    console.log(
      `${status} ${secs}s | in=${fmt(result.usage.input)} out=${fmt(result.usage.output)} cache=r${fmt(result.usage.cache_read)}/w${fmt(result.usage.cache_write)} | $${result.cost.toFixed(4)}${anchors}`
    );
    if (!result.ok) {
      for (const issue of result.issues) {
        console.log(`      ! ${issue}`);
      }
    }
    return result;
  } catch (err) {
    const secs = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`ERROR ${secs}s | ${err.message}`);
    return { ok: false, error: err.message, cost: 0 };
  }
}

async function runSample(client) {
  console.log(`\n== SAMPLE: 3 posts ==`);
  const results = [];
  for (const slug of SAMPLE_SLUGS) {
    results.push(await translateSlug(slug, client));
  }
  return results;
}

async function runOne(slug, client, dryRun = false) {
  console.log(`\n== ${dryRun ? "DRY-RUN" : "ONE"}: ${slug} ==`);
  return [await translateSlug(slug, client, { dryRun })];
}

async function runBatch(client) {
  const allSlugs = await listKoSlugs();
  const pending = [];
  for (const slug of allSlugs) {
    if (!(await enExists(slug))) pending.push(slug);
  }
  console.log(
    `\n== BATCH: ${pending.length} pending (${allSlugs.length} total, ${allSlugs.length - pending.length} already translated) ==`
  );
  const results = [];
  for (const slug of pending) {
    results.push(await translateSlug(slug, client));
  }
  return results;
}

function summarize(results) {
  const ok = results.filter(r => r.ok).length;
  const fail = results.filter(r => !r.ok).length;
  const total = results.reduce((sum, r) => sum + (r.cost || 0), 0);
  console.log(`\n== SUMMARY ==`);
  console.log(`  translated: ${ok} ok, ${fail} with issues`);
  console.log(`  total cost: $${total.toFixed(4)}`);
}

/*
 * 번역 중단 킬스위치 (2026-08-30~).
 *
 * 작성자 지시로 EN 자동 번역을 중단했고, Anthropic API 토큰이 의도치 않게
 * 소모되는 것을 막는다. CLAUDE.md 의 지침만으로는 사람/세션이 잊으면 그대로
 * 호출되므로 코드에서 차단한다.
 *
 * 다시 켜려면: TRANSLATE_ENABLED=1 pnpm translate one <slug>
 * 상시로 켜려면 이 블록을 지우고 CLAUDE.md 의 중단 배너도 함께 걷을 것.
 */
function assertTranslateEnabled() {
  if (process.env.TRANSLATE_ENABLED === "1") return;
  console.error(
    [
      "",
      "🛑 번역 파이프라인이 중단 상태입니다 (2026-08-25~).",
      "   Anthropic API 를 호출하지 않고 종료합니다. 토큰이 소모되지 않았습니다.",
      "",
      "   의도적으로 실행하려면:",
      "     TRANSLATE_ENABLED=1 pnpm translate one <slug>",
      "",
      "   상시로 다시 켜려면 CLAUDE.md 의 '자동 번역 중단' 배너와",
      "   scripts/translate/translate.mjs 의 assertTranslateEnabled 를 함께 해제하세요.",
      "",
    ].join("\n")
  );
  process.exit(2);
}

async function main() {
  const cmd = process.argv[2];
  if (!cmd) {
    console.error(
      `Usage:
  node scripts/translate/translate.mjs sample
  node scripts/translate/translate.mjs one <slug>
  node scripts/translate/translate.mjs dry <slug>
  node scripts/translate/translate.mjs batch`
    );
    process.exit(1);
  }

  assertTranslateEnabled();

  const client = makeClient();

  let results = [];
  if (cmd === "sample") {
    results = await runSample(client);
  } else if (cmd === "one") {
    const slug = process.argv[3];
    if (!slug) {
      console.error("`one` requires a slug argument");
      process.exit(1);
    }
    results = await runOne(slug, client);
  } else if (cmd === "dry") {
    const slug = process.argv[3];
    if (!slug) {
      console.error("`dry` requires a slug argument");
      process.exit(1);
    }
    results = await runOne(slug, client, true);
  } else if (cmd === "batch") {
    results = await runBatch(client);
  } else {
    console.error(`Unknown command: ${cmd}`);
    process.exit(1);
  }

  summarize(results);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
