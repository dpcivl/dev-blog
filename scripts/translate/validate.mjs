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

export function validateHtmlTags(kr, en) {
  const krTags = extractAll(stripCodeBlocks(kr), HTML_TAG);
  const enTags = extractAll(stripCodeBlocks(en), HTML_TAG);
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
        snippet: line.trim().slice(0, 100),
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

export function validateLengthRatio(kr, en, min = 0.5, max = 2.0) {
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
