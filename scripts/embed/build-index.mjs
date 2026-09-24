// 글 조각을 벡터로 바꿔 검색 인덱스를 만든다.
//
//   node scripts/embed/build-index.mjs                       기본 (3-large · 1024차원)
//   node scripts/embed/build-index.mjs --model text-embedding-3-small
//   node scripts/embed/build-index.mjs --dimensions 1536
//   node scripts/embed/build-index.mjs --dry                 호출 없이 계획만
//
// 바뀐 조각만 다시 부른다. 조각 본문의 해시를 키로 캐시에 두고, 다음에
// 돌릴 때 같은 해시가 있으면 건너뛴다. 새 글 한 편을 올렸다고 1,297개를
// 전부 다시 임베딩할 이유가 없다 (전체가 3센트라 큰돈은 아니지만,
// 빌드마다 외부 API 를 부르는 파이프라인은 언젠가 조용히 실패한다).
//
// 결과물은 .cache/embeddings/ 아래에 둔다. git 에는 안 올린다 — 5MB 짜리
// 파일이 글 쓸 때마다 통째로 바뀌면 저장소가 금방 무거워진다. 서버로
// 옮기는 방법은 배포 단계에서 정한다.

import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { collectChunks } from "./chunk.mjs";
import { embedAll, modelInfo } from "./embedder.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const has = name => process.argv.includes(`--${name}`);

const MODEL = arg("model", process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-large");
const INFO = modelInfo(MODEL);
const DIMENSIONS = Number(arg("dimensions", INFO.dimensions));
const DRY = has("dry");

const OUT_DIR = ".cache/embeddings";
const outFile = path.join(OUT_DIR, `${MODEL}-${DIMENSIONS}.json`);
const cacheFile = path.join(OUT_DIR, `${MODEL}-${DIMENSIONS}.cache.json`);

const hash = s => createHash("sha256").update(s).digest("hex").slice(0, 16);

// ── 조각 모으기 ──
const chunks = await collectChunks();
for (const c of chunks) c.id = hash(c.text);

// ── 캐시 ──
let cache = {};
if (existsSync(cacheFile)) {
  cache = JSON.parse(await readFile(cacheFile, "utf8"));
}
const todo = chunks.filter(c => !cache[c.id]);
const reused = chunks.length - todo.length;
const todoTokens = todo.reduce((a, c) => a + c.tokens, 0);
const cost = (todoTokens / 1_000_000) * INFO.pricePerMTok;

console.log(`모델      ${MODEL} · ${DIMENSIONS}차원 · ${INFO.provider}`);
console.log(`조각      ${chunks.length}개 (캐시 재사용 ${reused} · 새로 ${todo.length})`);
console.log(`토큰      ${todoTokens.toLocaleString()}`);
console.log(`예상 비용  ${INFO.provider === "ollama" ? "$0 (로컬)" : "$" + cost.toFixed(4)}`);

if (DRY) {
  console.log("\n--dry 라 여기서 멈춘다. 호출 0건.");
  process.exit(0);
}

if (todo.length) {
  console.log();
  const t0 = Date.now();
  let done = 0;
  const vecs = await embedAll(
    MODEL,
    todo.map(c => c.text),
    {
      as: "passage", // 질문이 아니라 본문이다. Qwen3 의 지시문을 붙이면 안 된다
      onProgress: n => {
        done = n;
        const sec = (Date.now() - t0) / 1000;
        const eta = sec / n * (todo.length - n);
        process.stdout.write(
          `  ${n}/${todo.length} · ${sec.toFixed(0)}초 경과 · 남은 ${eta.toFixed(0)}초    \r`
        );
      },
    }
  );
  for (const [i, c] of todo.entries()) cache[c.id] = vecs[i];
  console.log(`\n임베딩 끝. ${((Date.now() - t0) / 1000).toFixed(0)}초 · ${done}개`);
}

// ── 인덱스 쓰기 ──
await mkdir(OUT_DIR, { recursive: true });
await writeFile(cacheFile, JSON.stringify(cache));

const index = {
  model: MODEL,
  dimensions: DIMENSIONS,
  builtAt: new Date().toISOString(),
  chunks: chunks.map(c => ({
    slug: c.slug,
    title: c.title,
    heading: c.heading,
    // 원문은 안 담는다. 링크만 주는 UX 라 본문이 필요 없고, 담으면 파일이 배로 는다
    vector: cache[c.id],
  })),
};
await writeFile(outFile, JSON.stringify(index));

const mb = (await readFile(outFile)).length / 1024 / 1024;
console.log(`\n인덱스    ${outFile}  (${mb.toFixed(1)}MB)`);
console.log(`캐시      ${cacheFile}`);
