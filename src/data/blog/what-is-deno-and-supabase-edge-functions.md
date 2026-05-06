---
title: "Deno가 뭐야? — Supabase Edge Functions에서 만난 런타임"
description: "1인 앱 개발 중 Supabase Edge Functions를 만지다가 Deno를 처음 마주쳤다. Deno가 뭔지, Node.js와 어떻게 다른지, Supabase는 왜 굳이 Deno를 골랐는지 정리했다."
pubDatetime: 2026-05-06T06:30:00Z
tags:
  - deno
  - supabase
  - 런타임
  - 학습
draft: false
featured: false
---

1인 앱 개발을 하면서 백엔드를 Supabase로 잡았다. Edge Functions 기능을 쓰려고 보니 코드 환경이 Node.js가 아니라 **Deno**였다. "이건 또 뭐지?" 에서 시작해 정리한 내용.

## Table of contents

## Deno가 뭔가

> JavaScript와 TypeScript를 위한 런타임.

한 줄 요약은 이거다. Node.js와 같은 카테고리, 즉 **브라우저 밖에서 JS/TS 코드를 실행해주는 환경**이다.

## Node.js와 뭐가 다른가

직접 짚어본 차이 두 가지.

### 1. 권한 모델 — "기본 차단, 명시 허용"

- **Node.js**: 스크립트가 파일 시스템 / 네트워크 / 환경변수 등에 자유롭게 접근 가능
- **Deno**: 기본적으로 차단. 네트워크가 필요하면 `--allow-net`, 파일이 필요하면 `--allow-read` 식으로 **권한을 명시적으로 줘야** 실행됨

```bash
# Node — 그냥 돌아간다
node script.js

# Deno — 권한 없으면 막힌다
deno run script.ts                  # 네트워크 시도하면 실패
deno run --allow-net script.ts      # 네트워크 허용
```

이건 보안 관점에서 큰 차이다. 출처가 불분명한 스크립트를 돌릴 때 "이 스크립트는 네트워크에 접근하려 합니다" 같은 명시적 결정을 강제한다.

### 2. TypeScript 기본 지원

Node.js에서 TypeScript를 쓰려면 보통 `tsc`로 컴파일하거나 `ts-node` 같은 도구를 끼워야 한다. Deno는 **그런 설정 없이 `.ts` 파일을 그대로 실행**한다. `deno run script.ts` 면 끝.

## 그래서 런타임은 왜 쓰는가

여기서 한번 더 멈춰서 생각했다. "런타임이 도대체 왜 필요한 거지?"

JavaScript는 원래 브라우저에서 돌리도록 만들어진 언어다. 브라우저 안에는 V8 같은 엔진이 들어있어서 JS를 실행할 수 있지만, **브라우저 밖에서 JS 코드를 돌리려면 그걸 실행해줄 환경이 따로 있어야 한다.** 그게 바로 런타임 (Node.js, Deno, Bun 등).

서버에서 JS로 API를 만들거나, 빌드 스크립트를 JS로 짜거나, CLI 도구를 JS로 만들 때 — 전부 런타임이 깔려 있어서 가능한 일이다.

## Supabase Edge Functions는 왜 Deno를 쓰나

다음 의문은 이거였다. "Supabase는 왜 Node.js가 아니라 Deno를 골랐지?"

먼저 **Edge Function**이 뭔지부터.

> 사용자와 지리적으로 가까운 위치(엣지 서버)에서 실행되는 작은 서버 함수.

전통적인 API 서버는 한 리전(예: 미국 동부 데이터센터)에 떠 있고, 한국 사용자가 호출하면 매번 태평양을 건너 통신한다. Edge Function은 전 세계에 분산된 노드에서 사용자의 요청을 가까운 위치에서 처리해서 **지연을 줄인다**.

이런 환경에는 다음 특성이 잘 맞는다.

- **빠른 cold start** (요청 들어올 때마다 새로 띄우는 일이 잦음)
- **격리된 보안 모델** (여러 고객 함수가 같은 인프라에서 도는 multi-tenant 환경)
- **간단한 배포 단위** (단일 파일/번들로 배포 가능)

Deno는 이 셋을 자연스럽게 충족한다. 권한 모델은 보안 격리에 적합하고, TS를 그대로 실행하니 빌드 단계가 줄고, V8 isolate 기반이라 가볍게 띄울 수 있다. **Supabase가 런타임으로 Deno를 채택했기 때문에, 내 프로젝트에서 Edge Function을 작성할 때 자연스럽게 Deno 코드를 쓰게 된 것.**

(다른 회사들도 비슷한 선택을 한다 — Cloudflare Workers는 V8 isolate 기반이고, Netlify/Vercel의 일부 엣지 런타임도 비슷한 방향을 따른다.)

## 정리

- Deno = JavaScript/TypeScript 런타임 (Node.js와 같은 카테고리)
- 차이 핵심: **명시적 권한** + **TS 기본 지원**
- 런타임이 필요한 이유: JS를 브라우저 밖에서 실행하려면 그 실행 환경이 별도로 필요해서
- Supabase Edge Functions가 Deno를 쓰는 이유: 보안 격리 + 빠른 시작 + 간단한 배포에 잘 맞음

## 더 공부해볼 것

### 1. Deno 권한 시스템 자세히

- 어떤 권한 플래그가 있는가 (`--allow-net`, `--allow-read`, `--allow-env`, `--allow-run`...)
- 권한을 더 좁게 주는 법 (특정 호스트만 허용, 특정 경로만 허용 등)
- 참고: [Deno Permissions](https://docs.deno.com/runtime/fundamentals/security/)

### 2. Deno vs Node.js — API 차이

- 표준 라이브러리 위치 — Deno는 import URL 기반, Node는 npm 기반
- `npm:` specifier 로 Deno에서 npm 패키지 쓰는 법 (Deno 1.28+ 부터 지원)
- 기존 Node 코드를 Deno로 이식할 때 주의점

### 3. Supabase Edge Functions 실전

- 로컬 개발: `supabase functions serve` 로 로컬에서 띄우기
- 환경 변수 / Secrets 관리
- DB(Postgres)와 같은 프로젝트 안에서 어떻게 인증/연결되는가
- 참고: [Supabase Edge Functions 공식 문서](https://supabase.com/docs/guides/functions)

### 4. Edge Function의 한계

- cold start 시간이 노드 환경에 따라 들쭉날쭉할 수 있음
- 실행 시간 제한 / 메모리 제한이 있음 — 무거운 작업에는 부적합
- DB 풀 관리가 까다로움 (요청마다 새 connection 만들면 폭발) — Supabase는 이를 어떻게 해결하는지

### 5. V8 Isolate와 컨테이너의 차이

- 왜 Edge 환경은 Docker 컨테이너 대신 V8 isolate를 쓰나
- 시작 시간 / 메모리 / 격리 강도 측면 비교
- Cloudflare Workers의 isolate 모델과 Deno Deploy의 차이

## 회고

처음 Edge Functions 폴더를 열어보고 "왜 갑자기 deno?" 했는데, 결국 **하나의 도구를 고를 때 그 회사가 어떤 제약과 목표를 갖고 있었는지 역으로 추론하면 그 도구가 왜 거기 있는지 이해된다**는 걸 배웠다. Supabase가 멀티 테넌트 엣지 환경을 굴리려면 Node 컨테이너보다 Deno isolate가 자연스러운 선택이었던 것.

다음에 새로운 도구를 만나면 "이게 뭐지?"에서 끝나지 말고 "이걸 쓴 사람들은 어떤 문제를 풀고 있었나"까지 한번 더 들어가보자.
