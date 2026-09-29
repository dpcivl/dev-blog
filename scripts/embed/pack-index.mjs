// JSON 인덱스를 바이너리로 굽는다.
//
//   node scripts/embed/pack-index.mjs --model text-embedding-3-large
//
// 왜: JSON 은 실수 하나를 "0.023841858" 같은 십진수 글자로 적는다. 숫자
// 하나에 4바이트면 될 것이 11바이트가 된다. 27MB 가 5MB 가 되는 이유가
// 그것뿐이고, 정밀도는 하나도 안 잃는다 (float32 그대로 담는다).
//
// 서버가 이 파일을 통째로 읽어 램에 들고 있는다. 512MB 짜리 인스턴스라
// 5MB 는 부담이 없지만 27MB 를 JSON.parse 하면 파싱 중 순간 램이 몇 배로
// 뛴다. 그래서 굽는다.
//
// 형식 (리틀 엔디언)
//   0   4B   매직 "PHIX"
//   4   1B   판 번호
//   5   2B   차원
//   7   4B   조각 수
//   11  4B   메타 길이
//   15  ?    메타 JSON  { model, builtAt, chunks: [{slug,title,heading}] }
//   ?   ?    4바이트 경계까지 0 채움  ← Float32Array 는 4의 배수에서만 잡힌다
//   ?   ?    벡터 float32 × 조각 수 × 차원

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { modelInfo } from "./embedder.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const MODEL = arg("model", "text-embedding-3-large");
const DIMS = Number(arg("dimensions", modelInfo(MODEL).dimensions));
const OUT = arg("out", "public/search/index.bin");

const src = path.join(".cache/embeddings", `${MODEL}-${DIMS}.json`);
const index = JSON.parse(await readFile(src, "utf8"));

const count = index.chunks.length;
if (index.dimensions !== DIMS) throw new Error(`차원이 안 맞는다: ${index.dimensions} ≠ ${DIMS}`);

const meta = Buffer.from(
  JSON.stringify({
    model: index.model,
    dimensions: DIMS,
    builtAt: index.builtAt,
    chunks: index.chunks.map(c => ({ slug: c.slug, title: c.title, heading: c.heading })),
  })
);

const HEAD = 15;
const pad = (4 - ((HEAD + meta.length) % 4)) % 4;
const vecOffset = HEAD + meta.length + pad;
const buf = Buffer.alloc(vecOffset + count * DIMS * 4);

buf.write("PHIX", 0, "ascii");
buf.writeUInt8(1, 4);
buf.writeUInt16LE(DIMS, 5);
buf.writeUInt32LE(count, 7);
buf.writeUInt32LE(meta.length, 11);
meta.copy(buf, HEAD);

const vectors = new Float32Array(buf.buffer, buf.byteOffset + vecOffset, count * DIMS);
for (const [i, c] of index.chunks.entries()) {
  if (c.vector.length !== DIMS) throw new Error(`조각 ${i} 의 차원이 ${c.vector.length}`);
  vectors.set(c.vector, i * DIMS);
}

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, buf);

// 구운 걸 다시 읽어 원본과 대조한다. 형식을 손으로 짰으니 어긋나면
// 검색이 조용히 엉뚱한 글을 주는 식으로 틀린다 — 그게 제일 안 잡힌다.
const { loadIndex } = await import("./read-index.mjs");
const back = await loadIndex(OUT);
if (back.count !== count) throw new Error("조각 수가 다르다");
let worst = 0;
for (let i = 0; i < count; i += 97) {
  const orig = index.chunks[i].vector;
  for (let d = 0; d < DIMS; d++) {
    worst = Math.max(worst, Math.abs(orig[d] - back.vectors[i * DIMS + d]));
  }
  if (back.meta.chunks[i].slug !== index.chunks[i].slug) throw new Error(`메타가 어긋났다 (${i})`);
}
if (worst > 1e-6) throw new Error(`값이 달라졌다: 최대 오차 ${worst}`);

const mb = n => (n / 1024 / 1024).toFixed(1) + "MB";
console.log(`모델      ${index.model} · ${DIMS}차원 · 조각 ${count}개`);
console.log(`원본      ${src}  ${mb((await readFile(src)).length)}`);
console.log(`구운 것    ${OUT}  ${mb(buf.length)}`);
console.log(`검증      되읽어 대조 · 최대 오차 ${worst.toExponential(1)} ✅`);
