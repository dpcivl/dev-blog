---
title: "MCP 공부 #2 — Claude Desktop 에 내가 만든 MCP 서버 붙이기 · 도구 호출 + 승인 UX"
description: "어제 만든 energy-management MCP 서버를 Claude Desktop 에 실제로 연결. claude_desktop_config.json 찾는 법(설정 → 개발자 → 구성 편집) → 서버 등록 → 재시작 → 커넥터 메뉴에서 확인 → '공장 라인 목록 보여줘' 질문에 Claude 가 도구 호출 + '항상 허용/거부' 승인 UX 까지. 의문 — RAG 와 MCP 를 같이 쓰는 방법은? (답: RAG 를 MCP 서버로 감싸면 됨)"
pubDatetime: 2026-06-26T23:30:00Z
tags:
  - mcp
  - anthropic
  - claude-desktop
  - llm
  - agent
  - 학습
draft: false
featured: false
---

[MCP 공부 #1 (Inspector 로 첫 호출)](/posts/mcp-study-log-01) 에 이어 오늘은 진짜 LLM 클라이언트 — **Claude Desktop** 과 연결.

어제는 MCP Inspector 로 서버 동작만 확인했지만, **오늘은 Claude Desktop 에서 내가 만든 서버를 호출하는 게 목표.**

## Table of contents

## Claude Desktop 의 MCP 등록 — config 파일 찾기

Claude Desktop 은 **`claude_desktop_config.json`** 에 등록된 MCP 서버를 자동으로 연결한다. 그러니까 이 파일만 잘 수정하면 됨.

문제는 **이 json 파일이 어디 있는지** 가 처음엔 안 보임 (나도 그랬다).

### 찾는 법

1. **좌하단 계정 아이콘 클릭** → 설정 메뉴 열기
2. 좌측 하단 **"데스크톱 앱"** 섹션의 **"개발자"** 탭 클릭

![Claude Desktop 설정 — 좌측 개발자 탭 / 우측 '로컬 MCP 서버: 추가된 서버가 없습니다' + 구성 편집·개발자 문서 버튼](/assets/posts/mcp-study-log-02-claude-desktop/01-local-mcp-server-settings.png)

3. **"구성 편집"** 버튼 클릭 → `claude_desktop_config.json` 가 들어있는 폴더가 팝업으로 열림

### config 파일에 서버 등록

내 경우는 **MCP 서버를 등록한 적이 없어서 빈 파일일 줄 알았는데** 이미 `cowork` 관련 설정이 있었음. Claude Desktop 이 자체적으로 미리 넣어둔 듯.

내가 만든 서버의 `command`, `args` 를 추가:

```json
{
  "mcpServers": {
    "energy-management": {
      "command": "python",
      "args": ["C:/path/to/energy_mcp_server.py"]
    }
  }
}
```

저장 후 **Claude Desktop 재시작.**

## 등록 확인 — 커넥터 메뉴

채팅창 좌하단의 **+ 버튼** → **커넥터** 항목에서 등록된 MCP 서버 목록 확인:

![+ 버튼 → 커넥터 메뉴 → 'energy-management' 토글 켜진 상태, 'Claude in Chrome' 도 같이 보임](/assets/posts/mcp-study-log-02-claude-desktop/02-connector-menu-energy-management.png)

json 에 입력한 그대로 **`energy-management`** 가 보임. 토글 ON 으로 활성화.

## 실제 도구 호출 — 그리고 처음 만난 승인 UX

채팅창에 **"공장 라인 목록 보여줘"** 입력. Claude 가 자동으로 MCP 서버의 도구를 사용하려고 시도:

![질문 후 Thinking → Finding tools → 'Claude가 energy-management에서 List production lines을(를) 사용하려고 합니다' 카드 + 항상 허용/거부 버튼](/assets/posts/mcp-study-log-02-claude-desktop/03-tool-call-with-approval.png)

### 흥미로운 부분 — 도구 호출에 사용자 승인이 끼어든다

> **"Claude가 energy-management에서 List production lines을(를) 사용하려고 합니다"** + [항상 허용 / 거부] 버튼

이게 바로 [LangGraph #3 에서 다뤘던 HITL 패턴](/posts/langgraph-study-log-03-human-in-the-loop) 의 클라이언트 단 구현. Claude Desktop 이 **자체적으로 MCP 도구 호출 직전에 사용자 승인 게이트를 끼워넣음.** 내가 따로 구현 안 해도 클라이언트가 안전장치를 한 겹 깔아줌.

승인하면 결과를 받아서 자연어로 정리해 답변. **어제 streamlit 으로 확인한 응답 품질** 그대로 나옴.

## Cowork 추천 — 별도 학습 주제

진행하다 보니 이런 배너가 등장:

![Cowork으로 백그라운드에서 실행하기 배너 — 'Cowork은 energy-management 전반에 걸친 복잡한 작업을 직접 지켜보지 않아도 처리할 수 있습니다'](/assets/posts/mcp-study-log-02-claude-desktop/04-cowork-suggestion-banner.png)

Claude 가 **"Cowork 에서 해보는 거 어때?"** 라고 추천. 내가 지금 학습 중인 범위에는 Cowork 가 안 포함되어 있어서, **Cowork 에서 MCP 사용하는 건 별도 트랙으로** 진행 예정.

## 새 도구 추가 → 재시작 → 즉시 인식

기존 코드에 도구를 추가하고 Claude Desktop 을 다시 시작하니 **새 도구가 즉시 인식됨.** 그러니까 개발 사이클은 단순:

> 코드 수정 → 저장 → Claude Desktop 재시작 → 새 도구 사용 가능

오늘 학습은 빨리 끝났음. (주말인 거 알고 일부러 가볍게 준비한 건가...)

## 의문 — RAG 와 MCP 를 같이 쓰는 방법은?

MCP 를 써보니 편리한데 한 가지 아쉬운 게 — **지금 만든 [FEMS RAG](/posts/fems-project-log-03) 와 연동이 안 됨.**

- RAG → API 를 갖다 쓰는 별도 백엔드 (Streamlit 안에 묶여 있음)
- MCP → Claude Desktop 앱 내에서 직접 호출

두 세계가 분리되어 있다는 느낌. **둘을 같이 쓰는 방법은 없을까?**

### 답 — RAG 자체를 MCP 서버로 감싸기

생각해보니 답은 의외로 단순:

> **RAG 검색 함수를 `@mcp.tool()` 로 감싸서 MCP 서버로 노출하면 된다.**

```python
@mcp.tool()
def search_fems_documents(query: str, top_k: int = 5) -> list[dict]:
    """FEMS 가이드라인에서 관련 청크를 검색."""
    # 기존 RAG 코드 그대로 — Chroma 검색 → 청크 반환
    return rag_pipeline.search(query, top_k)
```

이러면 Claude Desktop 이 질문 받았을 때:

1. 일반 답변으로 충분한가 판단
2. 도메인 지식 필요 → `search_fems_documents` 자동 호출
3. 검색된 청크 컨텍스트 + LLM 추론으로 응답

→ **사용자는 그냥 Claude Desktop 쓰는데 뒤에서 RAG 가 동작**. Streamlit 같은 별도 UI 없이 Claude Desktop 이 그대로 프론트가 됨.

## 회고

오늘 짧은 학습 정리:

1. **`claude_desktop_config.json` 찾기는 설정 → 데스크톱 앱 → 개발자 → 구성 편집** — 처음엔 어디 있는지 헷갈리는 게 정상
2. **Claude Desktop 이 자체적으로 도구 호출 승인 UX** 를 깔아줌 — 클라이언트 단 HITL
3. **개발 사이클은 단순** — 코드 수정 → 재시작 → 즉시 인식
4. **RAG ↔ MCP 분리감의 해법** — RAG 함수를 `@mcp.tool()` 로 감싸기

## 더 공부해볼 것

### 1. claude_desktop_config.json 의 모든 옵션

- `command` / `args` 외에 `env` / `cwd` 같은 추가 옵션
- 여러 MCP 서버를 동시에 등록할 때 충돌 방지
- 서버별 enabled/disabled 토글 위치
- `cwd` 로 venv 경로 지정하는 패턴 (#1 의 venv 트러블 슈팅 자동화)

### 2. RAG ↔ MCP 통합 패턴

- `search_documents(query, top_k)` 외에 `get_chunk_by_id` / `list_collections` 같은 보조 도구
- Claude 가 도구를 **여러 번 chain** 으로 호출 가능한지 (검색 → 보강 → 재검색)
- 검색 결과를 그대로 반환 vs LLM 이 정리해서 반환
- Hybrid Search (벡터 + 키워드) 를 한 도구로 묶을지 분리할지

### 3. 클라이언트 단 도구 승인 UX

- "항상 허용" 선택 후 그 도구는 어떻게 관리되는가
- 위험 도구를 명시적으로 매번 묻게 강제하는 옵션
- [LangGraph HITL](/posts/langgraph-study-log-03-human-in-the-loop) 의 서버 단 HITL 과 클라이언트 단 승인의 분업

### 4. Cowork × MCP

- Cowork 가 백그라운드 실행할 때 MCP 도구 호출 권한
- 사람 승인 없이 자율 실행 vs 단계별 승인
- 위험 도구의 별도 정책

### 5. Resources / Prompts 의 Claude Desktop UX

- [#1 에서 다룬 Resources / Prompts](/posts/mcp-study-log-01) 가 Claude Desktop 에서는 어떻게 보이나
- 채팅창에서 Resource URI 를 직접 첨부하는 패턴
- Prompt 템플릿이 슬래시 커맨드처럼 노출되는지

### 6. MCP 서버 디버깅

- 서버가 죽었거나 에러 났을 때 Claude Desktop 로그 위치
- stdio 통신 페이로드를 들여다보는 패턴
- 도구가 안 보일 때 첫 진단 체크리스트
