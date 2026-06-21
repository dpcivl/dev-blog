---
title: "바이브코딩을 위한 상태 관리 어휘 — Client/Server State · Derived · Optimistic · Cache Invalidation"
description: "용어 정리 시리즈 4탄이자 마지막. 'AI 에게 상태 관리 짜줘' 라는 막연한 지시를 벗어나기 위한 4가지 핵심 어휘 — Client/Server State 분리, Derived (파생 상태), Optimistic Update, Cache Invalidation + 트리거 패턴. 핵심 개념은 playground 에서 직접 만져볼 수 있게 따로 만들어뒀다."
pubDatetime: 2026-06-21T04:10:00Z
tags:
  - 상태관리
  - 바이브코딩
  - 용어정리
  - 학습
draft: false
featured: true
---

용어 정리 시리즈의 **마지막** 글이다 ([UI](./ui-vocabulary-for-vibe-coding) / [DB](./db-vocabulary-for-vibe-coding) / [API](./api-vocabulary-for-vibe-coding) 에 이은 4편). 오늘 먼저 올린 글 [내가 보려고 만든 공부 방법](./my-5-step-study-method-for-new-tech) 에서 적었듯 **용어 정리 + playground 도 좋지만 직접 구현하면서 공부하는 게 더 낫다고 판단** 해서 시리즈는 여기서 마무리. 다음부터는 구현 글로 전환.

오늘 주제는 **상태 관리** (state management).

> 📍 핵심 개념(Client/Server state / Derived / Optimistic Update / Cache Invalidation) 은 글 끝의 [playground](/playground/state-terms/) 에서 직접 만져볼 수 있게 따로 만들어뒀다.

## Table of contents

## 1. Client state vs Server state — 가장 먼저 나눠야 할 두 종류

상태를 다룰 때 가장 먼저 헷갈리는 게 이 두 가지. **데이터의 "주인" 이 다르다** 고 생각하면 잘 갈라진다.

### Client state — 앱이 주인

오직 앱 안에서만 존재하고, **서버는 모르는 순수 로컬/UI 상태**. **새로고침해서 사라져도 괜찮은 정보**.

- 다크모드 토글
- 폼에 입력 중인 텍스트
- 모달 열림/닫힘
- 스크롤 위치

서버와 동기화할 필요 없음.

### Server state — 서버(DB) 가 주인

진짜 원본은 서버에 있고, **앱은 사본(캐시)을 잠깐 들고 있을 뿐**. 그래서 두 가지 문제가 생긴다:

1. **최신화** — 내가 지금 보는 동안 서버에서 이미 바뀌었을 수 있음
2. **동기화** — 내가 수정한 걸 서버에 어떻게 반영하나

- API 로 받아온 데이터
- 다른 사용자가 만든 콘텐츠
- 댓글 / 좋아요 수

### 왜 나눠야 하나

**둘을 나누지 않으면 client state 다루는 방식으로 server state 를 다루다가 동기화 문제가 터진다.** "useState 하나로 다 처리하자" 가 안 되는 이유.

> 그래서 React 진영에선 **client state 는 Zustand/Jotai/useState**, **server state 는 TanStack Query/SWR** 처럼 별도 라이브러리로 분리하는 게 표준이 됐다.

## 2. Derived (파생 상태) — 저장하지 말고 계산해서 써라

**다른 상태로부터 계산되어 나오는 값.**

가장 직관적인 예: **총액**.

- 단일 물품들 → **원본 상태** (저장 필요)
- 총 가격 → **파생 상태** (계산만 하면 됨)

단일 물품들이 언제든 바뀔 수 있으니까 **파생 상태는 저장할 필요가 없다.** **원본만 저장하고, 파생은 계산해서 쓴다.**

저장하면 생기는 문제 — **원본은 바뀌었는데 파생은 안 바뀌어서 두 값이 어긋남.** 이런 버그는 디버깅이 어렵다. 그래서 "**single source of truth**" 원칙: **원본은 한 곳에만**.

## 3. Optimistic Update (낙관적 업데이트) — 일단 성공했다 치고 보여주자

> 요청 이후에 서버 응답을 기다리지 않고 **일단 성공했다 치고 화면을 먼저 바꾼다.** 실패하면 되돌린다.

[DB 글](./db-vocabulary-for-vibe-coding) 에서 봤던 **낙관적 락** 과 비슷한 사고방식 — "보통은 잘 되겠지" 라고 가정하는 것.

### 왜?

**체감 속도가 빨라진다.** 굳이 서버 반응 기다릴 필요 없고, 사용자가 요청한 걸 바로 보여주면 되니까.

대표 예 — **SNS 의 좋아요 기능**:

1. 사용자가 하트 클릭
2. UI 는 **즉시** 하트가 채워짐
3. 백그라운드에서 서버에 요청
4. 성공 → 그대로
5. 실패 → 하트 다시 비움 (롤백)

