#!/usr/bin/env node
// Audit all published blog posts for accidental-strikethrough patterns.
// Uses the shared detector from scripts/translate/validate.mjs so translation
// pipeline and standalone audit report on the same rule set.
//
// Usage:
//   node scripts/check-markdown.mjs            # scan src/data/blog/
//   node scripts/check-markdown.mjs <path>     # scan a single file or dir
//
// Exit code: 0 if clean, 1 if any findings — usable in CI.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectAccidentalStrikethrough } from "./translate/validate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

async function walk(target) {
  const stat = await fs.stat(target);
  if (stat.isFile()) return target.endsWith(".md") ? [target] : [];
  const entries = await fs.readdir(target, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const p = path.join(target, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(p)));
    else if (entry.isFile() && p.endsWith(".md")) files.push(p);
  }
  return files;
}

function relPath(p) {
  return path.relative(REPO_ROOT, p).replaceAll("\\", "/");
}

async function main() {
  const target =
    process.argv[2] ?? path.join(REPO_ROOT, "src", "data", "blog");
  const files = await walk(path.resolve(target));

  let totalFindings = 0;
  const filesWithIssues = [];

  for (const file of files) {
    const content = await fs.readFile(file, "utf8");
    const findings = detectAccidentalStrikethrough(content);
    if (findings.length === 0) continue;
    filesWithIssues.push({ file, findings });
    totalFindings += findings.length;
  }

  const scannedLabel = `Scanned ${files.length} file(s) in ${relPath(path.resolve(target))}`;

  if (filesWithIssues.length === 0) {
    console.log(`${scannedLabel} — no accidental-strikethrough patterns found.`);
    process.exit(0);
  }

  console.log(scannedLabel);
  console.log(
    `Found ${totalFindings} suspect pattern(s) across ${filesWithIssues.length} file(s):\n`
  );
  for (const { file, findings } of filesWithIssues) {
    console.log(`  ${relPath(file)}`);
    for (const f of findings) {
      console.log(`    L${f.line}: ${f.matched}`);
      console.log(`      → ${f.snippet}`);
    }
    console.log("");
  }
  console.log(
    "Hint: replace numeric-range tilde with en dash '–' (e.g. 1~2일 → 1–2일),"
  );
  console.log(
    "      or replace leading approximate '~' with '약' (e.g. ~1.5초 → 약 1.5초)."
  );
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
