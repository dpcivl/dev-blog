import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mask } from "../secret-patterns.mjs";

// Structural validators for a Korean → English blog translation.
// Each validator returns { ok: boolean, issues: string[] }.

const CODE_FENCE = /```[\s\S]*?```/g;
const INLINE_CODE = /`[^`\n]+`/g;
const MD_LINK = /\[([^\]]*)\]\(([^)]+)\)/g;
const MD_IMAGE = /!\[[^\]]*\]\(([^)]+)\)/g;
// HTML tags: require a letter or / immediately after < to exclude `<=`, `<-`, `<0` etc.
const HTML_TAG = /<[a-zA-Z\/][^>]*>/g;
const HEADING = /^(#{1,6})\s+/gm;

function extractAll(text, re) {
  const matches = [];
  const rx = new RegExp(re.source, re.flags);
  let m;
  while ((m = rx.exec(text)) !== null) {
    matches.push(m[0]);
  }
  return matches;
}

function multisetEqual(a, b) {
  if (a.length !== b.length) return { equal: false, missing: [], extra: [] };
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  const missing = [];
  const extra = [];
  for (let i = 0; i < sortedA.length; i++) {
    if (sortedA[i] !== sortedB[i]) {
      missing.push(sortedA[i]);
      extra.push(sortedB[i]);
    }
  }
  return {
    equal: missing.length === 0 && extra.length === 0,
    missing,
    extra,
  };
}

// ---------- individual validators ----------

// Strip common comment patterns from code so that translating comments
// (e.g. `// 정수 나눗셈` → `// integer division`) doesn't flag a false positive.
// The AI translating code comments to English is desirable behavior.
function stripCommentsFromCode(code) {
  return code
    .replace(/\/\/[^\n]*/g, "") // // line comments
    .replace(/#[^\n]*/g, "") // # line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // /* block comments */
    .replace(/<!--[\s\S]*?-->/g, ""); // <!-- html comments -->
}

// A fenced block's first line carries the language hint, e.g. ```mermaid.
function isMermaidBlock(block) {
  return /^```\s*mermaid\s*$/im.test(block.split("\n")[0]);
}

export function validateCodeBlocks(kr, en) {
  const krBlocks = extractAll(kr, CODE_FENCE);
  const enBlocks = extractAll(en, CODE_FENCE);
  const issues = [];
  if (krBlocks.length !== enBlocks.length) {
    issues.push(
      `code block count mismatch: KR=${krBlocks.length}, EN=${enBlocks.length}`
    );
    return { ok: false, issues };
  }
  for (let i = 0; i < krBlocks.length; i++) {
    if (krBlocks[i] === enBlocks[i]) continue;
    // mermaid blocks are SUPPOSED to differ — their labels get translated so
    // that the rendered diagram reads English (prompt.mjs rule 8). The pair is
    // rendered into two separate SVGs, so identical mermaid source would mean
    // the EN diagram was left in Korean. Count only, never compare content.
    if (isMermaidBlock(krBlocks[i])) continue;
    // Compare with comments stripped — if that matches, treat as OK
    // (comment translation is desirable, not a failure).
    if (stripCommentsFromCode(krBlocks[i]) === stripCommentsFromCode(enBlocks[i])) {
      continue;
    }
    issues.push(
      `code block ${i + 1} content differs (KR first line: ${krBlocks[i]
        .split("\n")[0]
        .slice(0, 60)})`
    );
  }
  return { ok: issues.length === 0, issues };
}

// Normalize an EN URL back to its KR equivalent for comparison,
// since the translator rewrites /posts → /en/posts, /tags → /en/tags, etc.
function normalizeEnUrlForCompare(url) {
  return url
    .replace(/^\/en\/posts\//, "/posts/")
    .replace(/^\/en\/tags\//, "/tags/")
    .replace(/^\/en\/about\//, "/about/")
    .replace(/^\/en\/about$/, "/about")
    .replace(/^\/en\/?$/, "/");
}

// Strip anchor fragments before comparing — anchor-rewrite.mjs legitimately
// swaps KR heading slugs for EN ones on the target post, so keeping anchors
// would flag every rewrite as a diff.
function stripAnchor(url) {
  const i = url.indexOf("#");
  return i === -1 ? url : url.slice(0, i);
}

export function validateLinkUrls(kr, en) {
  const krUrls = [];
  const enUrls = [];
  let m;
  const rxKr = new RegExp(MD_LINK.source, MD_LINK.flags);
  while ((m = rxKr.exec(kr)) !== null) krUrls.push(stripAnchor(m[2]));
  const rxEn = new RegExp(MD_LINK.source, MD_LINK.flags);
  while ((m = rxEn.exec(en)) !== null) {
    enUrls.push(stripAnchor(normalizeEnUrlForCompare(m[2])));
  }
  const cmp = multisetEqual(krUrls, enUrls);
  if (!cmp.equal) {
    return {
      ok: false,
      issues: [
        `link URLs changed. missing in EN: ${cmp.missing.slice(0, 3).join(", ")}${cmp.missing.length > 3 ? "..." : ""}`,
      ],
    };
  }
  return { ok: true, issues: [] };
}

export function validateImagePaths(kr, en) {
  const krImgs = [];
  const enImgs = [];
  let m;
  const rxKr = new RegExp(MD_IMAGE.source, MD_IMAGE.flags);
  while ((m = rxKr.exec(kr)) !== null) krImgs.push(m[1]);
  const rxEn = new RegExp(MD_IMAGE.source, MD_IMAGE.flags);
  while ((m = rxEn.exec(en)) !== null) enImgs.push(m[1]);
  const cmp = multisetEqual(krImgs, enImgs);
  if (!cmp.equal) {
    return {
      ok: false,
      issues: [
        `image paths changed. missing: ${cmp.missing.slice(0, 3).join(", ")}${cmp.missing.length > 3 ? "..." : ""}`,
      ],
    };
  }
  return { ok: true, issues: [] };
}

export function validateHeadings(kr, en) {
  const krHeadings = extractAll(kr, HEADING).map(h => h.trim());
  const enHeadings = extractAll(en, HEADING).map(h => h.trim());
  if (krHeadings.length !== enHeadings.length) {
    return {
      ok: false,
      issues: [
        `heading count mismatch: KR=${krHeadings.length}, EN=${enHeadings.length}`,
      ],
    };
  }
  const issues = [];
  for (let i = 0; i < krHeadings.length; i++) {
    if (krHeadings[i] !== enHeadings[i]) {
      issues.push(
        `heading ${i + 1} depth changed: KR "${krHeadings[i]}" vs EN "${enHeadings[i]}"`
      );
    }
  }
  return { ok: issues.length === 0, issues };
}

// Strip code blocks before extracting HTML tags — code often contains `<=` etc.
function stripCodeBlocks(text) {
  return text.replace(CODE_FENCE, "").replace(INLINE_CODE, "");
}

// mermaid <img> 는 KO/EN 이 서로 다른 해시 · alt 를 갖는 게 의도다 (EN 은 영어
// 라벨로 다시 렌더한다). 그래서 내용이 아니라 개수만 맞는지 본다.
const MERMAID_IMG = /^<img\b[^>]*\/assets\/mermaid\//;

function tagsForCompare(text) {
  const all = extractAll(stripCodeBlocks(text), HTML_TAG);
  const plain = all.filter(t => !MERMAID_IMG.test(t));
  const mermaidCount = all.length - plain.length;
  return [...plain, ...Array(mermaidCount).fill("<img mermaid>")];
}

export function validateHtmlTags(kr, en) {
  const krTags = tagsForCompare(kr);
  const enTags = tagsForCompare(en);
  const cmp = multisetEqual(krTags, enTags);
  if (!cmp.equal) {
    return {
      ok: false,
      issues: [
        `HTML tags changed. missing: ${cmp.missing.slice(0, 3).join(", ")}${cmp.missing.length > 3 ? "..." : ""}`,
      ],
    };
  }
  return { ok: true, issues: [] };
}

// Detects patterns that GFM parsers interpret as strikethrough by accident:
// single-tilde pairs on the same line with short content between, most often
// range notation like "1~2일" or "~1.5~2주". Use en dash "–" or "약" instead.
//
// Returns findings with 1-indexed line numbers relative to the ORIGINAL text
// (before stripping code). Intentional strikethrough (~~text~~) is excluded.
export function detectAccidentalStrikethrough(text) {
  // Strip code blocks so tilde inside code doesn't false-fire.
  // Preserve newlines inside multi-line regions so line numbers stay
  // aligned with the original text — spaces for every non-newline char.
  const blank = m => m.replace(/[^\n]/g, " ");
  const scanned = text
    .replace(CODE_FENCE, blank)
    .replace(INLINE_CODE, blank)
    // Blank out intentional double-tilde strikethrough. Must run before the
    // single-tilde pair scan so ~~x~~ isn't caught.
    .replace(/~~[^~\n]+~~/g, blank);

  const findings = [];
  const lines = scanned.split("\n");
  // Single-tilde pair with 1-40 non-tilde chars between → accidental strike.
  const pairRe = /~([^~\n]{1,40})~/g;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    pairRe.lastIndex = 0;
    while ((m = pairRe.exec(line)) !== null) {
      findings.push({
        line: i + 1,
        matched: `~${m[1]}~`,
        snippet: mask(line.trim()).slice(0, 100),
      });
    }
  }
  return findings;
}

export function validateAccidentalStrikethrough(text) {
  const findings = detectAccidentalStrikethrough(text);
  const issues = findings.map(
    f =>
      `line ${f.line}: possible accidental strikethrough "${f.matched}" — use en dash '–' or '약'/'약' instead. context: ${f.snippet}`
  );
  return { ok: issues.length === 0, issues };
}

// 상한을 2.0 → 2.5 로 올렸다 (2026-11-14). 95쌍을 재보니 **중앙값이 1.75**,
// 최대가 2.20 이었다 — 한국어는 조사와 어미가 짧아 같은 내용이 영어로 가면
// 평균 1.7~1.8배가 된다. 2.0 은 정상 범위를 자르고 있었고(12건이 2.01~2.15),
// 그런 경고가 쌓이면 진짜 신호가 묻힌다. 3배 넘게 부풀린 번역은 여전히 잡는다.
export function validateLengthRatio(kr, en, min = 0.5, max = 2.5) {
  if (kr.length === 0) return { ok: true, issues: [] };
  const ratio = en.length / kr.length;
  if (ratio < min || ratio > max) {
    return {
      ok: false,
      issues: [
        `length ratio out of range: ${ratio.toFixed(2)} (KR ${kr.length} → EN ${en.length}, expected ${min}x - ${max}x)`,
      ],
    };
  }
  return { ok: true, issues: [] };
}

// ---------- combined ----------

export function validateAll(kr, en) {
  // Accidental-strikethrough is a per-text check, so it runs on kr and en
  // independently and gets prefixed for clarity.
  const koStrike = validateAccidentalStrikethrough(kr);
  const enStrike = validateAccidentalStrikethrough(en);
  const strikeIssues = [
    ...koStrike.issues.map(i => `[KO] ${i}`),
    ...enStrike.issues.map(i => `[EN] ${i}`),
  ];

  const results = {
    codeBlocks: validateCodeBlocks(kr, en),
    linkUrls: validateLinkUrls(kr, en),
    imagePaths: validateImagePaths(kr, en),
    headings: validateHeadings(kr, en),
    htmlTags: validateHtmlTags(kr, en),
    lengthRatio: validateLengthRatio(kr, en),
    accidentalStrikethrough: {
      ok: koStrike.ok && enStrike.ok,
      issues: strikeIssues,
    },
  };
  const allIssues = [];
  let ok = true;
  for (const [name, res] of Object.entries(results)) {
    if (!res.ok) {
      ok = false;
      for (const issue of res.issues) {
        allIssues.push(`[${name}] ${issue}`);
      }
    }
  }
  return { ok, issues: allIssues, results };
}

// ---------- 단독 실행 ----------
//
// 번역 없이 KO/EN 짝을 검증한다. 발행 게이트가 이것을 부른다.
//   node scripts/translate/validate.mjs            # 짝이 있는 전 글
//   node scripts/translate/validate.mjs <slug>...  # 지정한 글만
// 짝이 안 맞으면(KO 없음 · EN 없음) 여기서는 건너뛴다 — 그건 check:md 의 몫이다.
// 실패가 하나라도 있으면 exit 1.

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const koDir = path.join(root, "src/data/blog/ko");
  const enDir = path.join(root, "src/data/blog/en");
  const explicit = process.argv.length > 2;
  const slugs = explicit
    ? process.argv.slice(2)
    : (await fs.readdir(enDir)).filter(f => f.endsWith(".md")).map(f => f.replace(/\.md$/, "")).sort();

  // slug 를 그대로 경로에 붙이므로 `../` 로 저장소 밖 .md 를 읽지 못하게 막는다.
  const bad = slugs.filter(s => !/^[a-z0-9-]+$/.test(s));
  if (bad.length > 0) {
    console.error(`slug 형식이 아니다: ${bad.join(", ")} (소문자·숫자·하이픈만)`);
    process.exit(1);
  }

  let checked = 0;
  const failed = [];
  for (const slug of slugs) {
    let ko, en;
    try {
      [ko, en] = await Promise.all([
        fs.readFile(path.join(koDir, `${slug}.md`), "utf8"),
        fs.readFile(path.join(enDir, `${slug}.md`), "utf8"),
      ]);
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      // 목록에서 고른 게 아니라 직접 지목했는데 없으면 오타다 — 조용히 통과시키지 않는다.
      if (explicit) {
        console.error(`짝을 찾을 수 없다: ${slug} (ko/en 중 하나가 없다)`);
        process.exit(1);
      }
      continue;
    }
    checked++;
    const r = validateAll(ko, en);
    if (!r.ok) failed.push({ slug, issues: r.issues });
  }

  for (const { slug, issues } of failed) {
    console.log(`  ${slug}`);
    for (const i of issues) console.log(`    ! ${mask(i)}`);
  }
  console.log(`페어 ${checked}건 검증 — 실패 ${failed.length}건`);
  process.exit(failed.length > 0 ? 1 : 0);
}

// 직접 실행할 때만 돈다. import 하면 검증 함수만 쓸 수 있다.
const invokedDirectly =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (invokedDirectly) {
  main().catch(e => {
    console.error(e);
    process.exit(2);
  });
}