서버가 늦거나 실패해도 사용자는 "즉시 반응한다" 고 느낀다.

### 핵심

**즉시 UI 를 바꾸고, 그 후 서버 상호작용이 실패했다면 이전 상태로 롤백.**

## 4. Cache Invalidation (캐시 무효화) — 언제 다시 받을 것인가

앞에서 **앱이 사본을 들고 있다** 고 했다. 이 사본이 너무 낡았다고 판단해서 **다시 들고 오는 것** 이 캐시 무효화.

### Trade-off

- **너무 자주 받음** → 네트워크 낭비
- **너무 안 받음** → 낡은 화면

"언제 다시 받아야 하나" 를 잘 정해야 한다. 이걸 다루는 게 **트리거 패턴**.

### 4가지 트리거 패턴

| 패턴 | 시점 | 예시 |
|---|---|---|
| **이벤트 기반** | 특정 동작 후 무효화 | 글을 POST 하면 글 목록 캐시 무효화 → 새로 fetch |
| **시간 기반** | N 초/분 지나면 갱신 | 위드뮤 같은 사이트에서 자동 새로고침 |
| **포커스/재진입** | 앱 다시 열면 갱신 | 탭 다시 활성화 시 fetch |
| **수동** | 사용자가 새로고침 버튼 | pull-to-refresh |

### 낙관적 + 무효화 조합 — "즉시 반응 + 결국 정합"

이 두 가지를 같이 쓰면:

1. **낙관적 업데이트** 로 UI 즉시 변경
2. 서버 요청 끝나면 **관련 캐시를 무효화**
3. 서버가 들고 있는 진짜 상태와 맞춤

체감 속도는 빠르고, 정합성도 결국 맞춰진다.

### 트리거 결정 — "실시간성 기준" 으로

트리거 패턴을 정할 때 **내가 생각하는 최신화 주기가 어느 정도인지** 를 기준으로:

- **실시간이어야 함** → 이벤트 기반, 자주 무효화
- **가끔 바뀌어도 OK** → 시간 기반, 재진입 시 무효화

## 회고

오늘 내용은 사실 어제 미리 폰으로 공부한 거고, 다시 볼 때 **내가 예제를 생각하면서 공부** 하니까 바로바로 이해됐다 (SNS 좋아요 = 낙관적 / 총액 = 파생 / 다크모드 = client / API = server 같이).

용어 정리 시리즈는 여기까지. **이제부터는 실제 구현 + 부족한 부분 + 신기술 위주의 글로 전환.**

## 더 공부해볼 것

### 1. 상태 관리 라이브러리 — Client / Server 분리해서

- **Client state** (React): Zustand, Jotai, Redux (Toolkit), Recoil, useReducer
- **Server state** (React): TanStack Query (React Query), SWR, Apollo, RTK Query
- Vue: Pinia (client) + TanStack Query (server)
- Svelte: 자체 store + TanStack Query
- "왜 둘을 나눠 쓰는가" 는 위에서 다뤘고, **어떤 조합이 본인 프로젝트에 맞는지** 가 다음 과제

### 2. SWR — Stale-While-Revalidate 패턴

- 캐시된 (낡은) 데이터를 **일단 보여주고**, 그 사이에 백그라운드에서 fresh 한 데이터를 가져옴
- 사용자는 즉시 결과를 보고, 새 데이터가 도착하면 자동 갱신
- Vercel SWR 라이브러리 이름이 여기서 온 것
- HTTP `Cache-Control: stale-while-revalidate` 헤더 표준이기도 함

### 3. CRDT — 협업 앱의 분산 상태

- Notion, Figma, Linear 같은 협업 앱이 동시 편집을 어떻게 충돌 없이 처리하는가
- **Conflict-free Replicated Data Types** — 여러 사람이 동시에 같은 데이터를 수정해도 결국 같은 상태로 수렴
- Yjs, Automerge 같은 라이브러리
- 일반 CRUD 와 차원이 다른 상태 관리

### 4. 낙관적 UI 의 실패 처리 UX

- 단순히 롤백하면 사용자가 "내가 뭐 한 거지?" 헷갈림
- Toast 알림 / Banner / 재시도 버튼 / undo 옵션 등 패턴
- Twitter 의 트윗 실패 시 UX, Slack 의 메시지 전송 실패 시 UX 가 참고할 만한 사례
- 낙관적 UI 가 즉시 반응의 장점만큼 **실패 알림의 명확성** 도 같이 설계해야 함

### 5. 정규화된 캐시 (Normalized Cache)

- 같은 리소스 (예: user_42) 가 여러 API 응답에 등장할 때 **중복 저장** 의 문제
- Apollo, RTK Query, Relay 같은 라이브러리는 **id 기준 정규화** — 한 곳에만 저장하고 참조
- TanStack Query 는 정규화 안 함 (각 query key 마다 별도 캐시) — 둘의 trade-off
- 본격적 SPA 의 캐시 구조 설계 시 핵심 결정 사항
