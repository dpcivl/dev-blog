---
title: "API Design Vocabulary for Vibe Coding — REST, Status Codes, Idempotency, Pagination, Authentication/Authorization"
description: "Part 3 of the terminology series. After creating DB tables, how do you expose those resources to the outside world? 5 core vocabulary terms to escape the vague instruction 'build me an API' — REST, status codes, idempotency, pagination, authentication/authorization — plus bonus CORS. I set up a separate playground where you can try out the core concepts hands-on."
pubDatetime: 2026-06-19T11:30:00Z
tags:
  - API
  - 바이브코딩
  - 용어정리
  - 학습
draft: false
featured: false
---

**Part 3 of the terminology series**, following [DB Vocabulary](./db-vocabulary-for-vibe-coding). Last time, I looked at **how tables get created** through the DB. This post's topic, API, covers **how those tables get exposed to the outside world** — apps, browsers, and so on.

> 📍 I built a separate [playground](/playground/api-terms/) at the end of the post where you can try out the core concepts (REST / status codes / idempotency / pagination / authentication/authorization) hands-on.

## Table of contents

## The 5 Questions of API Design

When designing an API, the questions we need to answer really boil down to 5 + 1.

| | Question | Vocabulary |
|---|---|---|
| 1 | What shape do you expose the resource in | **REST** |
| 2 | How do you communicate the result | **Status codes** |
| 3 | Is it safe if the same request comes again | **Idempotency** |
| 4 | How do you split up large amounts of data | **Pagination** |
| 5 | Who can do what | **Authentication/Authorization** |
| + | When browsers block cross-domain requests | **CORS** (bonus) |

Let me go through each one and see where the confusion clears up.

## 1. REST

**In one line**, a REST API is:

> **Pointing to a resource with a URL, and expressing the action to perform on that resource with an HTTP method.**

That sounds hard, but it's easy once you see examples.

| HTTP Method + URL | Meaning |
|---|---|
| `GET /orders` | List of orders |
| `GET /orders/42` | Look up one order |
| `POST /orders` | Create an order |
| `PATCH /orders/42` | Update an order |
| `DELETE /orders/42` | Delete an order |

The key is separating **the resource name (`/orders/42`), which is a noun**, from **the action, which is the HTTP method (`GET`, `POST`, ...)**.

### Stateless — the server doesn't remember state

Another characteristic of REST is that it's **stateless**.

- The server doesn't remember the previous request.
- Every request is handled **independently**.
- So **you have to identify "who you are" with a token on every single request.**

This is the point that connects to **authentication/authorization**, which comes up later.

### The Supabase case — PostgREST auto-generates it

