// 질문의 낱말이 글에 실제로 나오는지 본다. 벡터 검색과 짝을 이룬다.
//
// 왜 필요한가 — 벡터만으로는 "없는 주제" 를 못 거른다. 실측이다.
//
//   "느려진 원인을 어떻게 찾았나"   정답을 1등으로 맞힘   0.364
//   "쿠버네티스 파드가 재시작될 때"  답이 없는 질문       0.414
//
// 맞힌 쪽이 더 낮다. 하한선을 어디에 그어도 둘 중 하나는 틀린다. 그런데
// 「쿠버네티스」는 89편 어디에도 한 글자도 안 나온다. 이건 점수가 아니라
// 사실이라 훨씬 확실한 근거다.
//
// 한국어 조사 문제는 형태소 분석기 없이 처리한다. 「자바에서」가 안 걸리면
// 끝 글자를 하나씩 떼며 「자바에」·「자바」까지 내려가 본다. 조사 목록을
// 외우는 것보다 이쪽이 사전에 없는 말에도 통한다. 대신 두 글자 밑으로는
// 안 내려간다 — 한 글자는 아무 데나 걸린다.

export const norm = s => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

// 질문에는 있지만 주제를 가리키지 않는 말. 이걸 안 빼면 「~에 대해 알려줘」가
// 붙은 질문마다 「대해」가 온 블로그에 걸려서 없는 주제도 있다고 판정한다.
const STOP = new Set([
  "어떻게", "무엇", "어디", "언제", "관련", "대해", "대한", "있나요", "있어",
  "있나", "알려줘", "알려주세요", "방법", "이유", "하나요", "하나", "되나",
  "되나요", "그런", "정도", "보여주세요", "궁금", "궁금해요", "저는", "제가",
  "우리", "내가", "때문", "라고", "인가요", "인가", "일까요", "건가요", "한다",
]);

export function terms(query) {
  return query
    .split(/[\s,.?!·…"'"''()[\]{}<>/\\|:;~\-+=*&^%$#@]+/u)
    .map(norm)
    .filter(t => t.length >= 2 && !STOP.has(t));
}

// 낱말 하나를 "실제로 글에 나오는 형태" 로 바꾼다. 없으면 null.
//
// 조사를 떼는 일은 글마다가 아니라 낱말마다 한 번만 한다. 글마다 하면
// 89편 × 낱말수 만큼 slice 가 생기는데, 그것 때문에 질문 50건에 램이
// 66MB 에서 117MB 로 뛰었다 (새는 건 아니고 GC 가 늦을 뿐이지만, 512MB
// 인스턴스에서는 늦는 것도 문제다).
function resolve(term, texts) {
  const anyHas = f => {
    for (const t of texts) if (t.includes(f)) return true;
    return false;
  };
  if (anyHas(term)) return term;
  // ASCII 낱말은 조사가 안 붙으므로 자르지 않는다. terraform 을 terra 로
  // 줄이면 없는 걸 있다고 하게 된다.
  if (!/[가-힣]/.test(term)) return null;
  for (let len = term.length - 1; len >= 2; len--) {
    const cut = term.slice(0, len);
    if (anyHas(cut)) return cut;
  }
  return null;
}

// 낱말마다 무게를 다르게 준다 (IDF).
//
// 이게 없으면 관문이 아예 안 걸린다. 실제로 그랬다 — 「쿠버네티스 파드가
// 계속 재시작될 때」에서 「쿠버네티스」와 「파드」는 89편 어디에도 없지만
// 「계속」이 31편, 「재시작」이 6편에 있어서 "반은 찾았다" 가 돼버렸다.
//
// 89편 전부에 나오는 「하는」·「으로」는 주제를 하나도 안 가리킨다. 반대로
// 한 편에만 나오는 낱말은 그 글을 거의 지목한다. 그래서 흔할수록 무게를
// 깎는다. 한 편도 없는 낱말은 무게가 제일 큰데, 그 무게만큼 어느 글도
// 점수를 못 채우게 되는 것이 관문의 원리다.
const idf = (df, n) => Math.log(n / Math.max(df, 0.5));

export function keywordScores(index, query) {
  const ts = terms(query);
  if (!ts.length) return { terms: ts, best: 1, coverage: new Map() };

  const slugs = [...index.keys()];
  const texts = [...index.values()];
  const n = slugs.length;

  // 낱말마다: 실제 형태 · 나오는 글의 첨자 목록
  const forms = [];
  for (const t of ts) {
    const form = resolve(t, texts);
    if (!form) {
      forms.push({ term: t, form: null, posts: null, df: 0 });
      continue;
    }
    const posts = [];
    for (let i = 0; i < n; i++) if (texts[i].includes(form)) posts.push(i);
    forms.push({ term: t, form, posts, df: posts.length });
  }

  const weights = forms.map(f => idf(f.df, n));
  const total = weights.reduce((a, b) => a + b, 0);
  if (!total) return { terms: ts, best: 1, coverage: new Map() };

  // 글마다 덮인 무게를 더한다. 글을 바깥 고리로 돌면 89 × 낱말수 만큼
  // includes 를 다시 부르게 되므로, 위에서 구한 첨자 목록만 훑는다.
  const acc = new Float64Array(n);
  for (const [j, f] of forms.entries()) {
    if (!f.posts) continue;
    for (const i of f.posts) acc[i] += weights[j];
  }

  const coverage = new Map();
  let best = 0;
  for (let i = 0; i < n; i++) {
    if (!acc[i]) continue;
    const v = acc[i] / total;
    coverage.set(slugs[i], v);
    if (v > best) best = v;
  }
  return { terms: ts, best, coverage };
}
