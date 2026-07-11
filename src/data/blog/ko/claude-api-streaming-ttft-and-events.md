---
title: "Claude API 스트리밍 — TTFT가 왜 중요하고, 이벤트는 어떻게 흐르는가"
description: "스트리밍은 단순한 'LLM처럼 글자가 흘러나오는 효과'가 아니다. 같은 총 시간이라도 사용자가 첫 결과를 보기까지의 시간(TTFT)이 달라지고, 그 차이가 UX의 핵심이다. 그리고 그걸 받는 이벤트 순서도 직접 찍어봤다."
pubDatetime: 2026-05-07T13:30:00Z
tags:
  - LLM공부
  - claude-api
  - llm
  - 스트리밍
  - 학습
draft: false
featured: false
---

[멀티턴](./claude-api-multi-turn-context) → [시스템 프롬프트](./claude-api-system-prompt-vs-user-message) 에 이어, 이번엔 **스트리밍**을 공부했다. 첫 인상은 "그냥 효과 좋은 출력 방식 아닌가?" 였는데, 실제로 만져보고 이벤트 순서를 찍어보니 생각보다 본질적인 기능이었다.

## Table of contents

## 스트리밍이 뭔가

스트리밍 옵션을 켜고 동일한 챗 예제를 돌려봤다. 결과는 **글자가 한 번에 떨어지지 않고, 청크 단위로 조금씩 도착하면서 화면에 점점 채워졌다.** 우리가 익숙한 ChatGPT/Claude 웹 UI의 그 흐르는 출력이다.

비스트리밍 모드는 모델이 응답을 다 만든 뒤 한 덩어리로 받지만, 스트리밍 모드는 **모델이 토큰을 만드는 순간부터 즉시 클라이언트로 흘려준다.**

## "근데 이거 왜 쓰는 거지? 취향 차이 아닌가?"

처음 든 의문은 이거였다. 어차피 모델이 응답을 끝내는 데 걸리는 **총 시간은 같을 텐데**, 흘러나오는 거랑 한 번에 받는 거랑 무슨 차이지?

직접 따져보니 답이 명확해졌다.

### 핵심은 TTFT — Time To First Token

> 사용자가 **첫 글자를 보기까지** 걸리는 시간.

비스트리밍과 스트리밍의 본질적 차이는 여기 있다.

| | 비스트리밍 | 스트리밍 |
|---|---|---|
| 첫 글자 보이는 시점 | 응답 완성 후 (3–10초) | **첫 토큰 생성 즉시 (약 수백ms)** |
| 응답 완료까지 총 시간 | 비슷 | 비슷 |
| 사용자 체감 속도 | "느리다" | "빠르다" |

**총 시간이 같아도 사람은 빠르다고 느낀다.** 멍하니 빈 화면 보면서 5초 기다리는 것과, 즉시 첫 단어가 뜨고 점점 채워지는 5초는 완전히 다른 경험이다. 진행되고 있다는 시각적 신호가 있냐 없냐의 차이.

추가로 — 스트리밍은 **끊김에 강하다**. 사용자가 답이 만족스러운 시점에 중간에 끊고 다음 행동으로 넘어갈 수 있다(긴 응답 전체를 끝까지 기다릴 필요가 없음). 챗봇/검색/요약 류 서비스에서 매우 중요한 특성.

## 채팅 예제를 스트리밍 버전으로 업그레이드

이전에 만들어둔 멀티턴 챗 예제를 스트리밍 버전으로 바꿔봤다. 큰 차이는 응답을 **이터레이터로 받는다**는 것.

```python
# 비스트리밍 — 한 덩어리
response = client.messages.create(
    model="claude-opus-4-5",
    max_tokens=1024,
    messages=messages,
)
print(response.content[0].text)
```

```python
# 스트리밍 — 청크가 흘러옴
with client.messages.stream(
    model="claude-opus-4-5",
    max_tokens=1024,
    messages=messages,
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)
```

`text_stream` 이터레이터로 받으면 모델이 만들어내는 순서대로 텍스트 청크가 도착한다. `flush=True` 안 해주면 파이썬 stdout 버퍼에 갇혀서 "스트리밍 같은데 한 덩어리로 출력되는" 어색한 상황이 생기더라.

## 이벤트 순서를 직접 찍어봤다

`text_stream` 은 편의 추상화고, 그 아래에는 **세분화된 이벤트 시퀀스**가 흐른다. 이벤트 단위로 받아보면 다음 순서였다.

```
메시지 시작 (message_start)
  └ 컨텐츠 블록 시작 (content_block_start)
       └ 청크 여러 개 (content_block_delta)
       └ 청크 여러 개
       └ ...
  └ 컨텐츠 블록 종료 (content_block_stop)
메시지 종료 (message_stop)
```

겉에서 보면 그냥 글자가 흘러오는 것 같지만, 실제로는 **메시지 시작 → 블록 시작 → 델타들 → 블록 종료 → 메시지 종료**의 명확한 라이프사이클이 있다.

