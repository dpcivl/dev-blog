---
title: "Eval 공부 #1 — '느낌 벤치마킹' 을 끝낼 때 · 정확도 기반 + LLM-as-Judge 첫 구현"
description: "여태 프로젝트마다 '빠른 거 같다', '정확한 것 같다' 식 느낌 평가만 해왔는데, 이제 진짜로 수치화하는 Eval 공부 시작. Eval 의 4가지 종류(정확도 / 유사도 / LLM-as-Judge / 사람 평가) 정리 + 도구 선택 정확도 10/10 측정 + LLM-as-Judge 로 같은 질문에 대한 두 답변을 8/10 vs 3/10 으로 채점. LLM-as-Judge 의 한계(평가자 변동성, 같은 모델 답변 후한 점수)까지."
pubDatetime: 2026-06-29T08:30:00Z
tags:
  - LLM공부
  - eval
  - llm
  - agent
  - rag
  - llm-as-judge
  - 학습
draft: false
featured: false
---

오늘부터 **Eval (Evaluation)** 공부 시작.

여태 프로젝트하면서 **"빠른 거 같다"**, **"더 정확한 답변을 내놓는 것 같다"** 같은 느낌 표현으로 지표를 측정하는 일이 많았다. 본인용 도구라면 그래도 되는데, **누군가에게 보여주고 판매하는 용도로 서비스를 만든다면 수치화 가능해야 한다.**

