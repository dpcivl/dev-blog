// External link checker for blog posts.
// Scans src/data/blog/**/*.md, extracts http(s) URLs, and probes each with
// HEAD (falling back to GET on 405/403). Reports 4xx / 5xx / timeout / DNS.
//
// Usage:
//   node scripts/check-links-external.mjs            # all posts
//   node scripts/check-links-external.mjs ko         # only KR
//   node scripts/check-links-external.mjs --slow     # sequential, verbose
//
// Notes:
//   - Deduplicates URLs so each unique URL is probed once even if referenced
//     from many posts.
//   - Concurrency capped at 8 to avoid getting rate-limited.
//   - Some sites (twitter/x, linkedin) reject bot traffic; those show up as
//     403 and should be sanity-checked manually.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, "$1"));
const BLOG_DIR = path.join(ROOT, "src", "data", "blog");

const MD_LINK = /\[([^\]]*)\]\(([^)]+)\)/g;
const CONCURRENCY = 8;
const TIMEOUT_MS = 10_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; parkhyoin-linkcheck/1.0; +https://parkhyo.in)";

// Hosts that block automated probes but are legitimately live in a browser.
// A timeout / connection-error / 403 / 429 on these is downgraded from error → warn
// so CI doesn't fail on false positives. Verify manually if you suspect a real break.
const BOT_BLOCKED_HOSTS = new Set([
  "www.st.com", // ST Microelectronics — CDN blocks all CLI traffic
  "docs.ragas.io", // 429 bot rate-limit
]);

const args = process.argv.slice(2);
const langFilter = args.find(a => a === "ko" || a === "en") || null;
const slow = args.includes("--slow");

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

async function loadUrlIndex() {
  const files = await walk(BLOG_DIR);
  // url → [{ file, text }]
  const index = new Map();
  for (const file of files) {
    const rel = path.relative(BLOG_DIR, file);
    const lang = rel.split(path.sep)[0];
    if (langFilter && lang !== langFilter) continue;
    const base = path.basename(file, ".md");
    if (base.startsWith("_")) continue;
    const raw = await readFile(file, "utf8");
    const parsed = matter(raw);
    if (parsed.data?.draft === true) continue;
    const texts = [parsed.content, String(parsed.data?.description || "")];
    for (const text of texts) {
      for (const { text: linkText, url } of extractLinks(text)) {
        if (!/^https?:\/\//i.test(url)) continue;
        // Strip trailing punctuation that sometimes sneaks in.
        const clean = url.replace(/[).,;]+$/, "");
        if (!index.has(clean)) index.set(clean, []);
        index.get(clean).push({ file: path.relative(ROOT, file), text: linkText });
      }
    }
  }
  return index;
}

async function fetchWithTimeout(url, opts, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    return { res };
  } catch (err) {
    if (err.name === "AbortError") return { err: { code: "timeout" } };
    return { err: { code: err.code || err.message } };
  } finally {
    clearTimeout(timer);
  }
}

async function probe(url) {
  const headers = { "user-agent": USER_AGENT, accept: "*/*" };
  const baseOpts = { redirect: "follow", headers };

  // 1) HEAD with normal timeout.
  let { res, err } = await fetchWithTimeout(
    url, { ...baseOpts, method: "HEAD" }, TIMEOUT_MS
  );

  // 2) On HEAD-hostile status, retry with GET (same timeout).
  if (res && (res.status === 405 || res.status === 403 || res.status === 501)) {
    ({ res, err } = await fetchWithTimeout(
      url, { ...baseOpts, method: "GET" }, TIMEOUT_MS
    ));
  }

  // 3) On timeout or transient fetch failure, retry with GET + longer timeout.
  //    Some doc sites (docs.ros.org, etc.) are legitimately slow or have
  //    flaky TLS. Two extra attempts with small backoff.
  const isTransient = e => e && (e.code === "timeout" || e.code === "fetch failed" || e.code === "ECONNRESET" || e.code === "ETIMEDOUT");
  for (let attempt = 0; attempt < 2 && !res && isTransient(err); attempt++) {
    await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    ({ res, err } = await fetchWithTimeout(
      url, { ...baseOpts, method: "GET" }, TIMEOUT_MS * 3
    ));
  }

  if (err) return { ok: false, status: 0, error: err.code };
  return { ok: res.ok, status: res.status, finalUrl: res.url };
}

async function runPool(urls, worker) {
  const results = new Map();
  let idx = 0;
  const size = slow ? 1 : CONCURRENCY;
  const workers = Array.from({ length: size }, async () => {
    while (idx < urls.length) {
      const i = idx++;
      const url = urls[i];
      if (slow) console.log(`  [${i + 1}/${urls.length}] ${url}`);
      results.set(url, await worker(url));
    }
  });
  await Promise.all(workers);
  return results;
}

function classify(result, url) {
  const host = (() => {
    try { return new URL(url).hostname; } catch { return ""; }
  })();
  const botBlocked = BOT_BLOCKED_HOSTS.has(host);
  if (result.error) {
    return botBlocked
      ? { severity: "warn", label: `${result.error} (bot-blocked host)` }
      : { severity: "error", label: result.error };
  }
  const s = result.status;
  if (s >= 200 && s < 300) return { severity: "ok", label: `${s}` };
  if (s >= 300 && s < 400) return { severity: "warn", label: `redirect ${s}` };
  if (s === 403 || s === 429) return { severity: "warn", label: `${s} (likely bot-blocked)` };
  if (botBlocked && s >= 400) return { severity: "warn", label: `${s} (bot-blocked host)` };
  if (s >= 400 && s < 500) return { severity: "error", label: `${s}` };
  if (s >= 500) return { severity: "error", label: `${s}` };
  return { severity: "error", label: `unknown ${s}` };
}

async function main() {
  const t0 = Date.now();
  const index = await loadUrlIndex();
  const urls = [...index.keys()].sort();
  console.log(
    `Found ${urls.length} unique external URL(s) across posts${
      langFilter ? ` (${langFilter} only)` : ""
    }. Probing with concurrency=${slow ? 1 : CONCURRENCY}…\n`
  );

  const results = await runPool(urls, probe);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  const errors = [];
  const warns = [];
  let okCount = 0;
  for (const url of urls) {
    const r = results.get(url);
    const c = classify(r, url);
    if (c.severity === "ok") okCount++;
    else if (c.severity === "warn") warns.push({ url, r, c });
    else errors.push({ url, r, c });
  }

  console.log(`Done in ${secs}s.  ok=${okCount}  warn=${warns.length}  error=${errors.length}\n`);

  const dump = (title, list) => {
    if (list.length === 0) return;
    console.log(title);
    for (const { url, r, c } of list) {
      console.log(`  [${c.label}] ${url}`);
      if (r.finalUrl && r.finalUrl !== url) console.log(`      → ${r.finalUrl}`);
      const refs = index.get(url) || [];
      for (const ref of refs.slice(0, 3)) console.log(`      referenced: ${ref.file}`);
      if (refs.length > 3) console.log(`      … +${refs.length - 3} more`);
    }
    console.log();
  };

  dump(`⚠️  Warnings (${warns.length}):`, warns);
  dump(`❌ Errors (${errors.length}):`, errors);

  if (errors.length > 0) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
