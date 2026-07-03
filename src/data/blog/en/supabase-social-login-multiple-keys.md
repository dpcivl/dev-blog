---
title: "Two Traps I Hit While Adding Kakao and Google Login to Supabase"
description: "id_token audience validation failures and missing redirect URIs. Both are traps that rarely show up in the official docs, so I'm recording how I ran into them and solved them myself."
pubDatetime: 2026-05-06T09:00:00Z
tags:
  - supabase
  - 인증
  - 트러블슈팅
  - oauth
draft: false
featured: false
---

While building a solo app with Supabase as the backend, I worked on adding social login (Kakao and Google). Both seemed like they'd just work if I followed the official docs, but in practice I got stuck for quite a while. Here's a record of the two traps and how I fixed them.

## Table of contents

## The situation — "I set everything up, so why isn't this working?"

I'd checked every box.

- Registered the app in the Kakao Developer Console ✓
- Issued API keys (REST API / JavaScript / Native App, all of them) ✓
- Registered the Redirect URI ✓
- Configured the Auth Provider on the Supabase side ✓ (Kakao enabled, REST API Key entered)

But when I tried Kakao login in the app, I got the following error.

```
[AuthService] Kakao signIn error: AuthApiException(
  message: Unacceptable audience in id_token: [REDACTED_KEY_32CHARS],
  statusCode: 400,
  code: null
)
```

> The actual message contains the 32-character hex app key issued by Kakao, in the clear. I've masked it above.

**`Unacceptable audience in id_token`** — a message I'd never seen before.

## Trap 1 — the `aud` (audience) in the id_token doesn't match

My first intuition was that this was a redirect URI problem. I tried changing the redirect URI on the **JavaScript** side of the Kakao Developer Console in various ways, but nothing changed.

Next hypothesis: "Since I entered the REST API key in Supabase, shouldn't the client also use the REST API approach?" → I changed the code to match. Still the same error.

I was stuck here for a while, until I discovered that **the 'REST API Key' field in the Supabase Auth settings screen can actually accept multiple values**, and tried it.

> I put the REST API key, JavaScript key, and Native App key issued by Kakao all into the same field, **separated by commas** (no spaces).
>
> Login worked immediately.

```
# Supabase → Auth → Providers → Kakao → "REST API Key" field
abcd1234efgh5678ijkl,9876mnop5432qrst,xyz0123abc4567def
```

I applied the same approach to Google. Putting **both the app (Android/iOS) OAuth Client ID and the web OAuth Client ID, comma-separated**, solved the same problem.

### Why it works this way (my interpretation)

The `id_token` is a JWT defined by the OAuth/OIDC standard, and it contains an `aud` (audience) claim. This claim indicates "which client (app) this token was issued for."

The problem is that the `aud` value issued by Kakao/Google **differs depending on which SDK/platform was used to log in**.

- User logs in via native SDK on a mobile app → `aud` is the **Native App key**
- Login via JS SDK on web/JS → `aud` is the **JavaScript key**
- Login via REST call from the backend → `aud` is the **REST API key**

Supabase validates whether the `aud` value in the received `id_token` matches the key it has registered. If you've only registered one key, tokens from users who logged in via a different platform get **rejected because the `aud` doesn't match**. That was the true nature of the `Unacceptable audience` error.

If you enter all the keys separated by commas, then no matter which platform a user comes in from, the `aud` matches one of the entries in that list and passes. Looking back at the Supabase settings screen, there was a small hint that this is an **officially supported format**, not a workaround (I had missed it).

## Trap 2 — missing `/auth/v1/callback` in the Redirect URI

After fixing the audience issue, I ran into a different problem: login itself succeeded, but the app **wouldn't return** afterward. The OAuth provider redirects back to the redirect URI after authentication, but it felt like the response wasn't reaching that URI.

The cause: the Redirect URI I'd registered in the Kakao Developer Console was simply in the form `http://localhost:54321`. You need to append the **`/auth/v1/callback`** path to it.

```
# Incorrectly registered form (response not received)
http://localhost:54321

# Correct form (Supabase Auth callback path)
http://localhost:54321/auth/v1/callback
```

`/auth/v1/callback` is Supabase's standard OAuth callback endpoint. The OAuth provider (Kakao/Google) needs to redirect the user to exactly this path for Supabase to pick up and process the flow.

In a production environment, you'd register it the same way as `https://<project>.supabase.co/auth/v1/callback`. For local development, it's the port your local Supabase instance is running on (usually `54321`) plus `/auth/v1/callback`.

## Summary

The order in which I suspected things, when everything on the checklist was done but it still didn't work.

| Suspicion | Result |
|---|---|
| Redirect URI format (host/port) | Partial — host/port were correct, but the path was missing |
| Client SDK type (REST vs JS) | Irrelevant. The key type matters, not the SDK type |
| Thought only one key from the Kakao console would be needed | Wrong. **All keys need to be registered, comma-separated**, to be safe |
| Supabase-side callback path | Correct. The cause was the **missing `/auth/v1/callback`** |

The two key takeaways.

1. **In the Supabase social login settings, the key field is a comma-separated list.** For Kakao, include the REST API, JS, and Native keys. For Google, include both the web and app OAuth Client IDs.
2. **The Redirect URI registered with the OAuth provider must include the `/auth/v1/callback` path.**

## Things to study further

### 1. OIDC and the structure of `id_token`

- What exactly `id_token` is (vs. `access_token`)
- JWT claims — the meaning of `iss`, `sub`, `aud`, `exp`, `iat`
- Why `aud` validation is enforced strictly (what attacks become possible without it — token confused deputy / replay)
- Reference: [OpenID Connect Core 1.0 — id_token](https://openid.net/specs/openid-connect-core-1_0.html#IDToken)

### 2. How Supabase Auth works internally

- The flow by which Supabase receives and validates tokens when an OAuth provider is configured
- Where the fact that the "REST API Key" field accepts comma-separated values is actually documented
- Where this validation logic lives if you self-host (in the gotrue source)
- Reference: [Supabase Auth — Social Login Providers](https://supabase.com/docs/guides/auth/social-login)

### 3. Why Kakao/Google split keys into multiple types

- The security reasoning behind separating the Native App key from the JavaScript key
- How the allowed origin / redirect policy differs by key type
- Best practices for key management when a single app supports both mobile and web

### 4. PKCE and mobile OAuth

- How PKCE strengthens security in environments like mobile apps, where a client_secret can't be safely stored
- How Supabase Auth handles PKCE (automatic? manual option?)

### 5. What happens when the same user logs in via multiple providers

- If a user signs up once via Kakao and once via Google, does Supabase's auth.users create separate records, or are they merged into the same account?
- The auto-merge policy when emails match

> ※ The note I'd jotted down earlier — "after logging in with Google, the data from my Kakao login shows up" — appears to be directly related to item 5 above. I suspect it's either email-based auto-merging or how user metadata is handled. I'll dig into this further and write a separate post once I have results.

## Retrospective

I was reminded once again that just following a checklist often isn't enough. The error message (`Unacceptable audience in id_token`) was actually giving me the exact clue I needed, but because I didn't know the OIDC `aud` claim concept, I kept digging into the redirect URI instead. **If there's an unfamiliar term in an error message, search for that first.** Noting this down so I don't make the same mistake again.