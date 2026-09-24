// 테스트셋으로 모델을 채점한다.
//
//   node scripts/embed/score.mjs                          인덱스가 있는 모델 전부
//   node scripts/embed/score.mjs --model bge-m3           하나만
//   node scripts/embed/score.mjs --verbose                틀린 문항을 전부 찍는다
//
// 무엇을 재는가
//
//   recall@k   긍정 35문항. 상위 k개 안에 정답 글이 있으면 맞힌 것.
//              이 서비스는 "질문 → 링크 목록" 이라 k=5 가 실제 화면과 같다.
//
//   오수용     부정 15문항. 답이 없어야 하는 질문인데 뭔가를 보여주면 오수용.
//              하한선을 얼마로 두느냐에 따라 달라지므로 하나의 숫자가 아니라
//              곡선으로 낸다. 하한선을 올리면 오수용은 줄지만 맞히던 것도 놓친다.
//              그 맞바꿈을 눈으로 보고 운영점을 고르는 게 이 스크립트의 목적이다.
//
// 하한선을 미리 정해두고 재지 않는다. 이전에 눈대중으로 정한 값들이 전부
// 틀렸던 이유가, 맞는 답과 틀린 답의 점수대가 모델마다 다른데 한 숫자를
// 옮겨 쓴 것이었다. 점수의 절대값은 모델 간에 비교할 수 없다.

import "dotenv/config";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { MODELS, dot, embedAll, modelInfo } from "./embedder.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const has = name => process.argv.includes(`--${name}`);

const DIR = ".cache/embeddings";
const TOP = 5;
const VERBOSE = has("verbose");

// ── 테스트셋 ──
const raw = await readFile("scripts/embed/testset.jsonl", "utf8");
const items = raw
  .split("\n")
  .map(l => l.trim())
  .filter(l => l && !l.startsWith("//"))
  .map(l => JSON.parse(l));

const positives = items.filter(i => i.answer_sources.length);
const negatives = items.filter(i => !i.answer_sources.length);

// ── 잴 모델 고르기 ──
const indexPath = m => path.join(DIR, `${m}-${modelInfo(m).dimensions}.json`);
const wanted = arg("model") ? [arg("model")] : Object.keys(MODELS);
const targets = wanted.filter(m => {
  if (existsSync(indexPath(m))) return true;
  console.log(`⏭  ${m} — 인덱스가 없다 (build-index.mjs --model ${m})`);
  return false;
});
if (!targets.length) {
  console.error("잴 수 있는 모델이 없다.");
  process.exit(1);
}

// 질문 벡터는 캐시한다. 35+15 = 50개뿐이라 돈은 얼마 안 들지만, 채점을
// 여러 번 돌릴 때마다 외부 API 를 부르면 결과가 조금씩 흔들릴 수 있다.
async function embedQuestions(model) {
  const file = path.join(DIR, `questions-${model.replace(/[:/]/g, "_")}.json`);
  if (existsSync(file)) {
    const c = JSON.parse(await readFile(file, "utf8"));
    if (c.length === items.length) return c;
  }
  const vecs = await embedAll(model, items.map(i => i.question), { as: "query" });
  await mkdir(DIR, { recursive: true });
  await writeFile(file, JSON.stringify(vecs));
  return vecs;
}

// 글 하나당 제일 잘 맞은 조각만 남긴 순위표
function rank(index, qvec) {
  const best = new Map();
  for (const c of index.chunks) {
    const s = dot(qvec, c.vector);
    const prev = best.get(c.slug);
    if (!prev || s > prev.score) best.set(c.slug, { slug: c.slug, title: c.title, score: s });
  }
  return [...best.values()].sort((a, b) => b.score - a.score);
}

const pct = (a, b) => `${((a / b) * 100).toFixed(0)}%`;
const bar = (v, w = 20) => "█".repeat(Math.round(v * w)).padEnd(w, "·");

const report = [];

