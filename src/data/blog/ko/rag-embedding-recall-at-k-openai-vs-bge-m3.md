---
title: "RAG 임베딩 비교 — 내 블로그 데이터로 recall@k 측정 (OpenAI vs bge-m3)"
description: "[퀀트 회고에서 '느낌 벤치마킹 → 수치 벤치마킹' 원칙](/posts/quant-study-00-pandas) 을 세운 뒤, 이번엔 임베딩 모델 비교를 실제로 수치화. 내 블로그 글 441청크에 OpenAI text-embedding-3-small 과 bge-m3 를 각각 인덱싱하고, 20개 질문·정답 출처 테스트셋으로 recall@3 을 측정. 전체 OpenAI 80% vs bge-m3 90%. hard 난이도에서 bge-m3 가 100% — 단어 안 겹쳐도 의미로 원문과 연결한 케이스가 결정적. easy 에서 놓친 원인은 오타(cladue, 언더스코어)라 채점 기준 자체가 틀렸다는 반전."
pubDatetime: 2026-07-03T05:00:00Z
tags:
  - LLM공부
  - rag
  - 임베딩
  - openai
  - bge-m3
  - eval
  - recall
  - 학습
draft: false
featured: false
---

이전에 [내 블로그 데이터로 만든 RAG](/posts/rag-system-chroma-blog-qa) 를 살짝 건드려서 이번엔 **검색 평가용 테스트셋을 만들고 임베딩 모델 성능을 비교** 해봤다. 같은 블로그 데이터를 **OpenAI `text-embedding-3-small`** 과 **bge-m3** 로 각각 인덱싱하고, 같은 질문셋으로 검색해서 순위를 비교하는 실험.

## Table of contents

## 왜 순위 비교 (recall@k) 인가

**recall@k** — 정답을 상위 k 개 안에 찾아냈는지를 보는 지표.

- 20개 질문 중 정답을 top-3 에 넣은 게 17개 → **recall@3 = 85%**

