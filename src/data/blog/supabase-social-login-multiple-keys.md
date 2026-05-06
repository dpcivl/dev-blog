---
title: "Supabase에서 카카오·구글 로그인 붙일 때 마주친 두 가지 함정"
description: "id_token의 audience 검증 실패와 redirect URI 누락. 둘 다 공식 문서엔 잘 안 보이는 함정이라 내가 직접 부딪혀서 해결한 과정을 기록한다."
pubDatetime: 2026-05-06T09:00:00Z
tags:
  - supabase
  - 인증
  - 트러블슈팅
  - oauth
draft: false
featured: true
---

1인 앱 개발에서 백엔드를 Supabase로 잡고, 소셜 로그인(카카오·구글)을 붙이는 작업을 했다. 양쪽 다 공식 문서대로 따라하면 될 것 같았는데, 실제로는 한참 헤맸다. 두 가지 함정과 해결법을 기록한다.

## Table of contents

## 상황 — "분명히 다 세팅했는데 왜 안 되지"

체크리스트는 다 채웠다.

- 카카오 개발자 콘솔에서 앱 등록 ✓
- API 키 발급 (REST API / JavaScript / Native App 모두) ✓
- Redirect URI 등록 ✓
- Supabase 쪽 Auth Provider 설정 ✓ (Kakao 활성화, REST API Key 입력)

그런데 앱에서 카카오 로그인을 시도하면 다음 에러가 떨어졌다.

```
[AuthService] Kakao signIn error: AuthApiException(
  message: Unacceptable audience in id_token: [REDACTED_KEY_32CHARS],
  statusCode: 400,
  code: null
)
```

**`Unacceptable audience in id_token`** — 들어본 적 없는 메시지였다.

## 함정 1 — id_token의 `aud`(audience)가 매칭 안 됨

직관적으로 처음엔 redirect URI 문제라 생각했다. 카카오 개발자 콘솔의 **JavaScript** 쪽 redirect URI를 이리저리 바꿔봤지만 변화 없음.

다음 가설: "Supabase에 REST API 키를 넣었으니, 클라이언트도 REST API 방식을 쓰는 게 맞나?" → 코드를 그쪽으로 맞췄다. 여전히 같은 에러.

여기서 한참 막혀 있다가, **Supabase Auth 설정 화면의 'REST API Key' 입력란이 사실 여러 값을 받을 수 있다는 점**을 발견하고 시도해봤다.

> 카카오에서 발급받은 **REST API 키 + JavaScript 키 + Native App 키를 모두 콤마(,)로 구분**해서 한 칸에 다 넣어버렸다. (공백 없이)
>
> 즉시 로그인이 됐다.

```
# Supabase → Auth → Providers → Kakao → "REST API Key" 필드
abcd1234efgh5678ijkl,9876mnop5432qrst,xyz0123abc4567def
```

같은 방식을 구글에도 적용했다. **앱(Android/iOS)용 OAuth Client ID와 웹용 OAuth Client ID를 콤마로 구분해 둘 다 넣으니** 똑같이 해결됐다.

### 왜 이렇게 동작하는가 (내 해석)

`id_token`은 OAuth/OIDC 표준에 정의된 JWT인데, 그 안에 `aud`(audience) 클레임이 들어있다. 이 클레임은 "이 토큰은 어느 클라이언트(앱)를 대상으로 발급된 토큰인지"를 나타낸다.

문제는, 카카오/구글이 발급하는 `aud` 값이 **로그인을 시도한 SDK/플랫폼에 따라 다르다**는 점이다.

- 사용자가 모바일 앱에서 네이티브 SDK로 로그인 → `aud`는 **Native App 키**
- 웹/JS에서 JS SDK로 로그인 → `aud`는 **JavaScript 키**
- 백엔드에서 REST 호출 → `aud`는 **REST API 키**

Supabase는 받은 `id_token`의 `aud` 값을, 자기가 등록해둔 키와 일치하는지 검증한다. 한 가지 키만 등록해두면, 다른 플랫폼에서 로그인한 사용자의 토큰은 **`aud`가 안 맞아서 거절**된다. 그게 `Unacceptable audience` 에러의 정체였다.

콤마로 구분해서 모든 키를 넣어두면, 어떤 플랫폼에서 들어와도 `aud`가 그 목록 중 하나와 일치하니 통과한다. 이게 임시 우회가 아니라 **정식으로 지원되는 형태**라는 게 Supabase 설정 화면을 다시 봤을 때 작은 힌트로 적혀 있긴 했다 (놓치고 있었음).

## 함정 2 — Redirect URI에 `/auth/v1/callback` 누락

audience 문제를 풀고 나서, 이번엔 로그인 자체는 성공하는데 **앱으로 안 돌아오는** 문제가 있었다. OAuth 제공자가 인증 후 redirect URI로 돌려보내주는데, 그 URI에서 응답이 날아가지 않는 느낌이었다.

