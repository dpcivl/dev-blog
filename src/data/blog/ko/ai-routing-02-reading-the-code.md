---
title: "AI 라우팅 #2 — 로컬 모델한테 OpenAI API 형식으로 말을 걸고 있었다"
description: "지난번에 세팅만 하고 안 읽었던 코드를 열어봤다. types.py 의 pydantic 모델부터 backends 의 추상 클래스까지 따라가다가, 로컬 ollama 에 보내는 요청이 OpenAI API 형식이라는 걸 알았다."
pubDatetime: 2026-09-22T13:20:00Z
tags:
  - LLM공부
  - ollama
  - 로컬LLM
  - python
  - 학습
draft: false
featured: false
---

[지난 세션](/posts/ai-routing-01-local-model-selection)에서는 uv 세팅과 모델 설치까지만 하고 코드를 못 봤다. 오늘은 그때 작성했던 코드가 **왜 그렇게 작성됐는지**를 보려고 했다. LLM 모델 라우팅을 할 때 어떤 과정을 거쳐서 구현하게 되는지가 궁금했다.

코드는 [ai-routing-trial 저장소](https://github.com/dpcivl/ai-routing-trial)에 있다.

## Table of contents

## 전체 흐름

<img src="/assets/mermaid/2b42350815328e34.svg" alt="사용자가 ai-router ask 로 질문하면 cli 가 명령을 해석하고 config 가 models.yaml 을 읽은 뒤, 라우터가 카테고리를 판단해 추론 · 코딩 · 비전 모델 중 하나를 고르고, 백엔드가 Ollama 에 HTTP 요청을 보내 응답과 속도 측정값을 돌려주는 흐름" width="629" height="814" style="max-width:min(100%, 629px);height:auto;" />

핵심은 **라우터에서 판단하고 백엔드에서 실행한다**는 것이다.

## `types.py` 읽기

첫 번째로 `src/ai_router/types.py` 를 읽었다.

라우팅 목적지를 반환하기 위한 `Category` 클래스가 있고, `UserRequest` · `RouteDecision` · `ChatResult` · `PipelineResult` 가 전부 `BaseModel` 을 상속받는다.

`BaseModel` 은 pydantic 이 제공하는 클래스다. C 의 struct 와 같은데, **잘못된 타입이 들어오면 에러를 낸다.** struct 와 다른 점은 검사 시점이다. 컴파일할 때가 아니라 값이 실제로 들어올 때 검사한다.

각각은 이런 역할이다.

- **`UserRequest`**: 사용자가 보낸 요청. 이미지가 있는지 없는지 확인한다
- **`RouteDecision`**: 라우터가 내린 판단 결과
- **`ChatResult`**: LLM 모델의 성능을 정량화할 수 있다
- **`PipelineResult`**: 요청을 처리한 전체 결과를 보여준다

`@property` 는 함수를 변수처럼 쓰게 해주는 것이다. `backends/base.py` 의 `if request.has_images:` 부분을 보면 이해가 된다. 메서드인데 괄호 없이 값처럼 읽힌다.

`RouteDecision` 에는 라우터가 내린 판단에 관한 멤버들이 있는데, 여기서 **`confidence` 값을 어떻게 계산하는지**가 궁금했다.

## `config.py` 와 `models.yaml`

라우터를 위한 모델을 설정할 때, 어떤 역할에 어떤 모델을 쓰는지는 `configs/models.yaml` 에 작성한다. `config.py` 는 그 `models.yaml` 을 파이썬 객체로 바꿔준다.

`load_config` 함수는 `cli.py` 의 `main` 함수에서 설정을 불러올 때 호출한다.

## 백엔드 살펴보기

`backends` 디렉토리에는 `base.py` 와 `openai_compat.py` 가 있다.

예전에 강우량계 데이터로거를 개발할 때 쓰던 ABC 가 여기 있었다. `base.py` 의 ABC 가 `openai_compat.py` 에서 세부 구성된다.

신기한 점이 하나 있었다. **stream 을 만드는 부분이 Claude API 로 예제를 만들었을 때와 비슷한 구문이었다.** 알고 보니 OpenAI 에서 쓰는 API 형식이었다.

Ollama 와 vLLM 둘 다 OpenAI 와 비슷한 API 를 쓴다. 그래서 형식은 같고, 서버만 내부 ollama 서버에서 돌리는 것이다.

## 오늘은 여기까지

`routers/` 는 아직 안 열어봤다. 라우터에서 판단한다는 것까지는 흐름도로 알았는데, 그 판단이 코드로 어떻게 생겼는지는 못 봤다.

## 더 공부해볼 것

- **`confidence` 는 어떻게 계산되는가** — `RouteDecision` 을 읽다가 제일 걸렸던 부분이다. 라우터가 "이 요청은 코딩이다" 라고 판단할 때 그 확신을 무엇으로 수치화하는지 모르겠다. 라우터 코드를 열면 답이 나올 것 같다
- **pydantic 의 검사 시점과 비용** — 값이 들어올 때 검사한다면, 요청이 계층을 지날 때마다 매번 검사하는 건지 궁금하다 → [Pydantic: Models](https://docs.pydantic.dev/latest/concepts/models/)
- **ABC 가 정확히 무엇을 강제하는가** — 강우량계 때도 썼는데 "상속받으면 구현해야 한다" 정도로만 알고 있다. 구현을 안 하면 언제 에러가 나는지 확인해보고 싶다 → [Python: abc](https://docs.python.org/3/library/abc.html)
- **Ollama 가 OpenAI 호환 API 를 어디까지 지원하는가** — 형식이 같다면 vLLM 으로 바꿔도 백엔드 코드가 그대로인지, 아니면 안 되는 기능이 있는지 → [Ollama: OpenAI compatibility](https://github.com/ollama/ollama/blob/main/docs/openai.md)
- **속도 측정값을 무엇으로 잡는가** — 흐름도 마지막에 "응답 + 속도 측정값" 이 있다. `ChatResult` 로 성능을 정량화한다고 적어뒀는데, 실제로 어떤 값을 재는지는 아직 안 봤다
