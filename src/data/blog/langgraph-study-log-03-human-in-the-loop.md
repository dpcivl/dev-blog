---
title: "LangGraph 공부 #3 — Human-in-the-Loop (위험 도구 승인) · 체크포인트와 Interrupt 메커니즘"
description: "에이전트가 파일 삭제·이메일 발송·결제 같은 위험 도구를 자동으로 호출하면 사고난다. LangGraph 의 체크포인트 + Interrupt 메커니즘으로 위험 도구 직전에 사람의 승인을 받는 HITL 패턴 구현. 의외의 함정: LLM 자체 안전장치가 HITL 까지 도달을 막아버리는 케이스. 시스템 프롬프트와 HITL 게이트를 어떻게 분리해야 하는지."
pubDatetime: 2026-06-25T06:00:00Z
tags:
  - langgraph
  - agent
  - hitl
  - ai-safety
  - 학습
draft: false
featured: false
---

[LangGraph 공부 #1 (State 게임 캐릭터 비유)](/posts/langgraph-study-log-01) / [#2 (AI 가 기억한다 의 정체)](/posts/langgraph-study-log-02) 에 이어 #3. 오늘 주제는 **Human-in-the-Loop (HITL)**.

## Table of contents

## HITL 이 뭔가 — 위험한 도구를 자동 실행하면 안 된다

> **Human-in-the-Loop (HITL)** = 에이전트가 **중요한 결정 전에 사람에게 확인을 받는** 패턴.

실전에서 에이전트를 다루다 보면 **위험한 도구** 도 같이 다뤄야 한다. 예:

- **파일 삭제**
- **이메일 발송**
- **결제**
- **DB 레코드 영구 삭제**

이런 도구를 LLM 이 알아서 호출하면 사고가 난다. "알아서 잘 해주겠지" 가 통하지 않는 영역.

### 일반 에이전트 vs HITL 에이전트

![일반 에이전트는 자동 실행 / HITL 에이전트는 위험 호출 시 중단 → 사람에게 보여줌 → 승인/거절 흐름](/assets/posts/langgraph-study-log-03-human-in-the-loop/01-hitl-pattern-diagram.png)

| 일반 에이전트 | HITL 에이전트 |
|---|---|
| LLM → 도구 호출 → **자동 실행** | LLM → 도구 호출 (위험?) → **중단 → 사람 확인 → 승인 시만 실행** |

핵심 차이: **"중단"** 이라는 한 박자.

## LangGraph 의 체크포인트 + Interrupt

LangGraph 는 이 두 가지 메커니즘을 제공한다:

- **체크포인트** — State 를 저장. Interrupt 후 **재개 가능** 하게 준비
- **Interrupt** — 그래프 실행 중간에 **멈춤**. 사람 응답 받고 다시 시작

이 둘이 짝을 이룬다. Interrupt 가 멈춤이라면 체크포인트는 **멈춰진 상태의 기억**.

### 체크포인트 데모

코드: [`checkpoint_demo.py`](https://github.com/dpcivl/ai-study/blob/main/checkpoint_demo.py)

![checkpoint_demo 실행 결과 — step2 에서 interrupt, state 에 step1 결과만 저장, 재개 후 step2 / step3 진행](/assets/posts/langgraph-study-log-03-human-in-the-loop/02-checkpoint-demo-output.png)

코드를 작성해보면서 알게 된 것 — **`invoke` 를 한 번만 하는 게 아니다.** 흐름:

1. 첫 `invoke` 로 그래프 실행 → step2 에 interrupt 발생 → step1 결과만 State 에 저장된 채 중단
2. **`configurable`** 이라는 대화 식별자를 사용해 두 번째 `invoke`
3. 두 번째 `invoke` 인자에 **시작 노드를 None 으로** 지정 → 중단 지점부터 재개

```python
config = {"configurable": {"thread_id": "demo-1"}}
```

- **`thread_id` 가 같으면** 이전 대화를 계속 함 (체크포인트 이어 받기)
- **`thread_id` 가 다르면** 새 대화를 시작

### 체크포인트 저장소

이번 예제에서는 **`MemorySaver`** 로 구현. 메모리에 들고 있다가 프로세스 죽으면 사라짐. **실전에서는 `SqliteSaver` / `PostgreSaver`** 를 사용한다고 함 — 프로세스 재시작에도 살아남아야 하니까.

## HITL 에이전트 구현 — 위험 도구 리스트로 게이팅

코드: [`hitl_agent.py`](https://github.com/dpcivl/ai-study/blob/main/hitl_agent.py)

구조:

1. 노드로 사용할 **도구 함수들** 정의 (`search_users`, `get_user_info`, `update_user_score`, `delete_user` 등)
2. **위험한 도구 리스트** 를 따로 정의 (예: `["update_user_score", "delete_user"]`)
3. 툴 호출 시 이름이 위험 리스트에 있으면 → **사용자 input 받음**
4. input 값(y/n)에 따라 **함수 실행 / 거절** 결정
5. 처리 후 다시 `invoke` 호출 (체크포인트 이어 받기)

## 함정 — LLM 자체 안전장치가 HITL 을 가로막는다

예제 진행 중 이상한 현상:

> **삭제 요청이 마지막 질문이었는데, input 을 받지 않고 그대로 종료됨.**

![시나리오 3 (삭제 요청) — LLM 이 자체적으로 '정말 삭제하시겠습니까?' 물으면서 종료](/assets/posts/langgraph-study-log-03-human-in-the-loop/03-hitl-blocked-by-llm.png)

가설: **삭제 요청 자체가 위험 도구 사용이라 LLM 이 자체적으로 넘어간 게 아닐까.** LLM 이 "이거 위험한데요" 하면서 자체적으로 거절/재확인 요청을 띄우는 바람에 **HITL 단까지 도달조차 안 함.**

질문을 더 강하게 바꿔봤다:

```
"삭제해줘"
  ↓
"삭제해줘. 확인했으니 진행해."
```

→ **결과 동일.** 여전히 LLM 이 자체적으로 막음.

### 원인 — 시스템 프롬프트의 자체 규칙

![시스템 프롬프트 안에 '위험 도구는 반드시 명확한 의도 확인 후 호출' 규칙이 있었음](/assets/posts/langgraph-study-log-03-human-in-the-loop/04-system-prompt-with-rule.png)

시스템 프롬프트를 다시 보니 이 규칙이 박혀 있었다:

> **"위험 도구는 반드시 명확한 의도 확인 후 호출"**

이 한 줄 때문에 LLM 이 도구 호출 전에 자체적으로 사용자에게 다시 묻고, 그 응답을 못 받았다는 이유로 호출 자체를 안 함. **HITL 안전장치가 작동할 기회 자체가 없었던 것.**

이 규칙을 시스템 프롬프트에서 지우고 다시 실행:

![규칙 제거 후 — HITL 안전장치가 정상 동작, '승인하시겠습니까? (y/n)' 프롬프트 + 거절 시 종료](/assets/posts/langgraph-study-log-03-human-in-the-loop/05-hitl-working-after-prompt-fix.png)

**정상 동작.** "위험한 작업이 요청되었습니다 → 승인하시겠습니까? (y/n)" → 거절 시 "거절됨. 에이전트 종료."

## 교훈 — 보호장치는 한 곳에서만 또렷하게

이중으로 안전장치를 두는 건 좋지만, **LLM 단에서 먼저 보호장치를 해두면 HITL 단까지 도달하지 못한다.** 한 곳에서 자체적으로 막혀버리면 다음 안전장치가 작동할 기회조차 없음.

> **실제 사용 단계에서는 HITL 단에서 명시적 안전장치** 를 해두는 게 좋다. 시스템 프롬프트의 "알아서 확인하세요" 같은 모호한 규칙은 HITL 의 결정론적 게이팅과 충돌함.

## 추가 실습 — 진짜 파일 시스템에 적용

코드: [`file_editor_agent.py`](https://github.com/dpcivl/ai-study/blob/main/file_editor_agent.py)

테스트 폴더를 만들어 **실제로 파일 생성 / 수정 / 삭제** 를 시켜봄.

- **생성 / 수정**: 위험도 낮음 → LLM 이 자체 처리 없이 그냥 실행 ✅
- **삭제**: 다시 LLM 이 자체적으로 "정말 삭제하는 게 맞아?" 물어보는 과정 → **HITL 호출 못 하고 그래프 종료** ❌

→ 시스템 프롬프트 변경 후 정상 동작 (위와 동일한 패턴).

## 회고

오늘 학습으로 얻은 것:

1. **HITL = 체크포인트 + Interrupt 의 짝궁** — 멈출 줄 알아야 하고, 멈춘 상태를 기억할 줄도 알아야 한다
2. **LLM 의 친절함이 결정론적 게이팅을 가로막을 수 있다** — 시스템 프롬프트의 모호한 안전 지시는 HITL 과 충돌
3. **운영 환경에서는 MemorySaver 대신 SqliteSaver / PostgreSaver** — 프로세스 재시작 견디기

현재 [FEMS 프로젝트](/posts/fems-project-log-01) 를 진행 중인데, 거기서도 위험 도구 (예: 측정 데이터 영구 삭제, 설정 변경) 가 나올 수 있어 이번에 배운 패턴을 적용해볼 만하다.

다음 학습은 **MCP 서버** 쪽으로.

## 더 공부해볼 것

### 1. 체크포인트 저장소 비교

- **MemorySaver**: 메모리, 프로세스 죽으면 사라짐 — 학습/데모용
- **SqliteSaver**: 파일 기반, 단일 프로세스 운영용
- **PostgreSaver**: DB 기반, 분산 환경 가능
- 각각의 thread 격리 / 동시성 / 재개 성능 특성

### 2. Interrupt 의 다양한 사용처

- **위험 도구 승인** (이 글의 예제)
- **사람의 추가 정보 요청** — "더 상세히 알려주세요" 식 user input
- **다중 단계 워크플로우** — 사람이 중간 결과를 검토 후 다음 단계로

### 3. LLM 의 자체 안전 메커니즘과 HITL 의 분리 설계

- 시스템 프롬프트에서 "위험" 같은 모호한 지시 → LLM 이 자체적으로 거절/재확인
- 결정론적 안전 (HITL) 과 확률론적 안전 (LLM 지시) 의 경계 설정
- "어떤 도구는 HITL 만으로 / 어떤 도구는 둘 다" 같은 정책 매트릭스

### 4. 위험 도구 분류 기준

- **취소 불가능성** (삭제 / 결제 / 발송)
- **외부 영향 범위** (시스템 외부에 노출됨)
- **영향 받는 사용자 수** (개인 vs 전체)
- 이 기준으로 위험도 등급 (low / medium / high) 매기고 게이트 정책 다르게

### 5. HITL 사용자 경험 (UX)

- CLI 의 `(y/n)` 은 데모용 — 실서비스는 웹/슬랙/이메일 등으로 비동기 승인
- **승인 대기 중에 다른 작업은 진행** 가능한가 (병렬 그래프)
- **타임아웃** — 사람이 몇 시간 후에 응답해도 재개 가능해야 하는가
- 알림 / 컨텍스트 전달 (왜 멈췄는지, 무엇을 승인하는지)
