---
title: "FEMS 프로젝트 #1 — 면접 일주일, 저사양 로컬 (Ollama + bge-m3 + Chroma) vs Claude API RAG 비교 셋업"
description: "원하는 회사 면접이 일주일 남아 FEMS (Factory Energy Management System) 도메인 RAG 프로토타입을 짠다. GTX1660 Super · VRAM 6GB 의 저사양 환경에서 로컬 LLM(Ollama) 으로 추론하는 것과 Claude / OpenAI API 를 호출하는 것을 비교. 임베딩은 한국어 강한 bge-m3, 벡터 DB 는 Chroma. 콜드스타트 95초 → 워밍업 후 10초까지 줄어든 ollama, 정답률은 클라우드와 동등."
pubDatetime: 2026-06-25T12:00:00Z
tags:
  - fems
  - rag
  - ollama
  - llm
  - claude-api
  - 벡터db
  - 학습
draft: false
featured: false
---

새 시리즈 시작. **FEMS (Factory Energy Management System)** 프로젝트 일지.

배경부터 말하면 — **원하는 회사 면접이 잡혔고, 일주일이 남았다.** 그 일주일 동안 FEMS 관련 RAG 프로토타입을 만들어보면서 도메인 어휘와 시스템 감각을 손에 익히려 한다. 면접에서 "공부했습니다" 보다 "이 정도까지 돌려봤습니다" 가 훨씬 단단하니까.

이 시리즈에서 경험하게 될 기술:

- **RAG**
- **허깅페이스, Ollama**
- **임베딩, 벡터 DB**
- **토큰 사용 전략 / 로컬 vs 클라우드 비교**

RAG · 임베딩 · 벡터 DB 는 최근 [RAG 직접 구현](/posts/rag-from-scratch-embedding-and-similarity-search) / [RAG 시스템 구축](/posts/rag-system-chroma-blog-qa) 에서 다뤄봤기 때문에 그나마 친숙. **로컬 LLM (Ollama)** 이 새로 추가되는 축.

## Table of contents

## 사양 체크 — VRAM 6GB 가 가른다

| 항목 | 값 |
|---|---|
| OS | Windows 11 |
| GPU | GTX 1660 Super |
| VRAM | **6 GB** |
| RAM | 32 GB |

로컬 LLM 의 가성비/속도는 **VRAM** 이 가른다. **VRAM 6GB 는 큰 모델이 안 돌아간다.** 7B 모델도 양자화(4bit) 안 하면 빠듯. 13B 이상은 사실상 불가.

그래서 **프로젝트 방향을 비교 실험으로** 잡았다:

> **저사양 온프레미스 환경에서 로컬 추론 vs Claude / OpenAI API 호출 — 어느 쪽이, 어떤 상황에서 합리적인가**

면접 도메인이 **FEMS** 라는 점에서도 자연스러운 질문이다. 공장은 데이터 외부 반출이 까다로워서 **온프레미스 추론** 수요가 분명히 있고, 동시에 도입 비용(GPU) 도 부담스러우니까 **저사양에서 어디까지 되는지** 가 실무적 질문이 된다.

## 데이터 — FEMS 도메인 문서 어떻게 모을까

RAG 가 답변할 근거 문서가 필요하다. FEMS 도메인에서 가능한 후보:

- **FEMS 매뉴얼 / 가이드라인 문서**
- **에너지 데이터 분석 리포트**
- **FEMS DB 의 측정값**

오늘은 일단 **테스트용 가이드라인을 직접 작성** 해서 RAG 동작부터 검증. 내일부터 **한국에너지공단 FEMS 구축 가이드, 에너지절약 기술자료** 같은 공개 PDF 를 붙일 예정.

## 셋업 — Python 스캐폴딩 + Ollama

기본 골격:

- Python 프로젝트 스캐폴딩
- **Ollama** 설치 (로컬 LLM 런타임)
- Provider 3종 (Ollama / Claude / OpenAI) 을 동일한 인터페이스로 호출하는 어댑터

### Smoke test — 첫 실행 (콜드 스타트)

세 provider 가 동일한 질문에 답하는지부터 확인:

