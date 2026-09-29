// 벡터 단독 vs 벡터+낱말 혼합을 같은 테스트셋에서 비교한다.
//
//   node scripts/embed/score-hybrid.mjs
//   node scripts/embed/score-hybrid.mjs --model bge-m3
//
// 재는 것은 둘이다.
//   맞힘   긍정 35문항에서 정답이 상위 5개 안에 남아 있는 비율
//   헛답   부정 15문항에서 뭐라도 보여준 비율
//
// 혼합이 좋다고 미리 정해두고 재지 않는다. 낱말 검사가 오히려 정답을
// 떨어뜨릴 수도 있다 — 글의 낱말을 피해서 쓴 hard 문항이 20개나 되므로
// 그쪽에서 손해가 날 여지가 실제로 있다.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { dot, modelInfo } from "./embedder.mjs";
import { keywordScores } from "./keyword.mjs";

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const MODEL = arg("model", "text-embedding-3-large");
const DIMS = modelInfo(MODEL).dimensions;
const TOP = 5;

const items = (await readFile("scripts/embed/testset.jsonl", "utf8"))
  .split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("//")).map(l => JSON.parse(l));
const positives = items.filter(i => i.answer_sources.length);
const negatives = items.filter(i => !i.answer_sources.length);

const index = JSON.parse(await readFile(path.join(".cache/embeddings", `${MODEL}-${DIMS}.json`), "utf8"));
const qvecs = JSON.parse(await readFile(path.join(".cache/embeddings", `questions-${MODEL.replace(/[:/]/g, "_")}.json`), "utf8"));
const keywords = new Map(Object.entries(JSON.parse(await readFile("public/search/keywords.json", "utf8"))));

// 글 단위 벡터 점수 (제일 잘 맞은 조각)
function vectorRank(qvec) {
  const best = new Map();
  for (const c of index.chunks) {
    const s = dot(qvec, c.vector);
    const p = best.get(c.slug);
    if (!p || s > p) best.set(c.slug, s);
  }
  return best;
}

const precomputed = items.map((it, i) => ({
  item: it,
  vec: vectorRank(qvecs[i]),
  kw: keywordScores(keywords, it.question),
}));

// 한 설정으로 채점한다. boost 0 · gate 0 이면 벡터 단독과 같다.
function evaluate({ floor, boost, gate }) {
  let correct = 0, falseAccept = 0;
  const lost = [];
  for (const p of precomputed) {
    // 관문 — 질문의 주제어를 충분히 담은 글이 한 편도 없으면 아무것도 안 보여준다
    if (p.kw.best < gate) {
      if (p.item.answer_sources.length) lost.push({ p, why: "낱말 관문" });
      continue;
    }
    const rows = [...p.vec.entries()]
      .map(([slug, v]) => ({ slug, score: v + boost * (p.kw.coverage.get(slug) ?? 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP)
      .filter(r => r.score >= floor);

    if (p.item.answer_sources.length) {
      if (rows.some(r => p.item.answer_sources.includes(r.slug))) correct++;
      else lost.push({ p, why: rows.length ? "순위 밖" : "하한선" });
    } else if (rows.length) falseAccept++;
  }
  return { correct, falseAccept, lost };
}

const pctS = (a, b) => `${((a / b) * 100).toFixed(0)}%`.padStart(4);
console.log(`${MODEL} · 긍정 ${positives.length} · 부정 ${negatives.length}\n`);

const rows = [];
for (const gate of [0, 0.25, 0.3, 0.35, 0.4, 0.45]) {
  for (const boost of [0, 0.05, 0.1, 0.15, 0.2, 0.3]) {
    for (const floor of [0, 0.3, 0.35, 0.38, 0.4, 0.42, 0.45]) {
      rows.push({ gate, boost, floor, ...evaluate({ floor, boost, gate }) });
    }
  }
}

console.log("관문   보정   하한선   맞힘        헛답");
let shown = 0;
for (const r of rows) {
  // 볼 만한 것만: 맞힘 80% 이상이면서 헛답이 절반 아래
  if (r.correct / positives.length < 0.85 || r.falseAccept / negatives.length > 0.2) continue;
  shown++;
  console.log(
    `${r.gate.toFixed(2)}  ${r.boost.toFixed(2)}   ${r.floor.toFixed(2)}    ` +
    `${pctS(r.correct, positives.length)} (${r.correct}/${positives.length})   ` +
    `${pctS(r.falseAccept, negatives.length)} (${r.falseAccept}/${negatives.length})`
  );
}
if (!shown) console.log("   (조건을 만족하는 설정이 없다)");

// ── 기준선과 제일 나은 것 ──
const base = evaluate({ floor: 0.422, boost: 0, gate: 0 });
const baseNoFloor = evaluate({ floor: 0, boost: 0, gate: 0 });
// 헛답을 먼저 줄이고, 같으면 맞힘이 높은 쪽
const best = [...rows].sort((a, b) =>
  a.falseAccept - b.falseAccept || b.correct - a.correct
).filter(r => r.correct / positives.length >= 0.85)[0];

console.log("\n── 견줘보면 ──");
const line = (name, r) =>
  console.log(`${name.padEnd(28)} 맞힘 ${r.correct}/${positives.length}  ·  헛답 ${r.falseAccept}/${negatives.length}`);
line("벡터 단독 · 하한선 없음", baseNoFloor);
line("벡터 단독 · 하한선 0.422", base);
if (best) {
  line(`혼합 · 관문 ${best.gate} 보정 ${best.boost} 하한선 ${best.floor}`, best);
  console.log("\n── 혼합에서도 놓친 것 ──");
  for (const l of best.lost) console.log(`   [${l.p.item.id} ${l.p.item.level ?? ""}] ${l.p.item.question}  — ${l.why}`);
}