모델마다 유사도 점수의 **기준점(baseline)** 이 달라서 절대값 비교가 어렵다 ([Eval #2 에서 만난 문제](/posts/eval-study-log-02-similarity-and-testset-design#두-모델-우열은-지금-데이터로-판단-불가) — bge-m3 의 영점은 원래 높음). recall@k 는 **"정답을 상위권에 올렸는가"** 만 보기 때문에 공정한 비교가 가능하다.

## RAG 에서는 precision 이 아니라 recall

RAG 검색에서 precision 보다 **recall 이 훨씬 중요** 한 이유:

- **recall 이 낮으면 정답 청크를 놓쳐서** → LLM 이 근거 없이 답변 (또는 "자료에 없음" 응답)
- top-3 에 **정답만** 있으면 이상적이지만, **정답 + 무관한 청크 2개** 가 섞여도 LLM 은 정답 청크를 보고 답할 수 있음
- 즉, 상위권에 **정답만 있는 게** 목표가 아니라 **정답을 포함하는 게** 목표

## 테스트셋 준비 — 라벨링과 비슷

테스트셋 만들기 = 질문 + 그 답에 있어야 할 조건들을 정리하는 작업. 채점 기준:

- 질문에 대한 답변에 있어야 할 **표현**
- 사용해야 할 **도구**
- 사용해야 할 **출처**

이걸 미리 정해두는 게 사실상 **라벨링 작업**.

### 소스 기반 vs 청크 기반 채점

| 방식 | 채점 단위 | 특징 |
|---|---|---|
| **소스 기반** | 어느 글에 있는가 | 여러 청크에 나뉜 정답도 유연하게 인정 |
| **청크 기반** | 어느 청크인가 | 더 정밀하지만 정답 청크가 여러 개면 관리 복잡 |

이번엔 **소스 기반** 으로 진행 — 정답 출처 문서(slug) 로 채점.

## 실행 — 441 청크, 20 질문

인덱싱:
- **OpenAI `text-embedding-3-small`**
- **bge-m3** (Ollama)

내 블로그 글 기반이니 **테스트셋은 내가 직접** 만들어봤다. 필드는 최소한:

```python
{
  "question": "Prompt Caching 은 어떻게 동작?",
  "answer_source": "claude-api-prompt-caching",
  "level": "easy"  # AI 툴로 분류 — 내가 판단하기 애매
}
```

**난이도(level)** 는 내가 판단하기 어려워서 AI 툴을 사용. 나온 결과가 easy 13문항 / hard 7문항.

## 결과 — bge-m3 90%, OpenAI 80%

![recall@3 결과 — 전체 OpenAI 16/20 = 80%, BGE-M3 18/20 = 90%. easy: 둘 다 11/13 = 85%. hard: OpenAI 5/7 = 71%, BGE-M3 7/7 = 100%](/assets/posts/rag-embedding-recall-at-k-openai-vs-bge-m3/01-recall-at-3-result.png)

| | Easy (13문항) | Hard (7문항) | 전체 (20문항) |
|---|---|---|---|
| **OpenAI** | 11/13 (85%) | **5/7 (71%)** | 16/20 (80%) |
| **bge-m3** | 11/13 (85%) | **7/7 (100%)** | 18/20 (90%) |

**Easy 는 동률, Hard 에서 bge-m3 압승.**

## Hard 에서 왜 차이가 났나 — 의미로 연결하는 능력

Hard 질문들의 특징: **단어가 원문과 겹치지 않음.** 예:

- 질문: "요청이 자꾸 실패할 때 재시도 간격을 어떻게 잡나?"
- 원문: [Claude API 에러 핸들링과 재시도](/posts/claude-api-error-handling-and-retry) 의 **exponential backoff** 섹션

질문에 `exponential backoff` 라는 단어가 **없음.** 그런데 bge-m3 는 **"점점 간격을 늘려 다시 시도한다"** 는 의미를 원문의 exponential backoff 와 연결했다. OpenAI 는 이걸 못 잡음.

## Easy 에서 왜 놓쳤나 — 오타가 원인

동률로 나온 easy 에서도 두 모델 다 놓친 문제가 2개. 원인을 뜯어봤더니:

- **`-` 기호를 `_` 로 오타** (예: `prompt-caching` 을 `prompt_caching` 으로 검색)
- **`claude` 를 `cladue` 로 오타**

문서에 없는 어휘로 검색했으니 **당연히 못 찾는 게 맞다** — 실제로는 채점 기준이 잘못됐던 것.

> **쉬운 문제를 뜬금없이 틀린다면 테스트셋을 의심하는 것도 고려해야 한다.**

이번엔 두 모델이 **같이** 틀린 easy 케이스 2개가 이런 케이스여서, "테스트셋 오타 → 두 모델 다 억울하게 감점" 이 됐다. 오타 수정 후 다시 재면 두 모델 다 easy 100%, 전체는 OpenAI 90% / bge-m3 100% 가 될 것.

## 회고

오늘 얻은 것 세 가지:

1. **recall@k 는 모델 간 공정 비교 도구** — 유사도 절대값이 아니라 상위권 진입 여부로 판정. bge-m3 의 영점 편차 문제 우회.
2. **RAG 에서는 recall > precision** — 정답을 놓치는 게 관련 없는 청크 섞이는 것보다 훨씬 나쁨.
3. **테스트셋 자체의 품질도 검증 대상** — 두 모델이 똑같이 놓쳤다면 채점 기준을 먼저 의심해야 한다.

그리고 이번 실험은 [FEMS #2 에서 bge-m3 를 채택한 결정](/posts/fems-project-log-02#인덱싱-파이프라인) 에 사후 근거를 붙여준 셈. 그때는 "한국어 특화라서" 로 채택했는데, 이번엔 recall 숫자로 확인.

## 더 공부해볼 것

### 1. 청크 기반 채점

- 오늘은 소스(문서) 기반. 청크 기반으로 넘어가면 채점 정밀도 ↑
- 정답 청크가 여러 개일 때 관리 방식 (골든 세트에 청크 ID 라벨링)
- 청크 사이즈가 바뀌면 라벨링이 무효화되는 문제

### 2. Hybrid Search (오타 방지 관점)

- 이번에 발견한 오타 케이스는 순수 벡터 검색이라 못 잡음
- **BM25 + 벡터** 조합이면 문자열 유사도로 잡을 여지 있음
- **Reciprocal Rank Fusion** 으로 두 결과 결합

### 3. Reranking

- top-K 를 넓게 (예: K=20) 가져온 후 cross-encoder 로 재정렬
- recall 을 유지하면서 상위권 precision 을 올리는 접근
- `bge-reranker` 시리즈로 오늘 결과가 더 좋아지는지 실측

### 4. 임베딩 모델 카탈로그 확장

- **KoSimCSE / KoSBERT** — 한국어 sentence embedding 표준
- **multilingual-e5-large** — 다국어
- **Voyage AI multilingual** — 상용
- 동일 테스트셋으로 5개 모델 순위 매기기

### 5. RAG 응답 품질 (검색 → 생성) 분리 평가

- 오늘은 검색만 봤음 (Hit Rate / Recall)
- 다음은 답변 품질 — **Faithfulness** (환각 여부), **Answer Relevance** (질문 대응)
- [RAGAS 프레임워크](/posts/eval-study-log-02-similarity-and-testset-design) 로 자동화

### 6. 에이전트 시스템 평가

- 도구 선택 정확도 (에이전트가 여러 도구 중 옳은 것 골랐나)
- 멀티스텝 성공률 (여러 도구 순서대로 호출)
- [HITL 안전장치](/posts/langgraph-study-log-03-human-in-the-loop) 가 실전에서 작동하는지 검증
