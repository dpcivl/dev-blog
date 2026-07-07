---
title: "LangGraph 공부 일지 #1 — 첫 그래프 + State 가 헷갈렸던 이유"
description: "공부 후보로 적어뒀던 LangGraph 시작. StateGraph 로 노드·엣지·조건 분기·루프 짜는 건 생각보다 직관적이었는데, 'State' 라는 용어가 와닿지 않아 헤맸다. 결국 게임 캐릭터의 인벤토리·HP 로 비유해서 정착."
pubDatetime: 2026-06-21T06:20:00Z
tags:
  - LLM공부
  - LangGraph
  - LLM
  - 에이전트
  - 학습
  - 일지
draft: false
featured: true
---

[공부 방법 글](./my-5-step-study-method-for-new-tech) 끝에 다음 학습 후보로 **LangChain · Hermes agent · 로컬 LLM** 을 적어뒀다. 그중 LangChain 부터 보려고 했는데, 검색하다 보니 **LangGraph** 가 같이 자주 나왔다. 알아보니 같은 회사 (LangChain Inc) 에서 만든 프레임워크다.

대부분 회사가 둘 다 쓴다고 한다:

- **LangChain** — 검색기 / 도구 / 메모리 같은 부품 준비
- **LangGraph** — 그 부품을 묶어 에이전트 흐름을 설계

오늘은 **첫 LangGraph 일지.**

## Table of contents

## 일단 설치하고 첫 import

"에이전트의 신경계를 짜는 도구" 라고 하는데 일단 뭔 소린지 모르겠다. 대충 **노드·엣지로 만든 그래프를 컴파일하면 설계대로 에이전트가 실행** 한다 — 이 정도로 이해하고 시작.

![LangGraph 첫 import — StateGraph, add_conditional_edges 등 다양한 모듈](/assets/posts/langgraph-study-log-01/01-langgraph-imports.png)

구현하려고 보니 **import 가 많다.** 배울 게 많을 거 같다. 한편으로 **"이런 그래프가 어떻게 동작하지?"** 궁금증도 생겼다. 차차 배우게 되겠지.

## 첫 그래프 — 노드 + 엣지 + 분기 + 루프

처음 만져보는 거라 모르는 용어들이 많이 나왔다.

![LangGraph 그래프 다이어그램 — Tool 사용 분기와 call_llm 노드](/assets/posts/langgraph-study-log-01/02-graph-diagram.png)

위 다이어그램대로 구현. 내가 이해한 정리:

- **`StateGraph`** 를 만들어서 시작
- **함수 노드** 를 붙임 (`add_node`)
- 노드 사이를 **엣지** 로 연결 (`add_edge`)
- **분기** 는 `add_conditional_edges`
- **루프** 가 필요하면 뒤쪽 노드에서 앞 노드로 엣지를 연결

**도구 만드는 건 [Tool Use 글](./claude-api-tool-use-and-agent-loop) 때 봤던 거랑 비슷** 했다.

### 실행 결과

![LangGraph 실행 결과 — 계산·날씨 질문은 Tool 거치고, 일반 질문은 call_llm 으로 바로](/assets/posts/langgraph-study-log-01/03-execution-result.png)

대충 이랬다:

- **계산·날씨 질문** → 등록한 Tool 을 사용해서 값 알아낸 후 답변
- **그 외 질문** → 바로 `call_llm` 노드로 넘겨서 답변

## State 가 헷갈렸던 이유 — 게임 캐릭터로 비유

한 가지 좀 아리송한 게 **State** 였다. "에이전트가 진행하면서 계속 들고 다니는 데이터" 라고 설명을 봤는데 와닿지 않아서 예제를 추가로 진행했다.

결론은 **어렵게 생각할 필요 없고 정말 "상태" 그 자체** 였다. **그래프 상에서 에이전트가 어떤 과정을 거치고 있는지를 나타내는 게 State.**

그리고 같이 헷갈렸던 **에이전트** 용어 — 단순히 널리 받아들여지는 정의는:

> **"스스로 판단하고 행동하는 LLM 기반 시스템"**

이걸 묶어서 내가 이해한 비유:

> **`run` 을 했을 때 캐릭터가 생성된다. 그 캐릭터는 미리 그려진 그래프를 따라 할 일을 수행한다. 이때 지금 캐릭터의 상태 (인벤토리, HP) 를 나타내는 게 State.**

LangGraph 로 옮기면 — **에이전트가 어떤 메시지를 들고 있는지, 어떤 값을 들고 있는지** 가 State.

이 비유로 정착하고 나니 코드 읽을 때 훨씬 잘 들어왔다.

## 다음 할 것

- LangGraph 내부 동작 더 파보기 (`compile` 이 실제로 뭘 하는가)
- **LangChain 의 도구·메모리** 와 LangGraph 의 흐름 결합
- State 를 더 복잡하게 (TypedDict, Reducer 등) 정의해보는 예제

## 더 공부해볼 것

### 1. LangGraph 의 컴파일 — `compile()` 이 실제로 뭘 하는가

- 그래프를 어떤 형태로 변환하나 (실행 가능한 함수? state machine?)
- 노드 / 엣지 정의를 어떻게 런타임 실행 흐름으로 만드는가
- 디버깅·시각화는 어떻게 (LangSmith 통합?)

### 2. LangChain vs LangGraph — 정확한 역할 분담

- 같은 회사 두 프레임워크가 왜 따로 존재하는가
- LangChain 의 `Chain` (LCEL) vs LangGraph 의 그래프 — 언제 어떤 걸 쓰는가
- 실무 사례에서 둘을 같이 쓰는 패턴 (검색기/도구/메모리 + 흐름)

### 3. State 의 고급 패턴 — Reducer / Channels

- 단순 `dict` 가 아니라 **TypedDict** 로 타입 정의
- **Reducer** 로 노드 간 상태 누적 (예: 메시지 리스트에 append)
- **Channel** 로 노드 간 데이터 흐름 제어
- 여러 노드가 동시에 State 를 수정할 때의 충돌 처리

### 4. 에이전트의 일반적 정의 + 분류

- "스스로 판단하고 행동" — 어디까지가 에이전트인가
- **ReAct** (Reason + Act), **Plan-and-Execute**, **Reflexion** 등 패턴
- 단순 Tool Use 와 에이전트의 경계

### 5. LangGraph 의 멀티 에이전트 / Human-in-the-loop

- 여러 에이전트가 협업하는 그래프
- 중간에 사람이 개입할 수 있는 노드 (승인 / 수정)
- 실제 production 시나리오 (고객 응대 / 코드 리뷰 / 문서 작성 자동화 등)
