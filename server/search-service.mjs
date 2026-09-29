// 질문을 받아 글 링크를 돌려주는 작은 서비스.
//
//   node --max-old-space-size=128 server/search-service.mjs
//   curl 'http://127.0.0.1:8787/api/search?q=프롬프트 캐싱'
//
// 하는 일
//   1. 질문을 OpenAI 로 보내 벡터로 바꾼다        199ms — 여기가 전부다
//   2. 램에 든 인덱스와 내적한다                    2ms
//   3. 질문의 낱말이 실제로 나오는 글을 밀어 올린다     1ms
//   4. 하한선을 넘는 것만 링크로 돌려준다
//
// 모델을 서버에 안 올리는 이유: bge-m3 는 가중치만 1.13GB 라 512MB
// 인스턴스에 안 들어간다. 대신 질문만 밖으로 내보낸다. 질문 1건이 약
// 20토큰이라 월 1만 건에 $0.03 이다.
//
// ⚠️ 이 엔드포인트 뒤에는 유료 API 키가 있다. 누가 두들기면 그대로 청구서가
//    된다. nginx 쪽 limit_req 와 별개로 여기서도 막는다 — 돈이 나가는 자리는
//    앞단 설정이 언젠가 실수로 빠질 것을 가정하고 두 겹으로 둔다.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { loadIndex } from "../scripts/embed/read-index.mjs";
import { keywordScores } from "../scripts/embed/keyword.mjs";

const PORT = Number(process.env.SEARCH_PORT ?? 8787);
const HOST = process.env.SEARCH_HOST ?? "127.0.0.1";
const INDEX = process.env.SEARCH_INDEX ?? "public/search/index.bin";
const KEYWORDS = process.env.SEARCH_KEYWORDS ?? "public/search/keywords.json";
const KEY = process.env.OPENAI_API_KEY;

// ── 운영점 ──
// score-hybrid.mjs 로 쓸어서 고른 값이다. 테스트셋 50문항 기준.
//
// 헛답 수를 같게 놓고 견줘야 공정하다 (하한선을 한쪽만 고정하면 혼합이
// 손해 보는 것처럼 보인다). 같은 헛답에서 맞힌 수는 이렇다.
//
//   헛답 0/15   혼합 28/35   벡터만 26/35
//   헛답 1/15   혼합 28/35   벡터만 26/35
//   헛답 2/15   혼합 29/35   벡터만 28/35
//   헛답 3/15   혼합 30/35   벡터만 30/35
//
// 헛답 0 지점을 골랐다. 없는 걸 없다고 말하는 게 이 화면의 요구였고,
// 맞힘은 한 문항 차이다. 더 보여주고 싶으면 SEARCH_FLOOR 를 낮추면 된다
// (0.44 로 내리면 30/35 · 헛답 3/15).
//
// 관문은 품질에는 기여하지 않는다 — 제일 좋은 설정들이 전부 관문 0 이었다.
// 그런데도 낮게 남겨두는 이유는 돈이다. 「김치찌개 끓이는 법」처럼 블로그의
// 낱말이 하나도 안 걸리는 질문은 OpenAI 를 부르기 전에 끊는다. 긍정 문항
// 중 제일 낮은 값이 0.307 이라 0.05 는 넉넉히 안전하다.
//
// 모델을 바꾸면 이 세 숫자는 전부 다시 재야 한다. 점수의 절대값은 모델
// 간에 비교가 안 된다. 남은 개선안은 docs/search-backlog.md.
const GATE = Number(process.env.SEARCH_GATE ?? 0.05);
const BOOST = Number(process.env.SEARCH_BOOST ?? 0.15);
const FLOOR = Number(process.env.SEARCH_FLOOR ?? 0.47);

const MAX_QUERY = 100;   // 글자. 이보다 길면 질문이 아니라 본문 붙여넣기다
const TOP = 5;

// 질문 벡터 캐시. 화면의 템플릿 질문 다섯 개가 제일 많이 눌릴 텐데 매번
// API 를 부를 이유가 없다. 200개면 1,024차원 float32 기준 약 0.8MB 다
// (평범한 배열로 두면 숫자 하나가 8바이트라 두 배가 된다).
const CACHE_MAX = Number(process.env.SEARCH_CACHE ?? 200);

const RATE_PER_MIN = Number(process.env.SEARCH_RATE ?? 20);

if (!KEY) {
  console.error("OPENAI_API_KEY 가 없다. systemd 유닛의 EnvironmentFile 을 확인할 것.");
  process.exit(1);
}

const index = await loadIndex(INDEX);
const keywords = new Map(Object.entries(JSON.parse(await readFile(KEYWORDS, "utf8"))));
console.log(
  `인덱스 ${index.meta.model} · ${index.dims}차원 · 조각 ${index.count}개 · 낱말 ${keywords.size}편 · ${index.meta.builtAt}`
);
if (keywords.size === 0) console.warn("⚠ 낱말 파일이 비었다 — 보정과 관문이 무력해진다");

