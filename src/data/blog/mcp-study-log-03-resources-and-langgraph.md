---
title: "MCP 공부 #3 — Resources / Prompts 의 정체 + LangGraph 와 통합 (`MultiServerMCPClient` · `ainvoke`)"
description: "MCP 의 세 구성요소 중 #1 / #2 에서 다룬 Tools 외에 Resources(LLM 이 읽을 데이터, 백그라운드 컨텍스트, 읽기 전용) 와 Prompts(미리 정의된 템플릿) 까지. Inspector + Claude Desktop 으로 새 서버 확인 → langchain-mcp-adapters 로 MCP 서버를 LangGraph 에 통합. MCP 통신이 비동기라 `ainvoke` 필요한 이유, MultiServerMCPClient 가 서버 그대로 불러오는 비결(=MCP 표준 준수), Resources 를 시스템 프롬프트로 주입했을 때의 도메인 응답 품질 차이까지."
pubDatetime: 2026-06-28T15:00:00Z
tags:
  - mcp
  - langgraph
  - langchain
  - anthropic
  - llm
  - agent
  - 학습
draft: false
featured: false
---

[MCP 공부 #1 (Inspector)](/posts/mcp-study-log-01) / [#2 (Claude Desktop)](/posts/mcp-study-log-02-claude-desktop) 에서는 **Tools** 만 다뤘다. 오늘은 나머지 두 구성요소 — **Resources / Prompts** + **LangGraph 통합** 까지.

## Table of contents

## MCP 의 세 구성요소 — 다시

| 요소 | 정의 |
|---|---|
| **Tools** | LLM 이 호출하는 함수 |
| **Resources** | LLM 이 읽을 수 있는 데이터 / 파일 |
| **Prompts** | 미리 정의된 프롬프트 템플릿 |

이렇게만 봐서는 차이가 잘 안 와닿음. 더 구체적인 비교가 필요.

![Tools / Resources / Prompts 비교표 — 누가 호출(LLM/클라이언트/사용자) / 언제(LLM판단/컨텍스트로 미리/명시적 트리거) / 부작용(있음/없음/없음) / 비유(직원 시키기/참고 자료/양식·템플릿)](/assets/posts/mcp-study-log-03-resources-and-langgraph/01-tools-resources-prompts-comparison.png)

| 측면 | Tools | Resources | Prompts |
|---|---|---|---|
| 누가 호출? | LLM | 클라이언트 / 사용자 | 사용자 |
| 언제? | LLM 판단 | **컨텍스트로 미리** | 명시적 트리거 |
| 부작용? | 있을 수 있음 | 없음 (읽기) | 없음 (텍스트) |
| 비유 | 직원 시키기 | 참고 자료 | 양식 / 템플릿 |

### 핵심 차이 (한 줄)

- **Resources** = **백그라운드로 항상 제공** 되는 컨텍스트 (읽기 전용)
- **Tools** = 필요할 때 **능동적으로 가져오는** 데이터 (호출 비용·부작용 있음)
- **Prompts** = 사용자가 **명시적으로 트리거** 하는 양식 / 템플릿

## 구현 — `@mcp.resource()` / `@mcp.prompt()`

Resources 는 `@mcp.resource("...")` 로 구현. URI 패턴으로 노출:

```python
@mcp.resource("config://operating-rules")
def get_operating_rules() -> str:
    """공장 운영 규정 — 백그라운드 컨텍스트."""
    return "..."  # 텍스트 그대로 반환
```

Prompts 는 `@mcp.prompt()`. **입력 데이터를 어떤 절차대로 처리할지, 출력을 어떤 형식으로 내놓을지** 를 미리 명시 가능. 시스템 프롬프트를 미리 적어둔 것과 비슷한 개념.

```python
@mcp.prompt()
def daily_analysis_prompt(date: str) -> str:
    """일별 에너지 분석 프롬프트 — /daily_analysis 입력 시 사용."""
    return f"{date} 자료를 분석해 다음 형식으로 정리해줘..."
```

## Inspector 로 확인

![MCP Inspector — 'energy-management-v2' 서버 연결 완료, Resources / Prompts 탭이 활성화된 상태](/assets/posts/mcp-study-log-03-resources-and-langgraph/02-inspector-resources-prompts-tabs.png)

Resources / Prompts 탭이 활성화됨. 이전엔 Tools 만 있었는데 새 서버는 셋 다 갖춤.

![Resources 목록 — get_operating_rules / get_line_specifications / get_troubleshooting_guide](/assets/posts/mcp-study-log-03-resources-and-langgraph/03-resources-list.png)

![Prompts 목록 — daily_analysis_prompt (일별 에너지 분석 프롬프트, /daily_analysis 입력 시 사용) / alarm_response_prompt (알람 대응 프롬프트)](/assets/posts/mcp-study-log-03-resources-and-langgraph/04-prompts-list.png)

## Claude Desktop 에서도 확인

[#2 에서 등록한 config](/posts/mcp-study-log-02-claude-desktop) 에 새 서버 추가 후 재시작:

![Claude Desktop — '오후예요, hyoin님' 인사 + 커넥터 메뉴에 energy-v2 활성화, 우측에 Daily analysis prompt / Alarm response prompt / Get operating rules / Get line specifications / Get troubleshooting guide 노출](/assets/posts/mcp-study-log-03-resources-and-langgraph/05-claude-desktop-connector-menu.png)

채팅창 + 버튼 → 커넥터 → **energy-v2** 토글 켜면 우측에 등록된 Resources / Prompts 가 메뉴로 노출. 항목 누르면 **프롬프트가 채팅에 복사** 되거나 **파라미터를 직접 입력** 할 수 있는 폼이 나온다.

## LangGraph 와 통합 — `langchain-mcp-adapters`

이제 만든 MCP 서버를 LangGraph 에서 호출.

```bash
pip install langchain-mcp-adapters
```

LangChain 에서 지원하는 라이브러리인데 — **MCP 서버의 도구를 LangChain 의 `@tool` 형식으로 자동 변환** 해줌. 직접 어댑터 짤 필요 없음.

### 셋업 흐름

```
MCP 클라이언트 셋업
  ↓
LangGraph State + 노드 함수 정의 (asyncio)
  ↓
도구 로드 → ainvoke
```

[이전 LangGraph 시리즈](/posts/langgraph-study-log-01) 패턴 그대로인데 **`asyncio`** 가 추가됨.

### asyncio — 이전 회사 데이터로거 프로젝트가 반갑게 떠오름

`asyncio` 를 보니 이전 회사에서 **강우량계 데이터로거 SW** 짤 때 쓴 기억이 났다. **센서로부터 들어오는 값을 놓치지 않고 받기 위해** 코루틴 + asyncio 로 받았었음. 그때 코루틴 처음 배웠는데 다시 보니 반가운 느낌.

### `ainvoke` 가 왜 필요한가

코드 따라치다 `ainvoke` 라는 메서드를 발견. **`invoke` 의 async 버전.** LangChain 이 비동기 실행을 지원하는 이유가 궁금했는데, 답은 단순:

> **MCP 통신 자체가 비동기.** stdio / SSE 둘 다 비동기 I/O 기반. 그래서 LangGraph 에서도 비동기 메서드인 `ainvoke` 를 써야 한다.

만약 `invoke` (동기) 로 호출하면 비동기 통신을 동기로 감싸는 어색한 패턴이 됨. LangChain 이 둘 다 제공하는 건 **호출자가 자기 컨텍스트에 맞춰 선택** 할 수 있게 하기 위함.

### 실행 결과

![LangGraph + MCP 실행 — MCP 도구 2개 로드 → list_production_lines / get_energy_consumption(line_4, 12h) 자동 호출 → 라인 ID·용량 표 형식 답변](/assets/posts/mcp-study-log-03-resources-and-langgraph/06-langgraph-mcp-tool-call.png)

`list_production_lines()` → `get_energy_consumption(line_4, 12h)` 순서로 자동 호출. 결과를 마크다운 표로 정리해서 응답.

### `MultiServerMCPClient` 가 서버 그대로 불러오는 비결

흥미로운 부분 — **MCP 서버 코드는 한 줄도 안 바뀌었는데** LangChain 에서 `MultiServerMCPClient` 로 그대로 가져옴.

> 가능한 이유 = **MCP 표준을 지키면서 구현했기 때문.** 서버는 stdio / 메시지 포맷 표준만 지키면 어떤 클라이언트든 가져다 쓸 수 있다.

이게 [#1 에서 비교했던 "Tool Use vs MCP" 표](/posts/mcp-study-log-01#왜-mcp-가-필요한가--tool-use-의-한계) 의 **"범용 표준"** 항목이 실제로 어떻게 발현되는지를 직접 본 셈.

## Resources 까지 통합 — 도메인 지식이 시스템 프롬프트로

Tools 만 불러오는 데 그치지 않고 Resources 도 가져와서 **시스템 프롬프트에 적용**.

```python
async with mcp_client.session(...) as session:
    resources = await session.list_resources()
    context = ""
    for r in resources:
        content = await session.read_resource(r.uri)
        context += content.text + "\n"
    return context  # → 시스템 프롬프트에 주입
```

`async with` 로 리소스를 받아와서 context 로 묶고, 나머지는 평소대로 LLM 셋업 → 노드 정의 → 엣지 연결 → `ainvoke`.

![LangGraph + Resources + Tools — 초반에 3개 Resource 로드 (config://operating-rules 419자, config://line-specifications 315자, manual://troubleshooting-guide 385자) → 2개 Tool 로드 → 질문 'line_4 의 최근 24시간 전력 사용량 보고, 운영 규정 위반 여부 확인, 대응 방법' → get_energy_consumption 호출 후 도메인 지식 반영된 보고서 응답](/assets/posts/mcp-study-log-03-resources-and-langgraph/07-langgraph-with-resources-context.png)

초반에 **3개 Resource** (operating-rules 419자 + line-specifications 315자 + troubleshooting-guide 385자) 로드 후 질문에 답.

### Resources 있을 때 vs 없을 때

> **가장 큰 차이는 도메인 지식이 반영된 답변 품질.**

같은 데이터를 받아도 "운영 규정 위반 여부 확인" / "대응 방법 제안" 같이 **도메인 컨텍스트가 필요한 분석** 이 가능. Resources 없으면 단순 데이터 요약에 그침.

## 회고

MCP 의 세 구성요소를 다 만져봤고 LangGraph 와도 묶어봤다. 정리:

1. **Tools / Resources / Prompts 의 분업** — "능동 호출 / 배경 컨텍스트 / 사용자 트리거 양식". 같은 정보라도 어떤 형식으로 노출하는 게 자연스러운지 설계 단계에서 결정해야 함.
2. **MCP 통신은 비동기** — `ainvoke` 가 자연스러운 선택. 동기 코드만 쓰던 사람은 `asyncio` 한 번 짚고 가야.
3. **MCP 표준 준수의 위력** — 서버 코드 변경 없이 Inspector / Claude Desktop / LangGraph 셋 다에서 그대로 동작. 도구를 한 번 만들면 클라이언트 종류에 독립적.
4. **Resources 가 도메인 지식 주입의 자연스러운 그릇** — 시스템 프롬프트에 박아두는 것보다 MCP Resource 로 분리하면 서버 / 클라이언트 / 다른 에이전트 모두 같은 컨텍스트 공유.

## 더 공부해볼 것

### 1. MCP 서버 깊이 — 사이드 프로젝트 트랙

- 단순 데모 말고 실제 사용 시나리오로 (예: 내 [FEMS RAG](/posts/fems-project-log-03) 를 MCP 서버로 노출)
- 인증 / 권한 / rate limit 같은 운영 이슈
- Resource template (`config://users/{user_id}`) 같은 동적 URI

### 2. RAG 응답 / 에이전트 시스템의 Eval

- 오늘까지 만든 시스템들 (FEMS / LangGraph / MCP) 의 응답을 어떻게 측정할 것인가
- [퀀트 글의 "느낌 벤치마킹 → 수치 벤치마킹"](/posts/quant-study-00-pandas#회고--느낌으로-벤치마킹-하는-습관을-발견) 원칙 그대로 적용
- RAGAS / TruLens / DeepEval 같은 프레임워크
- 평가셋 자동 구축 + golden answer 관리

### 3. `langchain-mcp-adapters` 의 내부

- MCP 도구 → LangChain `@tool` 변환의 메커니즘
- input schema / output schema 매핑 규칙
- 에러 / 타임아웃 / 재시도 정책
- 여러 MCP 서버를 한 번에 묶을 때의 도구 충돌 처리

### 4. asyncio + 코루틴 기본기 복습

- `async with` / `async for` / `gather` / `as_completed`
- 동기 코드 안에서 비동기 호출하는 패턴 (`asyncio.run`)
- 이전 회사 데이터로거 (강우량계) 에 쓴 코루틴과 LLM 도구 호출의 공통점·차이

### 5. Resources vs RAG 의 경계

- 작은 도메인 지식 → Resources 로 시스템 프롬프트 주입
- 큰 코퍼스 → RAG 로 검색
- 그 사이 회색지대 — 50KB 정도의 가이드라인은 어느 쪽이 맞나
- 토큰 비용 vs 검색 latency 의 trade-off

### 6. Prompts 의 운영 패턴

- 슬래시 커맨드 (/daily_analysis) 같은 사용자 트리거
- 파라미터 유효성 / 기본값 / 다국어
- Prompts 와 Resources 를 조합한 워크플로우 (Prompt 가 어떤 Resource 를 같이 가져올지 명시)
