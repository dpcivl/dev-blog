---
title: "Feature-by-Feature Study #2 — JWT Authentication: An Access Pass the Server Doesn't Remember"
description: "How JWT solves the weakness of the session approach (the server having to remember every session). Covers the structure that packs information into the token itself (header, payload, signature), the trap that the payload is just base64, not encryption, code for creating and verifying tokens with jjwt, and the new problem JWT introduces (no revocation)."
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

In [Feature-by-Feature Study #1 (Session-Based Authentication)](/en/posts/feature-study-01-session-based-auth), I looked at the weakness of the session approach: **the server has to hold onto all the session information.** That puts a heavy load on server memory, and when there are multiple servers, figuring out where a session lives becomes a problem. **JWT (JSON Web Token)**, which I'm learning about today, solves that weakness by going in the exact opposite direction.

## Table of contents

## Session vs JWT — Who Remembers What

The difference between the two approaches comes down to one line.

- **Session** — The server **remembers** "session ID → Kim Cheolsu." The user just carries around a number tag (the session ID).
- **JWT** — **The token itself carries the information.** The server doesn't remember anything; it only **verifies whether the incoming token is really one it issued.**

Since the server doesn't need to remember anything, [the session weaknesses covered in #1](/en/posts/feature-study-01-session-based-auth) get resolved.

- **Memory burden** — Gone, since the server isn't holding onto sessions.
- **Multiple servers** — No matter which server the request lands on, it just needs to **verify the token**, so there's no problem.

## JWT Structure — Header · Payload · Signature

A JWT consists of three parts separated by dots (`.`).

![JWT structure — an example showing the three parts, header.payload.signature, separated by dots](/assets/posts/feature-study-02-jwt-auth/01-jwt-structure.webp)

- **Header** — Indicates the token type and **which algorithm was used to sign it.** (e.g., `{"alg":"HS256"}`)
- **Payload** — The actual information carried. (e.g., `{"sub":"user1","role":"USER"}`)
- **Signature** — The value obtained by **signing the header+payload (HMAC) with a secret key that only the server knows.** This verifies that the token was indeed issued by the server.

## ⚠️ The Payload Is Not "Encrypted"

This is the point that requires the most caution. **The signature is a "signature," not "encryption."** In other words, the payload is not hidden.

The payload isn't encrypted — it's **simply encoded in base64.** Since base64 is an encoding anyone can reverse, whoever gets hold of the token **can just read the payload directly.** If you decode the payload `eyJzdWIiOiJ1c2VyMSIsInJvbGUiOiJVU0VSIn0` from the diagram above, you get exactly `{"sub":"user1","role":"USER"}`.

So what does the signature actually do? **It doesn't hide the content — it guarantees the content hasn't been tampered with.** If someone alters the payload, the signature no longer matches, and verification catches it. You **can read it, but you can't change it.**

> That's why **you should never put sensitive information like passwords or personal data in the payload.** It's not hidden.

## In Spring — The jjwt Library

JWT isn't built into Spring Security by default. You use a separate library, and the most commonly used one is **jjwt**.

```groovy
implementation 'io.jsonwebtoken:jjwt-api:0.12.6'
runtimeOnly 'io.jsonwebtoken:jjwt-impl:0.12.6'
runtimeOnly 'io.jsonwebtoken:jjwt-jackson:0.12.6'
```

The code for creating and verifying a token looks like this.

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

- `createToken` — Called on successful login to hand a token back to the user. This becomes the access pass.
- `validateAndGetUsername` — Called on every request to check whether the token is a validly issued one.

## Managing the Key and the Bearer Convention

The `key` value is the heart of this approach. **If it leaks, anyone can create fake tokens** (forged tokens that pass signature verification). That's why the secret key shouldn't be hardcoded — it should be managed via **environment variables or a secure store.** (The string key in the code above is just an example for explanation.)

Also, when sending the token, you often see something like `Authorization: Bearer eyJh...` in the header. Here, **`Bearer` is a conventional term meaning "authenticate whoever holds (bears) this token."**

## The New Problem JWT Creates — No Revocation

JWT solves the session's problem, but **in exchange, it creates a new one.**

The fact that the server doesn't remember anything means, flipped around, that **there's no way to revoke a token once it's issued.** Even if a hacker steals a token, **there's no way to invalidate it.** The token stays valid until its expiration time.

So what if you set the expiration very short? Then the user ends up having to **re-authenticate frequently**, which is inconvenient. It's a trade-off between "security (short expiration)" and "convenience (long expiration)."

**Refresh tokens** are an attempt to get the best of both worlds. (This combines a short-lived access token with a long-lived refresh token — I'll leave that as a topic to dig into separately.)

## Retrospective

Putting this side by side with [#1 (sessions)](/en/posts/feature-study-01-session-based-auth) makes the picture clear. **Sessions mean the server remembers; JWT means the server doesn't.** And each pays a price for that choice — sessions pay with the burden of remembering, JWT pays with the risk of being unable to revoke.

It's not about "which one is better" — the real takeaway from today is understanding that this is **a trade-off about what the server chooses to hold onto.**

## Things to Study Further

- **Refresh tokens** — How combining a short-lived access token with a long-lived refresh token eases the "can't revoke vs. re-authenticate too often" tension. Where refresh tokens are stored and how they get invalidated (and whether that means the server ends up remembering a little after all).
- **HS256 vs RS256** — What I used today is symmetric-key (HMAC) signing, where issuing and verifying use the same key. When to use asymmetric keys (RS256), and the structure where only the verification key gets distributed when there are multiple servers.
- **Standard claims** — Beyond `sub`, `iat`, `exp`, registered claims like `iss` and `aud`. What's conventionally put in the payload.
- **Where to carry the token** — `Authorization` header vs. cookies. The pros and cons of each from an XSS/CSRF perspective.
- **Handling theft** — How this is dealt with in practice given that revocation isn't possible (blacklists, short expiration + refresh, handling logout).