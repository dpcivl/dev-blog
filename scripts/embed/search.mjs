// 만든 인덱스로 실제 검색을 해본다. 서버 없이 여기서 품질부터 본다.
//
//   node scripts/embed/search.mjs "느려진 원인을 어떻게 찾았나요?"
//   node scripts/embed/search.mjs --suite              정해둔 질문 묶음으로 한 번에
//   node scripts/embed/search.mjs --suite --model text-embedding-3-small
//
// 점수를 같이 찍는다. "없음" 을 언제 말할지(하한선)를 정하려면 맞는 답과
// 틀린 답의 점수 분포를 눈으로 봐야 하기 때문이다.

import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const has = name => process.argv.includes(`--${name}`);

const MODEL = arg("model", "text-embedding-3-large");
const DIMENSIONS = Number(arg("dimensions", MODEL.endsWith("large") ? 1024 : 1536));
const TOP = Number(arg("top", 5));

const file = path.join(".cache/embeddings", `${MODEL}-${DIMENSIONS}.json`);
const index = JSON.parse(await readFile(file, "utf8"));

// OpenAI 임베딩은 길이 1 로 정규화돼 있어 내적이 곧 코사인 유사도다
const dot = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

async function embed(text) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, dimensions: DIMENSIONS, input: text }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).data[0].embedding;
}

export async function search(query, top = TOP) {
  const q = await embed(query);
  const scored = index.chunks.map(c => ({ ...c, score: dot(q, c.vector) }));

  // 글 하나당 제일 잘 맞은 조각만 남긴다. 같은 글의 조각 다섯 개가
  // 자리를 다 차지하면 목록으로서 쓸모가 없다.
  const best = new Map();
  for (const c of scored) {
    const prev = best.get(c.slug);
    if (!prev || c.score > prev.score) best.set(c.slug, c);
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, top);
}

// ── 실행 ──
const SUITE = [
  // 지금 검색이 맞히는 것 — 떨어지면 안 된다
  ["인증은 어떻게 구현했나요?", "세션/JWT 인증 글"],
  ["시계열 분석에 대해 알고 싶은데 그런 글 있어?", "퀀트/데이터분석 글"],
  ["pandas", "데이터 분석 글"],
  // 지금 검색이 틀리는 것 — 이게 고쳐지는지가 핵심
  ["느려진 원인을 어떻게 찾았나요?", "탭 전환 얼어붙음 / 성능 개선 글"],
  ["배포 자동화 관련 글", "Lightsail 이전 / GitHub Actions 글"],
  ["AI가 쓴 코드를 믿어도 되나", "AI 검증 글"],
  ["블로그를 직접 서버에 올린 이야기", "Lightsail 이전 글"],
  // 답이 없어야 하는 것 — 낮은 점수로 떨어져야 한다
  ["면접 준비 관련 글 있나요?", "(없어야 함)"],
  ["김치찌개 끓이는 법", "(없어야 함)"],
];

const queries = has("suite")
  ? SUITE
  : [[process.argv.slice(2).filter(a => !a.startsWith("--"))[0], ""]];

if (!queries[0][0]) {
  console.error('질문을 주거나 --suite 를 쓸 것. 예: node scripts/embed/search.mjs "인증"');
  process.exit(1);
}

console.log(`${MODEL} · ${DIMENSIONS}차원 · 조각 ${index.chunks.length}개\n`);

for (const [q, expect] of queries) {
  const rows = await search(q);
  console.log(`▸ ${q}${expect ? `   → 기대: ${expect}` : ""}`);
  for (const r of rows) {
    const bar = "█".repeat(Math.max(0, Math.round((r.score - 0.2) * 40)));
    console.log(
      `   ${r.score.toFixed(3)} ${bar.padEnd(14)} ${r.title.slice(0, 40)}${r.heading ? ` › ${r.heading.slice(0, 20)}` : ""}`
    );
  }
  console.log();
}