## Tool Use 스트리밍은 어떻게 다른가

여기서 학습 자료에 다음과 같은 비교가 등장했다.

![일반 텍스트 스트리밍과 Tool Use 스트리밍의 이벤트 차이를 비교하는 학습 자료](/assets/posts/claude-api-streaming-ttft-and-events/01-text-vs-tool-use-streaming.webp)

핵심 정리:

- **일반 텍스트 스트리밍**: `text_stream` 이 텍스트 청크들을 그대로 흘려준다. 위 사진 예시 — `"부산"`, `"의 "`, `"날씨"`, `"는"` 처럼 단어 조각이 도착.
- **Tool Use 스트리밍**: 이벤트 흐름이 다르다.
  ```
  content_block_start (type: tool_use, name: "get_weather")
  input_json_delta ('{"ci')
  input_json_delta ('ty":')
  input_json_delta ('"부산')
  input_json_delta ('"}')
  content_block_stop
  ```
  → **도구 이름은 처음에 한 번에 도착**하고, 도구의 인자(JSON 문자열)가 청크 단위로 쪼개져서 흘러온다.

JSON이 부분 부분 끊겨서 도착하기 때문에 클라이언트에서 누적해서 합쳐야 완전한 JSON이 된다. 텍스트는 토큰 단위로 그냥 누적해도 되지만, **Tool Use는 JSON 형식을 유지해야 하므로 다 받은 뒤 한 번에 파싱**하는 흐름이 자연스럽다.

(Tool Use 자체는 다음 학습 차시에서 다룰 예정. 여기서는 "스트리밍 이벤트 흐름이 다르다"는 차원에서만 짚어둠.)

## 정리

- 스트리밍의 본질은 "효과"가 아니라 **TTFT 단축**이다. 총 시간이 같아도 사용자는 빠르다고 느낀다.
- 끊김 가능성도 중요한 부수효과 — 사용자가 만족 시점에 멈출 수 있다.
- 스트리밍 응답은 **메시지 시작 → 블록 시작 → 델타들 → 블록 종료 → 메시지 종료** 라이프사이클을 따른다.
- Tool Use 스트리밍은 도구 이름은 한 번에, 인자(JSON)는 청크로 흘러온다 → 받는 쪽 처리 방식이 다르다.

## 더 공부해볼 것

### 1. TTFT를 측정하는 법

- 비스트리밍과 스트리밍의 **TTFT 차이를 직접 stopwatch로 찍어 보기**
- 동일 프롬프트 100회 호출해서 분포(평균/중앙값/p95) 비교
- 모델 크기(Opus / Sonnet / Haiku)에 따라 TTFT가 어떻게 달라지나
- 참고: [Anthropic Streaming Messages 문서](https://docs.claude.com/en/api/messages-streaming)

### 2. 이벤트 종류 전수조사

- `message_start`, `content_block_start`, `content_block_delta`, `content_block_stop`, `message_delta`, `message_stop`, `ping`, `error` — 각각 언제 쓰이는가
- `message_delta` 는 무엇을 담는가 (usage 정보 등 메타데이터?)
- 에러 발생 시 어떤 이벤트가 오는가 — 클라이언트에서 안전하게 끊는 패턴

### 3. Tool Use 스트리밍 자세히 (다음 차시)

- `input_json_delta` 가 부분 JSON 조각으로 오는 이유 (모델 내부 토큰 단위로 쪼개져서)
- 청크들을 안전하게 누적해서 완전한 JSON으로 만드는 패턴
- 여러 tool call 이 한 응답에 들어있을 때 (parallel tool calls) 이벤트가 어떻게 섞이는가

### 4. 스트리밍 + Prompt Caching 같이 쓸 때

- 캐시 히트 시 TTFT가 더 단축되는가? 얼마나?
- 캐시된 부분은 스트리밍 이벤트로 어떻게 표현되는가 (한 번에 옴? 그래도 청크?)

### 5. UX 측면 베스트 프랙티스

- 스트리밍 중 사용자가 stop 누르면 어떻게 처리하는 게 깔끔한가
- 모바일에서 스트리밍 응답을 부드럽게 렌더링하는 방법 (auto-scroll, 깜빡임 제어)
- 스트리밍 도중 네트워크 끊김 / 재연결 처리

## 회고

처음엔 "그냥 보기 좋아서 쓰는 거 아닌가" 정도로 여겼는데, **TTFT라는 지표 하나로 같은 응답이 다른 제품처럼 느껴진다**는 걸 알게 되니 시각이 달라졌다. 지연을 진짜로 줄이는 게 어려울 때, 사용자가 **체감하는** 지연을 줄이는 방향으로 가는 것 — 이게 LLM 서비스 설계의 중요한 한 축인 것 같다.

다음 차시 Tool Use 들어가면, 스트리밍에서 받은 부분 JSON을 어떻게 안전하게 합쳐서 함수 호출까지 연결하는지 직접 짜봐야겠다.