![Smoke test 첫 실행 — ollama 콜드스타트로 95.22초, claude 2.72초, openai 6.43초](/assets/posts/fems-project-log-01/01-smoke-test-cold-start.png)

| provider | latency | in / out 토큰 | 비용 |
|---|---|---|---|
| **ollama** | 95.22s | 47 / 36 | $0.00000 |
| **claude** (opus) | 2.72s | 60 / 73 | $0.00213 |
| **openai** (gpt-4o) | 6.43s | 45 / 30 | $0.00041 |

**3개 다 정답.** 차이는 latency 와 비용:

- **Opus 가 gpt-4o 보다 약 5배 비쌈** ($0.00213 vs $0.00041)
- **ollama 가 95초** — 콜드 스타트 때문. 첫 호출이 모델 로딩이라 대부분이 로딩 시간.

### Smoke test — 두 번째 실행 (워밍업 후)

이미 모델이 메모리에 올라온 상태로 다시 돌리면:

![Smoke test 두 번째 실행 — ollama 가 10초로 단축, claude 2.46초, openai 2.62초](/assets/posts/fems-project-log-01/02-smoke-test-warm.png)

- **ollama**: 95s → **10.00s** (콜드 스타트 풀린 결과)
- claude: 2.72s → 2.46s
- openai: 6.43s → 2.62s

**95초 vs 10초** 의 차이는 운영적으로 매우 크다. 즉, **로컬 LLM 은 "처음 한 번" 을 어떻게 다루느냐** 가 latency 핵심:

- 항상 메모리에 올려둘 것인가 (메모리 소모)
- 사용 빈도에 따라 swap 할 것인가 (그때마다 콜드)

운영 모드 설계의 핵심 질문이 됨.

## 임베딩 모델 선정 — Ollama 의 bge-m3

임베딩을 **Ollama 의 `bge-m3`** 로 결정.

**선정 이유:**

- **한국어/다국어 우수** — FEMS 가이드라인이 한국어니까 핵심 조건
- **별도 임베딩 API 불필요** — Ollama 가 LLM 도 임베딩도 같이 줌
- **로컬 완결** — 외부 API 호출 없이 임베딩까지

**검토했지만 안 쓴 것:**

| 옵션 | 안 쓴 이유 |
|---|---|
| LangChain / LlamaIndex | 의존성이 너무 무겁고 추상화 과함 |
| sentence-transformers (로컬) | torch 설치 무겁고, Ollama 가 더 합리적 |

그리고 한 가지 주의 — **Chroma 의 기본 임베딩 함수는 영어 특화.** 한국어 문서를 그대로 넣으면 임베딩 품질이 떨어진다. 그래서 **임베딩을 직접 계산해서 Chroma 에 주입** 하는 식으로 진행.

> 지난 [RAG 직접 구현 글](/posts/rag-from-scratch-embedding-and-similarity-search) 에서 OpenAI 임베딩으로 한국어를 돌렸을 때 유사도 절대값이 0.3 ~ 0.5 수준으로 낮게 나왔었다. bge-m3 는 다국어 특화라 이 점이 개선되는지가 이번 검증 포인트.

## 인덱스 구축 — 청크 5개부터

테스트용 가이드라인을 **800자 이하로 청크 분할** 후 인덱싱:

![build_index 실행 — 5 chunks loaded, bge-m3 임베딩, Chroma 에 인덱싱](/assets/posts/fems-project-log-01/03-build-index-chroma.png)

```
Loaded 5 chunks from data/documents
Embedding with bge-m3 (Ollama)...
Indexed 5 chunks into chroma db/
```

총 **5 청크**:

- 압축공기 시스템 효율 가이드라인
- 피크 전력 관리 가이드라인
- 공조설비(HVAC) 최적화 가이드라인
- 에너지 절감 조명 가이드라인
- (그 외 1개)

## RAG 동작 검증 — 3 질문 모두 정답

지정된 질문에 대해 **출처가 정확히 매칭되는지** 확인:

