// pack-index.mjs 가 구운 파일을 읽는다. 서버와 검증 스크립트가 같이 쓴다.

import { readFile } from "node:fs/promises";

export async function loadIndex(file) {
  const buf = await readFile(file);
  if (buf.length < 15 || buf.toString("ascii", 0, 4) !== "PHIX") {
    throw new Error(`${file} 은 인덱스 파일이 아니다`);
  }
  const version = buf.readUInt8(4);
  if (version !== 1) throw new Error(`모르는 판 번호 ${version}`);

  const dims = buf.readUInt16LE(5);
  const count = buf.readUInt32LE(7);
  const metaLen = buf.readUInt32LE(11);
  const meta = JSON.parse(buf.toString("utf8", 15, 15 + metaLen));

  const pad = (4 - ((15 + metaLen) % 4)) % 4;
  const vecOffset = 15 + metaLen + pad;
  const expected = vecOffset + count * dims * 4;
  if (buf.length !== expected) {
    throw new Error(`파일 길이가 안 맞는다: ${buf.length} ≠ ${expected} — 전송이 잘렸을 수 있다`);
  }

  // 복사하지 않고 같은 메모리를 실수 배열로 본다. 5MB 를 두 벌 들 이유가 없다.
  const vectors = new Float32Array(buf.buffer, buf.byteOffset + vecOffset, count * dims);
  return { dims, count, meta, vectors };
}

// 질문 벡터 하나로 전체를 훑어 글 단위 상위 k개. 조각이 1,300개뿐이라
// 근사 색인(HNSW 등)이 필요 없다 — 전수로 2ms 다.
export function search(index, qvec, top = 5) {
  const { dims, count, meta, vectors } = index;
  const best = new Map();
  for (let i = 0; i < count; i++) {
    const off = i * dims;
    let s = 0;
    for (let d = 0; d < dims; d++) s += qvec[d] * vectors[off + d];
    const c = meta.chunks[i];
    const prev = best.get(c.slug);
    if (!prev || s > prev.score) best.set(c.slug, { ...c, score: s });
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, top);
}
