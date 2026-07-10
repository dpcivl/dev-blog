---
title: "Claude Code 가 갑자기 안 되는 날 — 529 Overloaded 에러와 status.claude.com 의 존재"
description: "아침에 평소처럼 Claude Code 켰는데 자꾸 '서버 과부하' 라며 에이전트 호출이 실패. API Docs · 개발자 단톡 · status.claude.com 까지 따라가서 원인이 Anthropic 서버 측 일시 과부하임을 확인한 짧은 트러블슈팅 일지."
pubDatetime: 2026-06-22T07:00:00Z
tags:
  - 트러블슈팅
  - claude-api
  - claude-code
  - 일지
draft: false
featured: false
---

![Claude Code 에이전트 호출 실패 — 529 Overloaded 에러 메시지](/assets/posts/claude-code-529-overloaded-jun-2026/01-claude-code-error.webp)

Claude Code 로 코딩 중인데 자꾸 **서버 과부하로 에이전트 호출이 안 된다** 고 했다. 어떤 문제인지 따라가본 짧은 일지.

## Table of contents

## 1. 에러 메시지 확인

```
API Error: 529 Overloaded. This is a server-side issue,
usually temporary — try again in a moment.
If it persists, check https://status.claude.com.

agentId: a774ac...8bf62
subagent_tokens: 0
tool_uses: 0
duration_ms: 191200
```

대충 읽어봐도 **일시적 server-side 이슈** 라서 내가 뭘 할 수 있는 건 없어 보였지만 그래도 찾아봤다.

> **529** 는 [API 설계 글](./api-vocabulary-for-vibe-coding) 에서 정리한 5xx 대역의 에러. 클라이언트 잘못이 아니라 **서버 잘못**. 일시적이면 재시도로 풀린다.

## 2. Claude API Docs 에서 529 원인 확인

![Claude API Docs — 529 Overloaded 의 정의와 발생 상황 설명](/assets/posts/claude-code-529-overloaded-jun-2026/02-claude-api-docs-529.webp)

요약하면:

- **조직의 사용량이 갑자기 커졌을 때**
- **전체 사용자의 사용량이 급증했을 때**

서버 측에서 일시적으로 과부하가 걸린다는 의미. 아침에 늘 하던 대로 작업하던 거라 **내가 에이전트를 많이 호출해서 그런 게 아닐 가능성이 컸다** — 결국 Anthropic 서버 자체의 내부 문제일 가능성.

## 3. 개발자 단톡에서 단서 — `status.claude.com`

![개발자 단톡 — 같은 시각 다수가 같은 에러를 보고하고 status 페이지를 공유](/assets/posts/claude-code-529-overloaded-jun-2026/03-group-chat-confirms.webp)

같은 시각에 들어가 있는 개발자 단톡에서도 **같은 에러로 난리** 였다. **나만 그런 게 아니라 다수가 같은 증상.** 언제 풀리나 마냥 기다려야 하는 줄 알았는데, 단톡에서 **`status.claude.com`** 을 가보라는 단서를 얻었다.

> *(단톡 캡처는 다른 분들의 이름을 가려서 사용했습니다.)*

## 4. status.claude.com — Anthropic 의 공식 상태 페이지

![status.claude.com — Investigating 상태로 진행 중인 인시던트 표시](/assets/posts/claude-code-529-overloaded-jun-2026/04-status-claude-investigating.webp)

**UTC 00:37** = 한국 시간 오전 9:37. 현재 에러가 발생해서 **계속 조사 중 (Investigating)** 인 것으로 표시. 여기서 **"Resolved"** 가 뜨면 해결된 것.

> 이런 status page 의 존재 자체가 발견. 본인이 서비스를 만들 때도 비슷한 페이지를 운영하면 사용자 신뢰에 도움이 될 것 같다.

## 5. 해결 — Opus 4.8 복구

![Past Incidents 에서 Resolved 로 마무리된 기록 확인](/assets/posts/claude-code-529-overloaded-jun-2026/05-past-incident-resolved.webp)

Opus 4.8 이 풀리고 나서 바로 작업을 들어가서 **"Resolved" 가 뜨는 순간은 실시간으로 못 봤지만**, 나중에 **Past Incidents** 에서 확인 가능했다.

## 회고

해결 자체는 내가 한 게 없다 — 그냥 풀리길 기다린 것. 다만 **다음에 또 비슷한 일이 생겼을 때 행동 순서** 가 잡혔다:

1. **에러 메시지의 status code 보기** — 4xx 면 내 잘못, 5xx 면 서버 잘못
2. **공식 문서에서 그 코드의 의미 확인** (API Docs)
3. **status page** 확인 (이번에 알게 된 `status.claude.com`)
4. **나만 그런지 / 다수인지** 빠르게 파악 — 단톡 / Twitter / Reddit
5. **다수면 기다림. 나만이면 재현 / 코드 / 환경 점검.**

> 한 가지 다음에 시도해볼 것 — **다중 LLM provider fallback**. Claude 가 안 될 때 OpenAI 로 자동 전환하면 작업 중단을 최소화할 수 있다. 단, Claude Code 자체는 Anthropic 전용이라 fallback 이 어렵고, **본인 API 코드** 에서는 가능.

## 더 공부해볼 것

### 1. 529 의 표준 위치

- 공식 HTTP status code 표준 (IANA) 에는 **529 가 없다.** 비표준 확장 코드
- Shopify, Cloudflare, Anthropic 등 일부 서비스가 "site is overloaded" 의미로 사용
- 표준 5xx 대안: **503 Service Unavailable** 이 가장 가까움
- 참고: [MDN HTTP status code 목록](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)

### 2. Anthropic SDK 의 529 자동 재시도

- [에러 핸들링 글](./claude-api-error-handling-and-retry) 에서 다뤘던 자동 재시도 정책
- SDK 가 529 를 재시도 대상으로 인식하는지 (보통 5xx 는 재시도, 단 일정 횟수 이내)
- `max_retries` 늘려서 더 끈질기게 재시도하기 vs 일찍 포기하고 fallback 으로 가기 선택

### 3. Status page 의 일반적 구조

- **Incident** (발생) → **Investigating** (조사) → **Identified** (원인 파악) → **Monitoring** (모니터링) → **Resolved** (해결)
- 한국 사용자가 잘 보는 status page: GitHub Status, Slack, OpenAI, Anthropic
- 본인 서비스용 status page 도구: Atlassian Statuspage, Better Uptime, Instatus

### 4. 다중 LLM provider fallback 패턴

- LangChain 의 `with_fallbacks()` — 1차 모델 실패 시 2차로 자동
- **LiteLLM** 같은 라이브러리 — 여러 provider 통합 인터페이스
- 비용 최적화 측면 — 평소엔 싼 모델, 실패 시 비싼 모델로
- 응답 품질 일관성 유지가 challenge

### 5. Claude Code 의 에이전트 / 서브에이전트 메타 정보

- 에러 메시지에 나온 `agentId`, `subagent_tokens`, `tool_uses`, `duration_ms` 의 정확한 의미
- Claude Code 의 에이전트가 어떻게 sub-agent 를 호출하는가 (multi-agent orchestration)
- 디버깅 시 활용 방법
- [Claude Code 공식 문서](https://docs.anthropic.com/en/docs/claude-code)
