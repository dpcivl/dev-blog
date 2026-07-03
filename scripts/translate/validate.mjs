// Structural validators for a Korean → English blog translation.
// Each validator returns { ok: boolean, issues: string[] }.

const CODE_FENCE = /```[\s\S]*?```/g;
const INLINE_CODE = /`[^`\n]+`/g;
const MD_LINK = /\[([^\]]*)\]\(([^)]+)\)/g;
const MD_IMAGE = /!\[[^\]]*\]\(([^)]+)\)/g;
const HTML_TAG = /<[^>]+>/g;
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
    if (krBlocks[i] !== enBlocks[i]) {
      issues.push(
        `code block ${i + 1} content differs (KR first line: ${krBlocks[i]
          .split("\n")[0]
          .slice(0, 60)})`
      );
    }
  }
  return { ok: issues.length === 0, issues };
}

export function validateLinkUrls(kr, en) {
  const krUrls = [];
  const enUrls = [];
  let m;
  const rxKr = new RegExp(MD_LINK.source, MD_LINK.flags);
  while ((m = rxKr.exec(kr)) !== null) krUrls.push(m[2]);
  const rxEn = new RegExp(MD_LINK.source, MD_LINK.flags);
  while ((m = rxEn.exec(en)) !== null) enUrls.push(m[2]);
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

export function validateHtmlTags(kr, en) {
  const krTags = extractAll(kr, HTML_TAG);
  const enTags = extractAll(en, HTML_TAG);
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
  const results = {
    codeBlocks: validateCodeBlocks(kr, en),
    linkUrls: validateLinkUrls(kr, en),
    imagePaths: validateImagePaths(kr, en),
    headings: validateHeadings(kr, en),
    htmlTags: validateHtmlTags(kr, en),
    lengthRatio: validateLengthRatio(kr, en),
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
