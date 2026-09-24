// 임베딩에 얼마가 드는지 먼저 본다. API 호출은 한 건도 안 한다.
//
//   node scripts/embed/estimate.mjs          요약만
//   node scripts/embed/estimate.mjs --sample 조각 몇 개를 실제로 출력
//
// 돈을 쓰기 전에 무엇을 얼마에 보내는지 눈으로 확인하려고 만들었다.

import { collectChunks } from "./chunk.mjs";

// https://developers.openai.com/api/docs/pricing (2026-09 확인)
const MODELS = {
  "text-embedding-3-small": 0.02, // $ / 1M tokens
  "text-embedding-3-large": 0.13,
};

const sample = process.argv.includes("--sample");

const chunks = await collectChunks();
const totalTokens = chunks.reduce((a, c) => a + c.tokens, 0);
const posts = new Set(chunks.map(c => c.slug)).size;

const lens = chunks.map(c => c.tokens).sort((a, b) => a - b);
const pct = p => lens[Math.min(lens.length - 1, Math.floor(lens.length * p))];

console.log("=== 조각 내기 결과 ===");
console.log(`  글            ${posts}편`);
console.log(`  조각          ${chunks.length}개`);
console.log(`  전체 토큰     ${totalTokens.toLocaleString()} (추정)`);
console.log(
  `  조각 크기     중앙값 ${pct(0.5)} · 90% ${pct(0.9)} · 최대 ${lens[lens.length - 1]}`
);

console.log("\n=== 인덱스 한 번 만드는 비용 ===");
for (const [model, price] of Object.entries(MODELS)) {
  const cost = (totalTokens / 1_000_000) * price;
  console.log(`  ${model.padEnd(24)} $${cost.toFixed(4)}`);
}

console.log("\n=== 새 글 한 편 추가할 때 ===");
const avgPerPost = Math.round(totalTokens / posts);
console.log(
  `  평균 ${avgPerPost.toLocaleString()} 토큰 → $${((avgPerPost / 1_000_000) * MODELS["text-embedding-3-small"]).toFixed(6)}`
);

console.log("\n=== 질문 1건 (런타임) ===");
console.log(
  `  약 20 토큰 → $${((20 / 1_000_000) * MODELS["text-embedding-3-small"]).toFixed(8)}  (사실상 0)`
);

// 1536차원 float32 로 서버에 둘 때의 크기
const dims = 1536;
const bytes = chunks.length * dims * 4;
console.log("\n=== 인덱스 파일 크기 ===");
console.log(`  ${dims}차원 float32   ${(bytes / 1024 / 1024).toFixed(1)}MB (서버 보관용)`);
console.log(
  `  256차원 int8      ${((chunks.length * 256) / 1024).toFixed(0)}KB (브라우저로 보낼 때)`
);

if (sample) {
  console.log("\n=== 조각 예시 3개 ===");
  for (const c of [chunks[0], chunks[Math.floor(chunks.length / 2)], chunks.at(-1)]) {
    console.log(`\n--- ${c.slug} (${c.tokens} 토큰) ---`);
    console.log(c.text.slice(0, 320).replace(/\n/g, "\n    "));
  }
}
