// 임베딩 모델 네 개를 같은 방식으로 부른다.
//
// OpenAI 두 개는 HTTP 로, 로컬 두 개는 ollama 로 부르는데 호출 규약이 다르다.
// 채점 스크립트가 그 차이를 알 필요는 없으므로 여기서 덮는다.
//
//   import { embedAll, MODELS } from "./embedder.mjs";
//   const vecs = await embedAll("bge-m3", ["질문1", "질문2"], { as: "query" });
//
// 주의 — 모델마다 "질문" 과 "문서" 를 다르게 넣어야 하는 것이 있다.
// Qwen3-Embedding 은 질문 앞에 지시문을 붙이라고 모델 카드가 명시한다.
// 안 붙이면 점수가 눈에 띄게 떨어진다. bge-m3 는 반대로 아무것도 붙이지
// 않는 게 맞다. 그래서 as: "query" / "passage" 를 받는다.

const OLLAMA = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";

export const MODELS = {
  "text-embedding-3-large": {
    provider: "openai",
    dimensions: 1024, // 3072 에서 잘라 쓴다 (Matryoshka)
    pricePerMTok: 0.13,
    batch: 96,
  },
  "text-embedding-3-small": {
    provider: "openai",
    dimensions: 1536,
    pricePerMTok: 0.02,
    batch: 96,
  },
  "bge-m3": {
    provider: "ollama",
    dimensions: 1024,
    pricePerMTok: 0,
    batch: 16,
  },
  "qwen3-embedding:0.6b": {
    provider: "ollama",
    dimensions: 1024,
    pricePerMTok: 0,
    batch: 16,
    queryPrefix:
      "Instruct: Given a search query, retrieve relevant blog posts that answer the query\nQuery: ",
  },
};

export const modelInfo = name => {
  const m = MODELS[name];
  if (!m) {
    throw new Error(`모르는 모델: ${name}\n아는 것: ${Object.keys(MODELS).join(" · ")}`);
  }
  return m;
};

// 코사인 유사도를 내적으로 계산하려면 길이가 1 이어야 한다. OpenAI 는 이미
// 정규화해서 주지만 ollama 는 모델에 따라 다르다. 확인하지 말고 항상 맞춘다.
const normalize = v => {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n);
  if (!n) return v;
  return v.map(x => x / n);
};

async function openaiEmbed(model, dimensions, texts) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY 가 없다. .env 를 확인할 것.");
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, dimensions, input: texts }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status} ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const out = new Array(texts.length);
  for (const row of json.data) out[row.index] = row.embedding;
  return out;
}

async function ollamaEmbed(model, texts) {
  const res = await fetch(`${OLLAMA}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(
      `ollama ${res.status} ${body}\nollama serve 가 떠 있는지, ollama pull ${model} 을 했는지 확인할 것.`
    );
  }
  const json = await res.json();
  if (!json.embeddings?.length) throw new Error(`ollama 가 벡터를 안 줬다: ${JSON.stringify(json).slice(0, 200)}`);
  return json.embeddings;
}

// texts 전부를 벡터로. 진행률 콜백을 받는다 (로컬은 몇 분씩 걸린다).
export async function embedAll(model, texts, { as = "passage", onProgress } = {}) {
  const info = modelInfo(model);
  const prepared =
    as === "query" && info.queryPrefix ? texts.map(t => info.queryPrefix + t) : texts;

  const out = [];
  for (let i = 0; i < prepared.length; i += info.batch) {
    const slice = prepared.slice(i, i + info.batch);
    const vecs =
      info.provider === "openai"
        ? await openaiEmbed(model, info.dimensions, slice)
        : await ollamaEmbed(model, slice);
    for (const v of vecs) out.push(normalize(v));
    onProgress?.(Math.min(i + info.batch, prepared.length), prepared.length);
  }
  return out;
}

export const dot = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};
