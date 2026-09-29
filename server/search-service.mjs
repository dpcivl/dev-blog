// 질문을 받아 글 링크를 돌려주는 작은 서비스.
//
//   node server/search-service.mjs
//   curl 'http://127.0.0.1:8787/api/search?q=프롬프트 캐싱'
//
// 하는 일은 셋뿐이다.
//   1. 질문을 OpenAI 로 보내 벡터로 바꾼다  (199ms — 여기가 전부다)
//   2. 램에 든 인덱스와 내적한다              (2ms)
//   3. 점수가 하한선을 넘는 것만 링크로 돌려준다
//
// 모델을 서버에 안 올리는 이유: bge-m3 는 가중치만 1.13GB 라 512MB 인스턴스에
// 안 들어간다. 대신 질문만 밖으로 내보낸다. 질문 1건이 약 20토큰이라
// 월 1만 건에 $0.03 이다.
//
// ⚠️ 이 엔드포인트 뒤에는 유료 API 키가 있다. 누가 두들기면 그대로 청구서가
//    된다. nginx 쪽 limit_req 와 별개로 여기서도 막는다 (앞단 설정이 언젠가
//    실수로 빠질 수 있으므로 돈이 나가는 자리는 두 겹으로 둔다).

import { createServer } from "node:http";
import { loadIndex, search } from "../scripts/embed/read-index.mjs";

const PORT = Number(process.env.SEARCH_PORT ?? 8787);
const HOST = process.env.SEARCH_HOST ?? "127.0.0.1";
const INDEX = process.env.SEARCH_INDEX ?? "public/search/index.bin";
const KEY = process.env.OPENAI_API_KEY;

// 하한선 — score.mjs 의 맞바꿈 곡선에서 골랐다 (text-embedding-3-large 기준).
//
//   0.408   정답 31/35 유지 · 헛답 6/15
//   0.422   정답 30/35 유지 · 헛답 3/15   ← 기본값
//   0.433   정답 27/35 유지 · 헛답 2/15
//   0.495   정답 25/35 유지 · 헛답 0/15
//
// 헛답을 0 으로 만들려면 맞히던 것의 4분의 1을 버려야 한다. 없는 걸 없다고
// 하는 것보다 있는 걸 보여주는 쪽이 이 블로그엔 낫다고 보고 0.422 로 둔다.
// 모델을 바꾸면 이 숫자는 못 쓴다 — 점수의 절대값은 모델 간에 비교가 안 된다.
const FLOOR = Number(process.env.SEARCH_FLOOR ?? 0.422);

const MAX_QUERY = 100;   // 글자. 이보다 긴 건 질문이 아니라 본문 붙여넣기다
const TOP = 5;
const CACHE_MAX = 500;

// 분당 요청 수 (IP 당). 사람이 검색창을 두들겨도 분당 20을 넘기 어렵다.
const RATE_PER_MIN = Number(process.env.SEARCH_RATE ?? 20);

if (!KEY) {
  console.error("OPENAI_API_KEY 가 없다. systemd 유닛의 EnvironmentFile 을 확인할 것.");
  process.exit(1);
}

const index = await loadIndex(INDEX);
console.log(
  `인덱스 ${INDEX} · ${index.meta.model} · ${index.dims}차원 · 조각 ${index.count}개 · ${index.meta.builtAt}`
);

// ── 질문 벡터 캐시 ──
// 화면의 템플릿 질문 다섯 개가 제일 많이 눌릴 텐데 매번 API 를 부를 이유가 없다.
const cache = new Map();
const cached = q => {
  const v = cache.get(q);
  if (v) {
    cache.delete(q);      // 최근 쓴 것을 뒤로 — 오래된 것부터 밀려나게
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
  const vector = (await res.json()).data[0].embedding;
  remember(q, vector);
  return { vector, cached: false };
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
      builtAt: index.meta.builtAt,
      floor: FLOOR,
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
    const { vector, cached: fromCache } = await embedQuery(q);
    const rows = search(index, vector, TOP).filter(r => r.score >= FLOOR);
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
  console.log(`듣는 중 http://${HOST}:${PORT}/api/search · 하한선 ${FLOOR} · 분당 ${RATE_PER_MIN}회`);
});
