// 글을 임베딩하기 좋은 크기로 자른다.
//
// 글 한 편을 통째로 벡터 하나에 넣으면 안 된다. 긴 글일수록 주제가 섞여서
// 벡터가 평균값에 가까워지고, "어떤 질문에도 어중간하게 비슷한" 벡터가 된다.
// 그래서 소제목 단위로 자르고, 너무 길면 문단 경계에서 한 번 더 자른다.
//
// 자를 때 제목과 소제목을 각 조각 앞에 붙인다. 조각만 떼어놓고 보면
// 무슨 글의 어느 대목인지 알 수 없어서 검색 품질이 떨어진다.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

/** 대략적인 토큰 수. 한국어는 글자당 토큰이 영어보다 많다 */
export function estimateTokens(text) {
  let tokens = 0;
  for (const ch of text) {
    // 한글·한자·가나는 글자당 대략 1토큰, 그 외는 4글자당 1토큰 정도
    tokens += /[　-鿿가-힯]/.test(ch) ? 1 : 0.25;
  }
  return Math.ceil(tokens);
}

/** frontmatter 를 떼고 본문만 돌려준다 */
function splitFrontmatter(raw) {
  if (!raw.startsWith("---")) return { data: {}, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { data: {}, body: raw };
  const head = raw.slice(3, end);
  const body = raw.slice(end + 4);

  // 필요한 값만 얕게 읽는다. YAML 파서를 끌어오지 않는다
  const pick = key => {
    const m = head.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    if (!m) return undefined;
    return m[1].trim().replace(/^["'](.*)["']$/, "$1");
  };
  return {
    data: {
      title: pick("title"),
      description: pick("description"),
      pubDatetime: pick("pubDatetime"),
      draft: pick("draft") === "true",
    },
    body,
  };
}

/** 검색에 쓸모없는 것들을 걷어낸다 */
function clean(body) {
  return (
    body
      // 렌더된 mermaid 이미지 태그
      .replace(/<img[^>]*\/?>/g, "")
      // 목차 자리
      .replace(/^##\s*Table of contents\s*$/gim, "")
      // 코드 블록은 통째로 뺀다. 코드가 임베딩을 지배해서 본문 설명이 묻힌다
      .replace(/```[\s\S]*?```/g, "")
      // 링크는 글자만 남긴다
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`>]/g, "")
      .replace(/\n{3,}/g, "\n\n")
  );
}

const MAX_TOKENS = 450; // 한 조각의 목표 크기
const MIN_TOKENS = 40; // 이보다 짧으면 앞 조각에 붙인다

/** 목표 크기를 넘는 덩어리를 줄 단위로, 그래도 길면 문장 단위로 자른다 */
function splitLong(text) {
  const out = [];
  let cur = [];
  let curTokens = 0;
  const units = text.split("\n").flatMap(line =>
    estimateTokens(line) > MAX_TOKENS
      ? line.split(/(?<=[.!?다])\s+/)
      : [line]
  );
  for (const u of units) {
    const t = estimateTokens(u);
    if (curTokens && curTokens + t > MAX_TOKENS) {
      out.push(cur.join("\n"));
      cur = [];
      curTokens = 0;
    }
    cur.push(u);
    curTokens += t;
  }
  if (cur.length) out.push(cur.join("\n"));
  return out.filter(x => x.trim());
}

/**
 * 소제목 단위로 자르고, 긴 절은 문단 경계에서 다시 자른다.
 * 각 조각 앞에 "글 제목 › 소제목" 을 붙여 맥락을 남긴다.
 */
export function chunkPost({ slug, title, body }) {
  const text = clean(body);
  const sections = [];
  let heading = "";
  let buf = [];

  const flush = () => {
    const content = buf.join("\n").trim();
    if (content) sections.push({ heading, content });
    buf = [];
  };

  for (const line of text.split("\n")) {
    const m = line.match(/^(#{2,4})\s+(.*)$/);
    if (m) {
      flush();
      heading = m[2].trim();
    } else {
      buf.push(line);
    }
  }
  flush();

  const chunks = [];
  for (const sec of sections) {
    const prefix = sec.heading ? `${title} › ${sec.heading}\n\n` : `${title}\n\n`;
    const paras = sec.content.split(/\n{2,}/).filter(p => p.trim());

    let cur = [];
    let curTokens = 0;
    const push = () => {
      const joined = cur.join("\n\n").trim();
      if (!joined) return;
      chunks.push({
        slug,
        title,
        heading: sec.heading,
        text: prefix + joined,
        tokens: estimateTokens(prefix + joined),
      });
      cur = [];
      curTokens = 0;
    };

    for (const p of paras) {
      // 빈 줄 없이 이어진 목록은 문단 하나로 잡힌다. 실제로 갱신 기록
      // 한 절이 2,032 토큰짜리 조각이 됐다. 그런 건 줄 단위로 더 자른다.
      const pieces =
        estimateTokens(p) > MAX_TOKENS ? splitLong(p) : [p];
      for (const piece of pieces) {
        const t = estimateTokens(piece);
        if (curTokens && curTokens + t > MAX_TOKENS) push();
        cur.push(piece);
        curTokens += t;
      }
    }
    push();
  }

  // 너무 짧은 조각은 앞에 붙인다. 혼자서는 검색에 안 잡힌다
  const merged = [];
  for (const c of chunks) {
    const prev = merged[merged.length - 1];
    if (prev && c.tokens < MIN_TOKENS && prev.slug === c.slug) {
      prev.text += "\n\n" + c.text.split("\n\n").slice(1).join("\n\n");
      prev.tokens = estimateTokens(prev.text);
    } else {
      merged.push({ ...c });
    }
  }
  return merged;
}

/** src/data/blog/ko 의 발행된 글을 전부 조각낸다 */
export async function collectChunks(dir = "src/data/blog/ko") {
  const files = (await readdir(dir)).filter(
    f => f.endsWith(".md") && !f.startsWith("_")
  );
  const out = [];
  for (const f of files.sort()) {
    const raw = await readFile(path.join(dir, f), "utf8");
    const { data, body } = splitFrontmatter(raw);
    if (data.draft) continue;
    const slug = f.replace(/\.md$/, "");
    out.push(...chunkPost({ slug, title: data.title ?? slug, body }));
  }
  return out;
}