원인: 카카오 개발자 콘솔에 등록한 Redirect URI가 단순히 `http://localhost:54321` 형태였다. 여기에 **`/auth/v1/callback`** 경로를 붙여야 한다.

```
# 잘못 등록한 형태 (응답 못 받음)
http://localhost:54321

# 올바른 형태 (Supabase Auth 콜백 경로)
http://localhost:54321/auth/v1/callback
```

`/auth/v1/callback`은 Supabase의 표준 OAuth 콜백 엔드포인트다. OAuth 제공자(카카오/구글)는 사용자를 이 정확한 경로로 리다이렉트해야 Supabase가 그 흐름을 받아 처리할 수 있다.

production 환경이라면 같은 식으로 `https://<project>.supabase.co/auth/v1/callback` 으로 등록한다. 로컬 개발 시에는 로컬 Supabase 인스턴스가 떠 있는 포트(보통 `54321`) + `/auth/v1/callback`.

## 정리

체크리스트를 다 채웠는데 안 될 때, 의심한 순서.

| 의심 | 결과 |
|---|---|
| Redirect URI 형태 (host/port) | 부분적 — host/port는 맞았지만 path가 빠져있었음 |
| 클라이언트 SDK 종류 (REST vs JS) | 무관. SDK 종류가 아니라 키 종류가 핵심 |
| 카카오 콘솔의 어떤 한 키만 쓰면 되겠지 | 틀림. **모든 키를 콤마로 등록**해야 안전 |
| Supabase 쪽 콜백 경로 | 맞음. **`/auth/v1/callback` 누락**이 원인 |

핵심 두 줄.

1. **Supabase 소셜 로그인 설정에서 키 입력란은 콤마 구분 리스트.** 카카오는 REST API + JS + Native, 구글은 웹 + 앱 OAuth Client ID 모두 넣어둘 것.
2. **OAuth 제공자에 등록하는 Redirect URI는 `/auth/v1/callback` 경로까지 포함**해야 함.

## 더 공부해볼 것

### 1. OIDC와 `id_token` 구조

- `id_token`이 정확히 무엇인지 (vs `access_token`)
- JWT 클레임 — `iss`, `sub`, `aud`, `exp`, `iat` 각각의 의미
- `aud` 검증을 왜 강하게 하는지 (없으면 어떤 공격이 가능한지 — token confused deputy / replay)
- 참고: [OpenID Connect Core 1.0 — id_token](https://openid.net/specs/openid-connect-core-1_0.html#IDToken)

### 2. Supabase Auth 내부 동작

- Supabase가 OAuth provider 설정 시 어떤 흐름으로 토큰을 받고 검증하는지
- "REST API Key" 입력란이 콤마 구분을 받는다는 게 어디 문서화되어 있는지
- 직접 self-host하면 이 검증 로직이 어디 있는지 (gotrue 소스)
- 참고: [Supabase Auth — Social Login Providers](https://supabase.com/docs/guides/auth/social-login)

### 3. 카카오/구글이 키를 여러 종류로 쪼개놓은 이유

- Native App 키와 JavaScript 키를 분리하는 보안적 이유
- 키별로 허용하는 origin / redirect 정책이 어떻게 다른지
- 한 앱이 모바일+웹 양쪽을 지원할 때 키 관리 베스트 프랙티스

### 4. PKCE와 모바일 OAuth

- 모바일 앱처럼 client_secret을 안전하게 보관할 수 없는 환경에서 PKCE가 어떻게 보안을 보강하는지
- Supabase Auth가 PKCE를 어떻게 처리하는지 (자동? 수동 옵션?)

### 5. 같은 사용자가 여러 provider로 로그인하면 어떻게 되나

- 카카오로 한 번, 구글로 또 한 번 가입하면 Supabase auth.users에 별도 레코드가 생기는가, 같은 계정으로 묶이는가
- 이메일이 같을 때 자동 머지 정책

> ※ "메모/계획"에 적어둔 "구글 로그인을 했더니 카카오 로그인 했을 때의 데이터가 뜬다"는 이 5번과 직접 닿아있는 현상으로 보인다. 이메일 기반 자동 머지 또는 user metadata 처리 방식이 의심됨. 더 파보고 결과 나오면 별도 글로.

## 회고

체크리스트만 따라 했을 때 잘 안 되는 게 흔하다는 걸 다시 체감했다. 에러 메시지(`Unacceptable audience in id_token`)가 사실은 정확한 단서를 주고 있었는데, OIDC `aud` 클레임 개념을 몰라서 redirect URI 쪽만 파고 있었다. **모르는 단어가 메시지에 있으면 그걸 먼저 검색하자.** 다음에 같은 실수 안 하기 위한 메모.
