// 글 본문을 낱말 검사용으로 굽는다.
//
//   node scripts/embed/build-keywords.mjs
//
// 기호와 공백을 다 지운 소문자 덩어리 하나를 글마다 둔다. 토큰으로 쪼개지
// 않는 이유는 한국어를 낱말 단위로 정확히 쪼개려면 형태소 분석기가 필요한데,
// 부분 문자열로 찾으면 그게 필요 없기 때문이다. 89편 전체가 27만 자라
// 전부 훑어도 1ms 다.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { collectChunks } from "./chunk.mjs";
import { norm } from "./keyword.mjs";

const OUT = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : "public/search/keywords.json";

const chunks = await collectChunks();
const byPost = new Map();
for (const c of chunks) {
  // 제목과 소제목도 넣는다. 키워드로 검색하는 사람은 제목의 말을 치는 일이 잦다.
  const piece = `${c.title} ${c.heading ?? ""} ${c.text}`;
  byPost.set(c.slug, (byPost.get(c.slug) ?? "") + piece);
}

const out = {};
for (const [slug, text] of byPost) out[slug] = norm(text);

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(out));

const bytes = (await readFile(OUT)).length;
const chars = Object.values(out).reduce((a, s) => a + s.length, 0);
console.log(`글 ${Object.keys(out).length}편 · ${chars.toLocaleString()}자 · ${(bytes / 1024).toFixed(0)}KB → ${OUT}`);