이미 [퀀트 글 회고](/posts/quant-study-00-pandas#회고--느낌으로-벤치마킹-하는-습관을-발견) 에서 "느낌 벤치마킹 → 수치 벤치마킹" 으로 가야 한다고 적었는데, 그 후속 학습이 오늘부터.

## Table of contents

## 왜 Eval 이 필요한가 — 느낌만으로는 결정 못 한다

**느낌만으로 평가하면:**

- **재현 불가능** — 다음에 똑같이 못 만든다
- **개선폭 측정 불가능** — 얼마나 좋아졌는지 모른다
- **트레이드오프 놓침** — 코드 수정으로 A 가 좋아지고 B 가 나빠진 케이스, 측정 안 하면 B 의 악화를 놓친다
- **의사결정 근거 빈약** — 수치 없이 "감으로" 결정하면 최선의 결정이 안 된다

> Eval = **LLM / 에이전트 시스템의 품질을 정량적으로 측정** 하는 것. 느낌이 아니라 숫자로.

## Eval 의 4가지 종류

| 종류 | 설명 | 예 |
|---|---|---|
| **1. 정확도 기반** | 정답이 명확한 경우 | Accuracy, Precision/Recall, F1 |
| **2. 유사도 기반** | 텍스트 비교 | 코사인 유사도, BLEU, ROUGE |
| **3. LLM-as-Judge** | 정답 모호한 주관적 평가 | 다른 LLM 이 평가자 |
| **4. 사람 평가** | 최종 검증 | 보통 샘플 검증 |

오늘은 **정확도 기반 + LLM-as-Judge** 두 가지를 직접 구현한다.

- **RAG 검색 / 에이전트 도구 선택** → 정확도 기반
- **RAG 답변 / 에이전트 답변** → LLM-as-Judge

## 1. 정확도 기반 — 도구 선택 정확도

가장 단순한 케이스 — **에이전트가 어떤 도구를 골랐는가** 의 정확도.

### 테스트 케이스

![test_cases 리스트 — 10개 질문 각각에 expected_tool (calculator / get_weather / search_web) 매핑](/assets/posts/eval-study-log-01-accuracy-and-llm-as-judge/01-test-cases-tool-selection.png)

```python
test_cases = [
    {"question": "847 곱하기 2391은?",   "expected_tool": "calculator"},
    {"question": "부산 날씨 어때?",        "expected_tool": "get_weather"},
    {"question": "오늘 주요 뉴스 알려줘",   "expected_tool": "search_web"},
    # ... 총 10개
]
```

> 임베디드 개발하던 시절 TDD 를 도입해보려고 연습했던 적이 있는데, **AI 의 품질을 검증하기 위한 테스트 케이스 작성도 같은 결의 작업** 이라는 느낌이 든다. 입력 → 기대 출력 페어를 미리 정의해두면 회귀 테스트 같이 굴릴 수 있다.

### 실행 결과

![도구 선택 정확도 결과 — 10/10 = 100.0%, 모든 케이스 정확, 결과 저장 eval_results.json](/assets/posts/eval-study-log-01-accuracy-and-llm-as-judge/02-accuracy-result-100.png)

이번 케이스는 **10/10 = 100%** 였지만 — 만약 틀린 케이스가 나왔다면:

- **틀린 케이스 자체** 를 보여주고
- 어떤 잘못된 도구를 골랐는지 표시
- → 그 후 **도구의 description 을 더 명확하게** 다듬어 개선

**개선폭이 숫자로 보인다.** 65% → 80% → 95% 같은 식. **이게 Eval 의 존재 이유다.** 결과는 json 으로도 저장해서 나중에 비교할 수 있다.

## 2. LLM-as-Judge — 주관적 평가의 수치화

답변 품질처럼 **"잘했다 / 못했다"** 가 검증을 위한 수치가 아닌 경우. 이걸 수치화하려면 LLM 에게 평가자 역할을 맡긴다.

### 평가할 질문 - 답변 쌍

![qa_pairs — RAG 가 뭐야? (좋은 답변 / 부실한 답변 2개), 파이썬 list/tuple 차이? (정확한 답변 / 불완전한 답변 2개)](/assets/posts/eval-study-log-01-accuracy-and-llm-as-judge/03-qa-pairs-for-judge.png)

지금은 가짜 질문+답변 쌍이지만, 실전에서는 **실제 시스템이 생성한 답변** 을 그대로 평가에 넣게 된다.

### Judge 프롬프트

![judge_answer 함수 — judge_prompt 에 정확성/완결성/명확성/종합 1~10점 + 평가 이유 한 문장, JSON 으로만 응답하도록 강제](/assets/posts/eval-study-log-01-accuracy-and-llm-as-judge/04-judge-prompt-code.png)

핵심: **평가 기준을 명시적으로** + **JSON 형식 강제**.

```python
judge_prompt = """당신은 답변 품질을 평가하는 전문가입니다.

질문: {question}
답변: {answer}

다음 기준으로 1~10점 평가:
- accuracy: 정확성 1-10
- completeness: 완결성 1-10
- clarity: 명확성 1-10
- overall: 종합 1-10
- reason: 평가 이유 한 문장

JSON만 출력하세요."""
```

### 결과

![Judge 결과 — 1번 RAG 답변 (정확/구체적): 정확성 9, 완결성 8, 명확성 9, 종합 8/10 + 이유. 2번 RAG 답변 (단순/부실): 정확성 5, 완결성 2, 명확성 4, 종합 3/10 + 이유](/assets/posts/eval-study-log-01-accuracy-and-llm-as-judge/05-judge-results-same-question.png)

**같은 질문 ("RAG 가 뭐야?") 에 대한 두 답변**:

| 답변 | 정확성 | 완결성 | 명확성 | 종합 |
|---|---|---|---|---|
| "Retrieval-Augmented Generation 의 약자로, 검색으로 관련 문서..." | 9 | 8 | 9 | **8/10** |
| "RAG는 좋은 기술입니다. 많이 쓰입니다." | 5 | 2 | 4 | **3/10** |

사람이 보면 "전자가 더 낫다" 정도의 인상인데, **LLM 이 여러 시점에서 평가해서 점수 차이를 명시적으로** 만들어준다. 8 vs 3 → 5점 차이. 이 격차가 곧 개선 가능 폭이다.

## LLM-as-Judge 의 한계 — 그래서 사람 샘플 검증이 필요

LLM-as-Judge 도 완벽하지 않다. 직접 만져보면서 인지한 한계:

1. **평가자 자체도 LLM** — 100% 신뢰 불가
2. **같은 답변을 두 번 평가했을 때 점수가 다를 수 있다** — 결정론적이지 않다
3. **같은 모델이 만든 답변을 후하게 평가** 하는 경향 (self-preference bias)

→ **그래서 사람 샘플 검증이 마지막 안전장치가 된다.** LLM 끼리만 평가하면 폐쇄 루프에 빠진다. 일부 케이스는 사람이 직접 보고 LLM 평가의 신뢰도 자체를 검증해야 한다.

## 회고

오늘 학습으로 얻은 것:

1. **느낌 벤치마킹의 함정을 4가지로 정리** — 재현 불가 / 개선폭 측정 불가 / 트레이드오프 누락 / 의사결정 근거 빈약
2. **정확도 기반 Eval 의 효용** — "description 다듬기로 65 → 80 → 95% 까지" 같은 개선 사이클이 숫자로 보인다
3. **LLM-as-Judge 는 주관적 평가의 수치화 도구** — 다만 평가자 변동성 / 자기 모델 편향이 있어 사람 샘플 검증을 뺄 수 없다

본인이 만든 시스템의 능력을 **객관적으로 설명** 하려면 결국 수치 근거가 필요하다. 그게 없으면 "이 시스템 좋아요" 라고 말해도 듣는 사람 입장에선 검증할 방법이 없다. **Eval 의 존재 이유가 결국 그 객관적 설명 가능성** 이라고 정리된다.

## 더 공부해볼 것

### 1. 유사도 기반 Eval

- **코사인 유사도** — 임베딩 공간에서 의미 거리
- **BLEU / ROUGE** — n-gram 기반 텍스트 생성 평가 (기계 번역 출신)
- **BERTScore** — 임베딩 기반 토큰 매칭
- 각 메트릭이 잡는 것 / 못 잡는 것

### 2. LLM-as-Judge 편향 완화 패턴

- **순서 편향** (A/B 평가 시 먼저 본 쪽을 더 좋게) → 순서 swap 평균
- **자기 모델 후한 점수** → judge 모델은 평가 대상과 다른 모델로 (예: gpt-4o 답변을 claude 로 평가)
- **다회 평가 후 평균/중앙값** → 변동성 흡수
- **참고 답변(reference) 제공 vs 미제공** 의 영향

### 3. RAG 검색 정확도 메트릭

- **Hit Rate @ K** — top-K 안에 정답 청크 포함 비율
- **MRR (Mean Reciprocal Rank)** — 정답이 몇 등에 있나의 역수 평균
- **NDCG** — 순위 가중치 반영
- 검색 품질과 답변 품질의 분리 측정 ([RAGAS 의 Faithfulness vs Context Precision](https://docs.ragas.io/))

### 4. 평가셋 (Eval Set) 자체의 품질

- 평가셋이 편향되면 평가 결과도 편향 — golden answer 의 보정
- **자동 생성 평가셋** (LLM 으로 질문 자동 생성) → 사람 검수 비율
- 평가셋의 도메인 / 난이도 분포
- [RAG 데이터 준비 글](/posts/rag-data-preparation-end-to-end#평가셋-구축) 의 평가셋 항목과 직결

### 5. CI 에 Eval 끼우기

- 코드 수정 → 자동으로 Eval 돌려 점수 비교 → 회귀 감지
- 점수 임계값 미달 시 PR 차단
- A/B 점수 시각화 (전 버전 대비)
- 임베디드에서 TDD 했던 것과 똑같은 흐름 — 다만 binary pass/fail 이 아니라 점수 회귀

### 6. 사람 평가의 효율화

- 전수 검사가 비효율적이라 **신뢰도 낮은 케이스 우선** + **무작위 샘플링** 조합
- Inter-annotator agreement (사람 평가자 간 일치도) 확보
- 평가 가이드라인 / rubric 설계
- [FEMS #2 의 readable_ratio 자동 탐지 + 의심 페이지만 수동 검수](/posts/fems-project-log-02#품질-게이트--readable_ratio-의-정의와-한계) 패턴과 동일한 결