[Supabase](https://supabase.com) uses a tool called PostgREST, so **a REST API gets automatically generated the moment you create a table.**

Create a table called `orders`, and an address like `/rest/v1/orders` opens up automatically. Sending requests directly to that URL is cumbersome, so Supabase provides an **SDK**.

```js
const { data, error } = await supabase
  .from('orders')
  .select('*')
  .eq('user_id', userId);
```

Internally, this is just a REST call like `GET /rest/v1/orders?user_id=eq.<id>`.

**The problem arises when there are multiple steps.** **Complex, sensitive logic** that needs to run on the server can't be handled by auto-generated REST alone. You need to write a function yourself. That's the **Edge Function**.

> I covered Supabase Edge Functions separately in [this post](./what-is-deno-and-supabase-edge-functions).

## 2. Status Codes

A **3-digit number** that tells you what happened to a request. These numbers also showed up in the retry logic in yesterday's [error handling post](./claude-api-error-handling-and-retry). **Each range has a fixed meaning.**

| Range | Meaning | Representative codes |
|---|---|---|
| **2xx** | Success | `200` OK, `201` Created, `204` No Content |
| **4xx** | Client error | `400` Bad request format, `401` Unauthenticated, `403` No permission, `404` Not found, `409` Conflict |
| **5xx** | Server error | `500` Server error, `503` Service unavailable |

Key points:

- **When you get a 4xx, the client (the caller) did something wrong** — retrying doesn't help, you need to fix the calling code
- **When you get a 5xx, it's the server's fault** — if it's temporary, retrying resolves it

## 3. Idempotency

> The property that sending the same request multiple times produces the same result as sending it once.

This is a term borrowed from mathematics, but it's a core concept in API design. **Idempotency is fixed per HTTP method.**

| Method | Idempotent? | Reason |
|---|---|---|
| `GET` | ✅ | Only reads |
| `PUT` | ✅ | Full replacement — replacing with the same content 100 times = replacing once |
| `DELETE` | ✅ | Once deleted, it's done — sending it again finds nothing already there |
| `POST` | ❌ | Creates something new on every call — 2 order calls = 2 orders |

### Why idempotency matters

If a client sends a request but **doesn't get a response, it retries.** (For example, in the case of a temporary network disconnect.) But what happens if you retry a `POST`?

- The order gets submitted twice
- The payment happens twice

**An accident** happens.

### Idempotency Keys

So **non-idempotent operations** like `POST` get an **idempotency key** attached.

1. The client sends a **unique key** along with the request (e.g., a UUID)
2. If the server **has seen that key before, it doesn't re-execute** — it just returns the previous result

Payment APIs like Stripe and Toss enforce this as a standard. If you ask yourself **"would sending this request twice cause a problem?"** and the answer is yes, you need idempotency guarantees.

## 4. Pagination

> **Splitting data into pieces (pages)** instead of sending it all at once.

Receiving 10,000 items at once is a burden for both client and server. So it gets split up. There are two approaches.

### Offset-based — intuitive but has pitfalls

```
GET /orders?limit=20&offset=40
```

This means "give me 20 items starting from item 40." **It's intuitive, but:**

- **It gets slower the further back you go** — for page 100, the DB has to skip past the first 1,980 items before it can return anything
- **If data is added or removed, things shift, causing duplicates/omissions** — if someone adds a new order while you're moving from page 1 to page 2, you might see the same item twice

### Cursor-based — fast and stable, but no jumping

```
GET /orders?limit=20&cursor=order_42_at_2026-06-18T13:00:00Z
```

This means "give me 20 items starting after this cursor." **The last ID/timestamp from the previous page gets passed to the next request.**

- **Fast** — the DB can jump straight to the starting point using an index
- **Stable even when data changes** — since the cursor reference point is fixed, new data coming in doesn't shift anything
- **Downside**: you can't jump to an arbitrary page (no "go to page 100")

> Infinite scroll (like Twitter, Instagram) is almost always cursor-based. Page-number UIs (1, 2, 3...) are offset-based.

## 5. Authentication / Authorization

These are often confused, but they're **different concepts**.

| | Authentication | Authorization |
|---|---|---|
| Abbreviation | AuthN | AuthZ |
| Question | **"Who?"** | **"What can you do?"** |
| What's verified | Identity | Permission |
| Status code on failure | **401** Unauthorized | **403** Forbidden |

### Authentication — the JWT token flow

Since REST is stateless, you have to tell the server who you are on every request.

1. **Log in** → the server issues a JWT token
2. Attach the token to **every subsequent request's header**
   ```
   Authorization: Bearer eyJhbGciOiJI...
   ```
3. The server validates the token to confirm "who" you are

### Authorization — ownership / roles

- **Ownership-based**: "This order belongs to user_42, so only user_42 can modify it"
- **Role-based (RBAC)**: "If you have the admin role, you can view all orders"

Matching against status codes matters:

- **401** — the token is missing or invalid = **authentication failure**
- **403** — the token is valid but there's no permission = **authorization failure**

## Bonus: CORS (Cross-Origin Resource Sharing)

For security, browsers **block requests to a different origin.** This is called the **Same-Origin Policy**.

> Origin = `protocol + domain + port`. If even one of these differs, it's a "different origin."

So that means you can't call `https://api.my-app.com` from `https://my-app.com` — the domains differ. **CORS** emerged to address this — **a mechanism that allows different origins when it's safe to do so.**

### Who grants permission — the server

CORS permission is **something the server communicates via a response header.**

```
Access-Control-Allow-Origin: https://my-app.com
```

The browser checks whether this header is present in the response, and if so, passes the response along to the client code. If not, it blocks it.

### Preflight — asking in advance

For requests that could be risky (e.g., a POST with a body, custom headers, etc.), the browser sends **a preliminary OPTIONS request before the actual request**, asking "is it OK to send this?" Only if the server says OK does the actual request get sent.

This is called a **preflight**. When you're developing and wondering "why are two OPTIONS requests going out?" — this is the pattern behind it.

## Retrospective

Moving through the DB → API flow, I get a clearer picture of the big picture: **"how do you define a resource, and how do you expose it externally?"** Before, when I heard "API," it was vague — something like "a function call, sort of." Now I see it as:

- Pointing to a resource with a URL (REST)
- Communicating the result with a number (status codes)
- Making it safe even if the same request arrives twice (idempotency)
- Splitting up data before sending it (pagination)
- Confirming who you are / what you can do (authentication/authorization)
- Passing the browser's security policy (CORS)

**I can see that these 6 things are woven together into a single thread.**

I think I can also use these 6 as a checklist when reviewing the output after telling an AI "build me an API." **Once your vocabulary is solid, your review ability becomes solid along with it.**

## Further Study

### 1. GraphQL — a different path than REST

- If REST is "resource-centric," **GraphQL is "query-centric"**
- Clients pick only the fields they need (solving over-fetching/under-fetching)
- Downsides: caching is difficult, and the learning curve is steep
- The criteria for when to use REST vs. GraphQL
- [GraphQL official site](https://graphql.org/)

### 2. tRPC — TypeScript's answer

- An RPC used in full-stack TypeScript environments instead of REST/GraphQL
- Clients call server functions in a **type-safe** way (type inference without schema definitions)
- Often used together with Next.js
- [tRPC official site](https://trpc.io/)

### 3. OpenAPI / Swagger — the API documentation standard

- Defines all of an API's endpoints/requests/responses **as a schema**
- Schema → automatic documentation, automatic client SDK generation
- Effectively the standard in team settings
- [OpenAPI Specification](https://swagger.io/specification/)

### 4. JWT's weaknesses + alternatives

- Once issued, a JWT **can't be invalidated until it expires** (dangerous if stolen)
- Short-lived access token + refresh token pattern
- The revival of **session-based authentication** (Lucia, Auth.js, etc.)
- The trade-off between HttpOnly cookies vs. bearer headers

### 5. Rate limiting — defending against DoS and cost overruns

- Blocking a client that calls too frequently
- **Token bucket / leaky bucket / sliding window** algorithms
- Status code **429 Too Many Requests** and the `Retry-After` header
- Commonly implemented in API gateways (Kong, Tyk, AWS API Gateway)