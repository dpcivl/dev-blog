---
title: "MCP 공부 #1 — Model Context Protocol 시작 · stdio 서버 + Inspector 로 첫 호출"
description: "오늘부터 MCP (Model Context Protocol) 공부 시작. Anthropic 이 만든 표준 프로토콜로, LLM 이 외부 시스템에 접근하는 방식을 표준화. Tool Use 와의 차이 비교 → Python SDK 로 첫 MCP 서버 (say_hello / add_numbers) 구현 → MCP Inspector 로 stdio 연결 확인 → FEMS 와 연결되는 가짜 에너지 관리 서버까지. venv python.exe 경로 문제로 연결 실패 + 해결."
pubDatetime: 2026-06-26T04:00:00Z
tags:
  - mcp
  - anthropic
  - llm
  - agent
  - tool-use
  - 학습
draft: false
featured: false
---

오늘부터 **MCP 공부** 시작.

**MCP = Model Context Protocol** — 몰랐는데 **Anthropic 이 만든 표준 프로토콜** 이었다 (역시 LLM 계의 GOAT). **LLM 이 외부 시스템(파일, DB, API 등)에 접근하는 방식을 표준화** 한 것.

## Table of contents

## 왜 MCP 가 필요한가 — Tool Use 의 한계

[이전에 다룬 Tool Use](/posts/claude-api-tool-use-and-agent-loop) 만으로도 LLM 이 외부와 상호작용은 가능하다. 다만 **도구가 많아지면 코드가 복잡해지는** 문제가 있다.

MCP 는 이걸 **도구를 별도 서버로 분리** 해서 해결. 그러면:

- **도구 개발** 과 **LLM 앱 개발** 을 분리 가능
- 한 번 만든 도구 서버를 **여러 LLM 앱에서 재사용** 가능
- **표준화** — Anthropic 외 다른 클라이언트도 같은 서버 사용 가능

![Tool Use vs MCP 비교표 — 정의 위치 / 실행 위치 / 재사용 / 표준 / 호환 / 배포 6가지 측면](/assets/posts/mcp-study-log-01/01-tool-use-vs-mcp-table.png)

| 측면 | Tool Use | MCP |
|---|---|---|
| 정의 위치 | LLM 앱 코드 안 | **별도 서버** |
| 실행 위치 | LLM 앱 프로세스 | MCP 서버 프로세스 |
| 재사용 | 어려움 (코드 복붙) | 쉬움 (서버 그대로) |
| 표준 | Anthropic API 종속 | **범용 표준** |
| 호환 | Anthropic만 | 모든 MCP 클라이언트 |
| 배포 | 앱이랑 같이 | **독립 배포** |

### 사용 구분

- **Tool Use** — 본인 앱 안에서만 쓸 단순한 도구
- **MCP** — 여러 곳에서 재사용하거나 표준화가 필요한 도구

## MCP 의 구성 요소 3가지

| 요소 | 정의 |
|---|---|
| **Tools** | LLM 이 **호출** 하는 함수 |
| **Resources** | LLM 이 **읽을 수 있는** 데이터 |
| **Prompts** | 미리 정의된 **프롬프트 템플릿** |

오늘은 **Tools** 중심으로.

## 통신 방식 — stdio vs HTTP/SSE

| 방식 | 설명 | 난이도 |
|---|---|---|
| **stdio** | 표준 입출력 (로컬 프로세스 간 통신) | 구현 간단 |
| **HTTP/SSE** | 네트워크 통한 원격 서버 | 구현 복잡 |

오늘은 **stdio** 로 예제 진행. 로컬 데모용으로 충분.

## MCP SDK 설치

MCP SDK 는 **Python** 과 **TypeScript** 가 있다. 나는 Python 으로 진행.

```bash
pip install mcp
```

## 첫 MCP 서버 — `say_hello` + `add_numbers`