// ── 질문 벡터 캐시 (LRU) ──
const cache = new Map();
const cached = q => {
  const v = cache.get(q);
  if (v) {
    cache.delete(q);       // 최근 쓴 것을 뒤로 — 오래된 것부터 밀려나게
    cache.set(q, v);
  }
  return v;
};
const remember = (q, v) => {
  cache.set(q, v);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
};

// ── 레이트 리밋 ──
const buckets = new Map();
function allowed(ip) {
  const now = Date.now();
  const b = buckets.get(ip) ?? { count: 0, until: now + 60_000 };
  if (now > b.until) {
    b.count = 0;
    b.until = now + 60_000;
  }
  b.count++;
  buckets.set(ip, b);
  return b.count <= RATE_PER_MIN;
}
// 오래된 통을 치운다. 안 치우면 봇이 IP 를 바꿔가며 두드릴 때 램이 샌다.
setInterval(() => {
  const now = Date.now();
  for (const [ip, b] of buckets) if (now > b.until + 60_000) buckets.delete(ip);
}, 60_000).unref();

async function embedQuery(q) {
  const hit = cached(q);
  if (hit) return { vector: hit, cached: true };

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: index.meta.model, dimensions: index.dims, input: q }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  // float32 로 담는다. 평범한 배열은 숫자 하나에 8바이트라 캐시가 두 배가 되고,
  // 인덱스가 float32 라 어차피 그 정밀도 이상은 쓰이지도 않는다.
  const vector = Float32Array.from((await res.json()).data[0].embedding);
  remember(q, vector);
  return { vector, cached: false };
}

// 벡터 점수에 낱말 덮음을 얹어 글 단위 상위 k개
function rank(qvec, kw) {
  const { dims, count, meta, vectors } = index;
  const best = new Map();
  for (let i = 0; i < count; i++) {
    const off = i * dims;
    let s = 0;
    for (let d = 0; d < dims; d++) s += qvec[d] * vectors[off + d];
    const c = meta.chunks[i];
    const prev = best.get(c.slug);
    if (!prev || s > prev.vec) best.set(c.slug, { ...c, vec: s });
  }
  return [...best.values()]
    .map(r => ({ ...r, score: r.vec + BOOST * (kw.coverage.get(r.slug) ?? 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP)
    .filter(r => r.score >= FLOOR);
}

const json = (res, code, body) => {
  const s = JSON.stringify(body);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(s),
    "Cache-Control": "no-store",
  });
  res.end(s);
};

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");

  if (url.pathname === "/api/search/health") {
    return json(res, 200, {
      ok: true,
      model: index.meta.model,
      chunks: index.count,
      posts: keywords.size,
      builtAt: index.meta.builtAt,
      gate: GATE,
      boost: BOOST,
      floor: FLOOR,
      // 운영 중에 램이 어디로 가는지 보려고 통째로 낸다. rss 만 보면
      // V8 이 아직 안 돌려준 페이지인지, 정말 쓰고 있는 건지 구분이 안 된다.
      memoryMb: Object.fromEntries(
        Object.entries(process.memoryUsage()).map(([k, v]) => [k, Math.round(v / 1024 / 1024)])
      ),
    });
  }
  if (url.pathname !== "/api/search") return json(res, 404, { error: "not found" });

  // nginx 뒤에 있으므로 진짜 주소는 X-Forwarded-For 에 있다
  const ip = (req.headers["x-forwarded-for"] ?? "").split(",")[0].trim() || req.socket.remoteAddress;
  if (!allowed(ip)) return json(res, 429, { error: "너무 잦은 요청" });

  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) return json(res, 400, { error: "q 가 비었다" });
  if (q.length > MAX_QUERY) return json(res, 400, { error: `질문은 ${MAX_QUERY}자까지` });

  const t0 = Date.now();
  try {
    // 낱말 검사를 먼저 한다. 관문에 걸리면 OpenAI 를 부르지 않아도 되므로
    // 돈과 시간을 둘 다 아낀다.
    const kw = keywordScores(keywords, q);
    if (kw.best < GATE) {
      return json(res, 200, { query: q, results: [], reason: "no-topic", tookMs: Date.now() - t0 });
    }

    const { vector, cached: fromCache } = await embedQuery(q);
    const rows = rank(vector, kw);
    return json(res, 200, {
      query: q,
      results: rows.map(r => ({
        title: r.title,
        heading: r.heading || null,
        url: `/posts/${r.slug}/`,
        score: Number(r.score.toFixed(4)),
      })),
      cached: fromCache,
      tookMs: Date.now() - t0,
    });
  } catch (err) {
    // 밖으로는 안 흘린다. 키가 틀렸는지 한도를 넘었는지는 서버 로그에만 남긴다.
    console.error(`[search] "${q.slice(0, 40)}" 실패:`, err.message);
    return json(res, 503, { error: "검색을 잠시 쓸 수 없다" });
  }
}).listen(PORT, HOST, () => {
  console.log(`듣는 중 http://${HOST}:${PORT}/api/search · 관문 ${GATE} · 보정 ${BOOST} · 하한선 ${FLOOR} · 분당 ${RATE_PER_MIN}회`);
});
