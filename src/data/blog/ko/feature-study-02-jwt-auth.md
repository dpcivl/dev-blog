---
title: "기능별 공부 #2 — JWT 인증: 서버가 기억하지 않는 출입증"
description: "세션 방식의 약점(서버가 세션을 다 기억해야 함)을 JWT는 어떻게 푸는가. 토큰 자체에 정보를 담는 구조(헤더·페이로드·서명), 페이로드가 암호화가 아니라 그냥 base64라는 함정, jjwt로 토큰을 만들고 검증하는 코드, 그리고 JWT가 새로 만드는 문제(취소 불가)까지."
pubDatetime: 2026-08-04T14:15:00Z
tags:
  - 백엔드공부
  - 인증
  - jwt
  - spring-security
  - 학습
draft: false
featured: false
---

[기능별 공부 #1 (세션 기반 인증)](/posts/feature-study-01-session-based-auth) 에서, 세션 방식은 **서버가 세션 정보를 다 들고 있어야 한다**는 약점을 봤다. 서버 메모리 부담이 크고, 서버가 여러 대면 세션이 어디 있는지가 문제였다. 오늘 배우는 **JWT(JSON Web Token)** 는 그 약점을 정반대 방향에서 푼다.

## Table of contents

## 세션 vs JWT — 누가 기억하나

두 방식의 차이는 한 줄로 갈린다.

- **세션** — 서버가 "세션ID → 김철수"를 **기억한다.** 사용자는 번호표(세션ID)만 들고 다닌다.
- **JWT** — **토큰 자체에 정보를 담는다.** 서버는 아무것도 기억하지 않고, 들어온 토큰이 **진짜 내가 발급한 것인지 검증만** 한다.

서버가 기억하지 않아도 되니 [#1에서 본 세션의 약점](/posts/feature-study-01-session-based-auth)이 풀린다.

- **메모리 부담** — 서버가 세션을 안 들고 있으니 없다.
- **서버 여러 대** — 어느 서버로 요청이 가든 **토큰만 검증**하면 되니 문제가 안 생긴다.

<img src="/assets/mermaid/3d959c5df7b86ae2.svg" alt="세션과 JWT 의 차이 — 세션은 서버가 세션 저장소에 사용자 정보를 기억하고 사용자는 번호표만 들고 다니지만, JWT 는 토큰 자체에 정보를 담아 서버는 아무것도 저장하지 않고 서명 검증만 한다" style="max-width:100%;height:auto;" />

## JWT 구조 — 헤더 · 페이로드 · 서명

JWT는 점(`.`)으로 나뉜 세 부분으로 되어 있다.

![JWT 구조 — 헤더.페이로드.서명 세 부분이 점으로 구분된 예시](/assets/posts/feature-study-02-jwt-auth/01-jwt-structure.webp)

- **헤더(Header)** — 토큰 타입과 **어떤 알고리즘으로 서명했는지**를 알려준다. (예: `{"alg":"HS256"}`)
- **페이로드(Payload)** — 실제 담긴 정보. (예: `{"sub":"user1","role":"USER"}`)
- **서명(Signature)** — 헤더+페이로드를 **서버만 아는 비밀키로 서명(HMAC)한 값.** 이 토큰이 서버가 발급한 게 맞는지를 검증해준다.

## ⚠️ 페이로드는 '암호화'가 아니다

여기서 제일 조심해야 할 지점. **서명은 '암호화'가 아니라 '서명'이다.** 즉 페이로드는 숨겨지지 않는다.

페이로드는 암호화된 게 아니라 **단순히 base64로 인코딩**된 값이다. base64는 누구나 되돌릴 수 있는 인코딩이라, 토큰을 손에 넣은 사람은 **페이로드를 그냥 뜯어볼 수 있다.** 위 그림의 페이로드 `eyJzdWIiOiJ1c2VyMSIsInJvbGUiOiJVU0VSIn0` 도 디코딩하면 그대로 `{"sub":"user1","role":"USER"}` 가 나온다.

그러면 서명은 뭘 하나? **내용을 숨기는 게 아니라, 내용이 위조되지 않았음을 보장**한다. 누가 페이로드를 고치면 서명이 안 맞아 검증에서 걸린다. 읽는 건 되지만 **바꾸는 건 안 되는** 것이다.

> 그래서 **비밀번호·개인정보 같은 민감정보를 페이로드에 실으면 절대 안 된다.** 숨겨지는 게 아니니까.

## 스프링에서 — jjwt 라이브러리

JWT는 Spring Security에 기본 내장돼 있지 않다. 별도 라이브러리를 쓰는데, 가장 많이 쓰는 게 **jjwt**다.

```groovy
implementation 'io.jsonwebtoken:jjwt-api:0.12.6'
runtimeOnly 'io.jsonwebtoken:jjwt-impl:0.12.6'
runtimeOnly 'io.jsonwebtoken:jjwt-jackson:0.12.6'
```

토큰을 만들고 검증하는 코드는 이렇게 생겼다.

```java
@Component
public class JwtProvider {

    // 서버만 아는 비밀키 (실무에선 환경변수로 관리!)
    private final SecretKey key = Keys.hmacShaKeyFor(
        "my-super-secret-key-that-is-long-enough-32bytes!".getBytes()
    );

    private final long EXPIRATION = 1000 * 60 * 30;  // 30분

    // 토큰 생성 (로그인 성공 시)
    public String createToken(String username, String role) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + EXPIRATION);

        return Jwts.builder()
                .subject(username)           // sub 클레임
                .claim("role", role)         // 커스텀 클레임
                .issuedAt(now)               // 발급 시각
                .expiration(expiry)          // 만료 시각
                .signWith(key)               // 비밀키로 서명
                .compact();                  // 문자열로 완성
    }

    // 토큰 검증 (매 요청마다)
    public String validateAndGetUsername(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key)             // 서명 검증
                .build()
                .parseSignedClaims(token)
                .getPayload();
        return claims.getSubject();          // 검증 통과하면 사용자 반환
    }
}
```

- `createToken` — 로그인 성공 시 호출해서 사용자에게 토큰을 돌려준다. 이게 출입증이 된다.
- `validateAndGetUsername` — 매 요청마다 호출해서 승인된 토큰인지 확인한다.

## key 관리와 Bearer 관례

`key` 값이 이 방식의 심장이다. **이게 유출되면 누구나 가짜 토큰을 만들 수 있다** (서명 검증을 통과하는 위조 토큰). 그래서 비밀키는 코드에 박지 않고 **환경변수나 안전한 저장소**로 관리한다. (위 코드의 문자열 키는 설명용 예시일 뿐이다.)

그리고 토큰을 실어 보낼 때 헤더에서 `Authorization: Bearer eyJh...` 같은 걸 자주 본다. 여기서 **`Bearer`는 "이 토큰을 가진 자(bearer)를 인증하라"는 관례적 표현**이다.

## JWT가 새로 만드는 문제 — 취소가 안 된다

JWT는 세션의 문제를 풀지만, **대신 새 문제가 생긴다.**

서버가 아무것도 기억하지 않는다는 건, 뒤집으면 **한 번 발급한 토큰을 취소할 방법이 없다**는 뜻이다. 해커가 토큰을 훔쳐도 **무효화할 수단이 없다.** 만료 시각 전까지는 그 토큰이 계속 유효하다.

그렇다고 만료 시간을 아주 짧게 잡으면? 이번엔 사용자가 **짧은 주기로 계속 재인증**해야 해서 불편해진다. "보안(짧은 만료) ↔ 편의(긴 만료)"의 맞교환이다.

이 두 마리 토끼를 잡으려는 게 **리프레시 토큰**이다. (짧은 access token + 긴 refresh token 조합인데, 이건 따로 파볼 주제로 남겨둔다.)

## 회고

[#1(세션)](/posts/feature-study-01-session-based-auth)과 나란히 놓고 보니 구도가 선명하다. **세션은 서버가 기억하고, JWT는 서버가 기억하지 않는다.** 그리고 각자 그 선택의 대가를 치른다 — 세션은 기억하는 부담을, JWT는 취소하지 못하는 위험을.

"어느 게 더 좋다"가 아니라, **무엇을 서버가 들고 있을지에 대한 트레이드오프**라는 걸 배운 게 오늘의 수확이다.

## 더 공부해볼 것

- **리프레시 토큰** — 짧은 access + 긴 refresh 조합으로 "취소 불가 vs 잦은 재인증"을 어떻게 완화하는지. refresh 토큰은 어디에 저장하고 어떻게 무효화하는지(결국 서버가 조금은 기억하게 되는지).
- **HS256 vs RS256** — 오늘 쓴 건 대칭키(HMAC) 서명이라 발급·검증이 같은 키다. 비대칭키(RS256)는 언제 쓰는지, 서버가 여러 개일 때 검증 키만 나눠주는 구조.
- **표준 클레임** — `sub`·`iat`·`exp` 외에 `iss`·`aud` 같은 등록된 클레임들. 페이로드에 뭘 담는 게 관례인지.
- **토큰을 어디에 싣나** — `Authorization` 헤더 vs 쿠키. 각각 XSS·CSRF 관점에서의 장단.
- **탈취 대응** — 취소가 안 되는 걸 실무에선 어떻게 버티나(블랙리스트, 짧은 만료 + refresh, 로그아웃 처리).