코드: [`first_mcp_server.py`](https://github.com/dpcivl/ai-study/blob/main/week5-mcp/first_mcp_server.py)

MCP 가 **Tool Use 대신** 으로 쓰이는 게 바로 체감되는 부분 — 어노테이션 **`@mcp.tool()`** 을 사용.

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("first-mcp-server")

@mcp.tool()
def add_numbers(a: int, b: int) -> int:
    """두 숫자를 더합니다.

    Args:
        a: 첫 번째 숫자
        b: 두 번째 숫자

    Returns:
        두 숫자의 합
    """
    return a + b
```

### 두 가지 핵심

1. **docstring 의 Args / Returns 형식** — LLM 에게 함수를 설명하는 부분. 형식이 중요
2. **파라미터 타입 힌트** (`a: int`) — 자동으로 **input schema** 생성

타입 힌트 하나 적었을 뿐인데 MCP 가 알아서 JSON schema 를 만들어 LLM 에 노출. 깔끔.

### 서버 실행 — 출력 없음

서버를 실행하면 **아무 출력 없이 가만히 있음.**

```bash
python first_mcp_server.py
```

**stdio 방식이기 때문에 MCP 클라이언트가 호출하지 않으면 대기 상태.** 화면에 아무것도 안 떠도 정상.

## MCP Inspector 로 테스트

서버가 떴는지, Tools 가 잘 노출되는지 확인하려면 **MCP Inspector** 가 표준 도구:

```bash
npx @modelcontextprotocol/inspector python first_mcp_server.py
```

![MCP Inspector 초기 화면 — Transport Type STDIO, Command python, Arguments .\first_mcp_server.py, 아직 Disconnected 상태](/assets/posts/mcp-study-log-01/02-mcp-inspector-disconnected.png)

Inspector 에서 확인 가능한 것:

- 서버 연결 정보
- 노출된 Tools / Resources / Prompts 목록
- 실제 호출 + 결과

### 트러블슈팅 — Connect 안 됨

처음에 Connect 버튼 눌러도 연결이 안 되는 현상.

**원인:** Command 에 있는 `python.exe` 의 경로가 잘못됨. 시스템 PATH 의 python 이 아니라 **venv 의 python** 을 짚어야 함.

→ venv 경로의 python.exe 위치를 명시한 후 성공적으로 연결 확인.

### 연결 성공 — Tools 노출 확인

![연결 후 Inspector — Tools 탭에 say_hello / add_numbers 두 도구 노출. add_numbers 에 a=5, b=3 입력 폼](/assets/posts/mcp-study-log-01/03-mcp-inspector-connected-with-tools.png)

좌측에 **`say_hello`** 와 **`add_numbers`** 두 도구가 노출됨. docstring 의 Args/Returns 가 그대로 우측 패널에 정리됨.

- `add_numbers(a=5, b=3)` → 결과 **`8`** ✅

### `say_hello` 호출 결과

![say_hello 결과 — Tool Result Success, structured content { result: "안녕하세요, 효인님! MCP 서버에서 인사드려요." }](/assets/posts/mcp-study-log-01/04-say-hello-result.png)

이름을 입력하면 인사 문자열을 돌려줌. **Valid according to output schema** 라고 표기되는 부분 — MCP 가 output schema 까지 검증한다는 게 보임.

## 두번째 예제 — 에너지 관리 MCP 서버

가짜 데이터로 **에너지 관리** MCP 서버 구현. [FEMS 프로젝트](/posts/fems-project-log-02) 와 자연스럽게 이어지는 시나리오.

![에너지 관리 서버 — list_production_lines / get_energy_consumption / list_alarms / get_line_status 네 도구](/assets/posts/mcp-study-log-01/05-energy-management-tools.png)

4 개 도구:

| 도구 | 용도 |
|---|---|
| `list_production_lines` | 공장의 모든 생산 라인 목록 |
| `get_energy_consumption` | 특정 라인의 최근 전력 사용량 |
| `list_alarms` | 알람 목록 (severity 필터) |
| `get_line_status` | 라인 현재 운영 상태 |

### 호출 결과

![get_energy_consumption(line_1) 결과 — 정격 150kW, 평균 128.0kW, 시간별 상세 표시](/assets/posts/mcp-study-log-01/06-energy-consumption-result.png)

결과가 잘 나옴. **지금은 가짜 데이터지만**, 실제 DB 연결하면:

- 전력 효율 확인 / 개선 포인트 도출
- 알람 발생 부분 파악 + 원인 분석
- 라인별 운영 상태 모니터링

이게 자연스럽게 LLM 위에 얹히면 **"공장 운영 어시스턴트"** 가 된다.

## 회고 — MCP 는 "분리된 Tool"

오늘 학습 정리:

> **MCP = Tool Use 의 도구를 별도 서버로 분리한 것** + 표준 프로토콜로 묶은 것.

체감 흐름:

1. 서버에서 `@mcp.tool()` 데코레이터로 도구 정의
2. MCPInspector 로 연결해서 노출된 도구 확인 + 직접 호출
3. (다음 단계) **LLM 이 도구 사용이 필요한 노드를 만났을 때 MCP 서버를 호출** → 결과를 LLM 컨텍스트로 가져옴

내일은 **Claude Desktop 에 내가 만든 MCP 서버를 실제로 연결** 하는 작업을 해볼 예정.

## 더 공부해볼 것

### 1. Claude Desktop 연동

- `claude_desktop_config.json` 설정 형식
- 로컬 서버 등록 + Claude 가 자동으로 도구 인식하는 흐름
- 호출 로그 / 디버깅 패턴

### 2. HTTP/SSE 통신

- 원격 MCP 서버 운영 — auth / TLS / rate limit
- stdio 와의 trade-off (latency / 운영 비용 / 보안)
- 서버 한 대로 여러 LLM 클라이언트 동시 서비스

### 3. Resources / Prompts

- **Resources** — 파일 시스템 / DB 레코드를 URI 로 노출하는 패턴
- **Prompts** — 재사용 가능한 프롬프트 템플릿 (변수 치환 + 컨텍스트 주입)
- Tools 만 쓰는 경우 vs 셋 다 쓰는 경우의 설계 차이

### 4. MCP 서버 보안

- [Human-in-the-Loop](/posts/langgraph-study-log-03-human-in-the-loop) 에서 다룬 위험 도구 승인 패턴과 결합
- MCP 서버 단에서의 권한 / scope 정의
- `delete_user` 같은 위험 도구를 MCP 가 노출할 때의 게이팅 정책

### 5. 공개 MCP 서버 카탈로그

- Anthropic 공식 + 커뮤니티 MCP 서버 목록
- GitHub / Slack / 파일시스템 / Notion / Linear 등 통합 서버
- 직접 만들기 vs 공개 서버 가져다 쓰기 trade-off

### 6. MCP 와 LangGraph / Agent 프레임워크 통합

- LangGraph 의 ToolNode 에 MCP 클라이언트 연결
- 여러 MCP 서버를 한 에이전트에서 동시에 사용
- 도구 호출 라우팅 (어떤 서버에 어떤 도구가 있는지)