![rag_demo 결과 — 3 질문 모두 1순위 매칭 정답. 압축공기/피크전력/조명 가이드라인 각각](/assets/posts/fems-project-log-01/04-rag-demo-results.png)

| 질문 | 1순위 매칭 | dist (cosine 거리) |
|---|---|---|
| 압축공기 시스템에서 에너지 낭비를 줄이려면? | `02_compressed_air.md` | **0.322** |
| 공장 전기요금의 피크 수요를 낮추는 방법은? | `01_peak_demand.md` | **0.272** |
| 야간이나 주말에 조명 전력이 계속 잡히면 무엇을 점검? | `04_lighting.md` | **0.392** |

**3개 다 정답.** (cosine distance 는 낮을수록 유사 — 0 이면 동일, 1 이면 무관)

특히 **두 번째 질문 (피크 수요)** 의 dist 0.272 는 굉장히 잘 매칭된 것. **bge-m3 가 한국어를 제대로 다루고 있다** 는 의미.

> 이전 글에서 OpenAI `text-embedding-3-small` 로 한국어를 돌렸을 땐 1위 유사도가 0.3 ~ 0.5 사이였는데, bge-m3 는 0.27 ~ 0.39 (distance, 낮을수록 좋음 → 유사도로 환산 시 0.6 ~ 0.73). 다국어 임베딩의 차이가 숫자로 드러남.

## 회고 — 일단 백본은 섰다

오늘 하루로 잡힌 골격:

- Python 스캐폴딩 ✅
- Ollama 로컬 모델 동작 ✅
- 3-provider 동시 호출 (ollama / claude / openai) ✅
- bge-m3 임베딩 + Chroma 인덱스 ✅
- 5청크 RAG 데모 정답률 100% ✅

내일은 실제 공개 데이터 PDF (한국에너지공단 FEMS 구축 가이드, 에너지절약 기술자료 등) 를 붙여서 청크 수를 키우고, **로컬 vs 클라우드 답변 품질을 진짜 도메인 질문으로 비교** 할 예정.

면접까지 6일 — 정해진 페이스로.

## 더 공부해볼 것

### 1. Ollama 운영 모드 — Keep-alive vs Swap

- `OLLAMA_KEEP_ALIVE` 환경 변수로 모델 메모리 상주 시간 제어
- VRAM 6GB 에서 모델을 여러 개 돌릴 때 swap 비용
- 사용 빈도 기반 자동 swap 전략

### 2. bge-m3 vs 다른 한국어 임베딩

- **KoSimCSE / KoSBERT** — 한국어 sentence embedding 의 사실상 표준
- **multilingual-e5-large** — 다국어 모델 중 한국어 성능 양호
- 동일 문서 셋으로 임베딩 벤치마크 (1순위 dist 비교)

### 3. Chroma 의 기본 임베딩 함수가 영어 특화인 이유

- Chroma 기본값이 `all-MiniLM-L6-v2` (sentence-transformers, 영어 중심)
- 직접 임베딩 주입 방식이 표준 — collection 생성 시 `embedding_function=None`
- pgvector 등 다른 벡터 DB 의 임베딩 정책 차이

### 4. 토큰 사용 전략 — RAG 관점에서

- **컨텍스트 윈도우** 와 **청크 수 × 청크 크기** 의 관계
- Prompt Caching 으로 시스템 프롬프트 / 도구 정의 캐싱
- Top-K retrieval 의 K 값이 비용에 미치는 영향

### 5. FEMS 도메인 자체

- 한국에너지공단 FEMS 구축 가이드 (공개 PDF)
- 에너지절약 기술자료 — 산업 부문 (한국에너지공단)
- 피크 관리 / 압축공기 / HVAC / 조명 — 4대 공통 절감 영역
- 측정 항목: 전력 (kW, kWh), 역률, 디맨드, 가스/스팀 등 다양한 에너지 흐름

### 6. 온프레미스 LLM 도입의 trade-off

- 데이터 보안 ↑ vs 모델 품질 ↓
- 초기 GPU 비용 vs API 호출 비용 (BEP 계산)
- 모델 업데이트 주기 — 클라우드는 자동, 온프레미스는 수동 fine-tune / 교체
