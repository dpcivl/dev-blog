---
title: "Vocabulary for Vibe Coding: State Management — Client/Server State · Derived · Optimistic · Cache Invalidation"
description: "The 4th and final entry in the vocabulary series. Four core terms to move past the vague instruction 'AI, write me the state management' — Client/Server state separation, Derived state, Optimistic Update, Cache Invalidation + trigger patterns. I've built a separate playground so you can try out the core concepts hands-on."
pubDatetime: 2026-06-21T04:10:00Z
tags:
  - 상태관리
  - 바이브코딩
  - 용어정리
  - 학습
draft: false
featured: false
---

This is the **final** post in the vocabulary series (part 4, following [UI](./ui-vocabulary-for-vibe-coding) / [DB](./db-vocabulary-for-vibe-coding) / [API](./api-vocabulary-for-vibe-coding)). As I wrote in [the study method post](./my-5-step-study-method-for-new-tech) I published earlier today, **I've concluded that while vocabulary review + a playground are useful, actually building something is a better way to learn.** So the series wraps up here. From now on, I'll be writing implementation posts instead.

Today's topic is **state management**.

> 📍 I've built a separate [playground](/playground/state-terms/) at the end of this post where you can try out the core concepts (Client/Server state / Derived / Optimistic Update / Cache Invalidation) hands-on.

## Table of contents

## 1. Client state vs Server state — the first split you need to make

This is the first thing that trips people up when dealing with state. It's easiest to split them by asking: **who "owns" the data?**

### Client state — the app owns it

Pure local/UI state that exists **only inside the app, and that the server doesn't know about**. **Information that's fine to lose on refresh.**

- Dark mode toggle
- Text currently being typed into a form
- Modal open/closed
- Scroll position

No need to sync this with the server.

### Server state — the server (DB) owns it

The real source of truth lives on the server, and **the app just holds a copy (cache) temporarily**. This creates two problems:

1. **Freshness** — the server may have already changed while I'm looking at this
2. **Sync** — how do I push my changes back to the server

- Data fetched via API
- Content created by other users
- Comment / like counts

### Why separate them

**If you don't separate the two, you end up handling server state the same way you handle client state, and sync problems blow up.** This is why "let's just handle everything with one useState" doesn't work.

> That's why in the React ecosystem it's become standard to split things out into separate libraries — **client state with Zustand/Jotai/useState**, **server state with TanStack Query/SWR**.

## 2. Derived state — compute it, don't store it

**A value calculated from other state.**

The most intuitive example: **a total price**.

- Individual items → **source state** (needs to be stored)
- Total price → **derived state** (just needs to be computed)

Since individual items can change at any time, **derived state doesn't need to be stored.** **Store only the source, and compute the derived value on the fly.**

The problem with storing it — **the source changes but the derived value doesn't, so the two drift apart.** Bugs like this are hard to debug. That's the reasoning behind the "**single source of truth**" principle: **the source lives in exactly one place.**

## 3. Optimistic Update — show it as if it already succeeded

> After sending a request, **update the screen right away as if it already succeeded**, without waiting for the server's response. If it fails, roll it back.

This is the same mindset as **optimistic locking**, which I covered in [the DB post](./db-vocabulary-for-vibe-coding) — assuming "it'll probably work out."

### Why?

**It makes the app feel faster.** There's no need to wait for the server's response — just show the user's action immediately.

A classic example — **the like feature on social media**:

1. The user taps the heart icon
2. The UI **immediately** fills in the heart
3. In the background, a request goes to the server
4. On success → nothing changes
5. On failure → the heart empties again (rollback)

Even if the server is slow or fails, the user feels like "it responded instantly."

### The core idea

**Update the UI immediately, then roll back to the previous state if the server interaction later fails.**

## 4. Cache Invalidation — deciding when to fetch again

Earlier I said **the app holds a copy**. Cache invalidation is deciding that this copy has gotten too stale, and **fetching it again**.

### Trade-off

- **Fetch too often** → wastes network resources
- **Fetch too rarely** → stale screen

You need to carefully decide "when should I refetch?" This is what **trigger patterns** deal with.

### The 4 trigger patterns

| Pattern | Timing | Example |
|---|---|---|
| **Event-based** | Invalidate after a specific action | POST a new post → invalidate the post list cache → refetch |
| **Time-based** | Refresh after N seconds/minutes | Auto-refresh on sites like Withmyu |
| **Focus/re-entry** | Refresh when the app is reopened | Fetch when a tab becomes active again |
| **Manual** | User hits a refresh button | Pull-to-refresh |

### Combining optimistic updates + invalidation — "instant response + eventual consistency"

Using both together works like this:

1. **Optimistic update** changes the UI instantly
2. Once the server request finishes, **invalidate the relevant cache**
3. Sync up with the actual state held by the server

This gives you fast perceived speed, while eventually reaching consistency.

### Choosing a trigger — based on "how real-time it needs to be"

When deciding on a trigger pattern, base it on **how fresh you think the data needs to be**:

- **Needs to be real-time** → event-based, invalidate frequently
- **Occasional staleness is fine** → time-based, invalidate on re-entry

## Retrospective

Today's material is actually something I studied on my phone yesterday, and going over it again, **thinking through examples as I studied made it click immediately** (like: SNS likes = optimistic / total price = derived / dark mode = client / API = server).

That's it for the vocabulary series. **From here on, I'm shifting to posts focused on actual implementation, gaps in my knowledge, and new technologies.**

## Further study

### 1. State management libraries — split by Client / Server

- **Client state** (React): Zustand, Jotai, Redux (Toolkit), Recoil, useReducer
- **Server state** (React): TanStack Query (React Query), SWR, Apollo, RTK Query
- Vue: Pinia (client) + TanStack Query (server)
- Svelte: its own store + TanStack Query
- I covered "why separate the two" above — figuring out **which combination fits your own project** is the next task

### 2. SWR — the Stale-While-Revalidate pattern

- **Show** the cached (stale) data first, and fetch fresh data in the background in the meantime
- The user sees a result immediately, and it auto-updates once new data arrives
- This is where the name of Vercel's SWR library comes from
- It's also a standard HTTP `Cache-Control: stale-while-revalidate` header

### 3. CRDT — distributed state for collaborative apps

- How collaborative apps like Notion, Figma, and Linear handle simultaneous editing without conflicts
- **Conflict-free Replicated Data Types** — even when multiple people edit the same data at once, it eventually converges to the same state
- Libraries like Yjs, Automerge
- A different dimension of state management from ordinary CRUD

### 4. UX for failure handling in optimistic UI

- Simply rolling back leaves the user confused: "wait, what did I just do?"
- Patterns like toast notifications / banners / retry buttons / undo options
- Twitter's UX for failed tweets and Slack's UX for failed message sends are worth studying as references
- Optimistic UI needs **clear failure notification** designed alongside the benefit of instant response

### 5. Normalized cache

- The problem of **duplicate storage** when the same resource (e.g., user_42) appears in multiple API responses
- Libraries like Apollo, RTK Query, and Relay do **normalization by id** — store it in one place and reference it
- TanStack Query doesn't normalize (each query key has its own separate cache) — a trade-off between the two approaches
- A key decision when designing the cache structure for a serious SPA