for (const model of targets) {
  const index = JSON.parse(await readFile(indexPath(model), "utf8"));
  const qvecs = await embedQuestions(model);

  const hit = { 1: 0, 3: 0, 5: 0 };
  const misses = [];
  const posTop = []; // 긍정 문항에서 정답 글이 받은 점수
  const negTop = []; // 부정 문항에서 1등이 받은 점수

  for (const [i, item] of items.entries()) {
    const rows = rank(index, qvecs[i]);
    if (item.answer_sources.length) {
      const where = rows.findIndex(r => item.answer_sources.includes(r.slug));
      for (const k of [1, 3, 5]) if (where !== -1 && where < k) hit[k]++;
      // 하한선 곡선에는 "정답을 상위 5개 안에서 실제로 보여줬을 때의 점수" 를 쓴다.
      // 1등 점수가 아니라 정답이 받은 점수여야 하한선에 걸리는지 알 수 있다.
      posTop.push(where !== -1 && where < TOP ? rows[where].score : null);
      if (where === -1 || where >= TOP) {
        misses.push({ item, rows: rows.slice(0, 3), where });
      }
    } else {
      negTop.push(rows[0].score);
    }
  }

  // ── 하한선 곡선 ──
  // 후보는 실제로 나온 점수들에서 뽑는다. 0.05 간격 같은 임의의 눈금을 쓰면
  // 분포가 몰려 있는 구간을 통째로 건너뛴다.
  const all = [...posTop.filter(v => v != null), ...negTop].sort((a, b) => a - b);
  const curve = [];
  const stepCount = 12;
  for (let i = 0; i <= stepCount; i++) {
    const t = all[Math.min(all.length - 1, Math.floor((i / stepCount) * (all.length - 1)))];
    const kept = posTop.filter(v => v != null && v >= t).length;
    const accepted = negTop.filter(v => v >= t).length;
    curve.push({ t, kept, accepted });
  }

  report.push({
    model,
    info: modelInfo(model),
    hit,
    misses,
    posTop,
    negTop,
    curve: curve.filter((c, i, a) => i === 0 || c.t !== a[i - 1].t),
  });
}

// ── 출력 ──
console.log(`긍정 ${positives.length}문항 · 부정 ${negatives.length}문항\n`);

console.log("── 정답을 몇 번째에 찾는가 (긍정 35문항) ──");
console.log(`${"모델".padEnd(24)} ${"@1".padEnd(6)} ${"@3".padEnd(6)} @5`);
for (const r of report) {
  console.log(
    `${r.model.padEnd(24)} ${pct(r.hit[1], positives.length).padEnd(6)} ${pct(r.hit[3], positives.length).padEnd(6)} ${pct(r.hit[5], positives.length)}  ${bar(r.hit[5] / positives.length)}`
  );
}

console.log("\n── 난이도별 recall@5 ──");
for (const r of report) {
  const byLevel = {};
  for (const lv of ["easy", "hard"]) {
    const sub = positives.filter(p => p.level === lv);
    // posTop 은 positives 순서대로 쌓았으므로 그 자리의 값이 null 이 아니면 맞힌 것
    const got = sub.filter(p => r.posTop[positives.indexOf(p)] != null).length;
    byLevel[lv] = `${got}/${sub.length}`;
  }
  console.log(`${r.model.padEnd(24)} easy ${byLevel.easy}   hard ${byLevel.hard}`);
}

console.log("\n── 점수 분포 (하한선을 정하려면 이게 겹치는지를 봐야 한다) ──");
for (const r of report) {
  const ok = r.posTop.filter(v => v != null).sort((a, b) => a - b);
  const ng = [...r.negTop].sort((a, b) => a - b);
  const q = (a, p) => a[Math.floor(a.length * p)] ?? NaN;
  console.log(`${r.model}`);
  console.log(`   정답  최저 ${ok[0].toFixed(3)} · 중앙 ${q(ok, 0.5).toFixed(3)} · 최고 ${ok.at(-1).toFixed(3)}`);
  console.log(`   부정  최저 ${ng[0].toFixed(3)} · 중앙 ${q(ng, 0.5).toFixed(3)} · 최고 ${ng.at(-1).toFixed(3)}`);
  const overlap = ok[0] < ng.at(-1);
  console.log(`   ${overlap ? `⚠ 겹친다 — 어떤 하한선을 써도 둘 중 하나는 틀린다` : `✅ 안 겹친다 — ${((ok[0] + ng.at(-1)) / 2).toFixed(3)} 근처에 선을 그으면 된다`}`);
}

console.log("\n── 하한선 맞바꿈 곡선 ──");
console.log("   하한선을 올릴수록 헛답은 줄지만 맞히던 것도 사라진다.");
for (const r of report) {
  console.log(`\n${r.model}`);
  console.log(`   ${"하한선".padEnd(8)} ${"정답 유지".padEnd(12)} 헛답`);
  for (const c of r.curve) {
    console.log(
      `   ${c.t.toFixed(3).padEnd(8)} ${`${c.kept}/${positives.length}`.padEnd(12)} ${c.accepted}/${negatives.length}  ${bar(c.accepted / negatives.length, 15)}`
    );
  }
}

if (VERBOSE) {
  console.log("\n── 놓친 문항 ──");
  for (const r of report) {
    console.log(`\n${r.model} — ${r.misses.length}개`);
    for (const m of r.misses) {
      console.log(`   ✗ [${m.item.id} ${m.item.level}] ${m.item.question}`);
      console.log(`      정답: ${m.item.answer_sources.join(", ")}${m.where === -1 ? "" : ` (${m.where + 1}등)`}`);
      for (const row of m.rows) {
        console.log(`      ${row.score.toFixed(3)} ${row.title.slice(0, 42)}`);
      }
    }
  }
} else {
  console.log("\n놓친 문항을 보려면 --verbose");
}
