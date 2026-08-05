---
title: "App-in-Toss Real Device Testing Doesn't Work (Unresolved) — And Claude Controlling My Phone"
description: "I started the August vibe coding challenge and tried App-in-Toss real device testing with a Galaxy Flip4, but it just failed with 'A problem occurred while running the app.' I checked WiFi, logs, and TCP settings but couldn't solve it. Instead, I'm leaving down some thoughts on watching Claude debug by looking at and controlling the phone directly."
pubDatetime: 2026-08-05T01:25:00Z
tags:
  - 트러블슈팅
  - 앱인토스
  - 바이브코딩
  - 회고
  - AI
draft: false
featured: false
---

> ⚠️ This post is an **unresolved** record. I never managed to get App-in-Toss real device testing working. It's not a "how I solved it" post — it's a record of where I got stuck and what I thought about along the way.

I started the August vibe coding challenge. To do real device testing going forward, I connected my MacBook to a Galaxy Flip4.

## The app won't launch — "A problem occurred while running the app"

When I ran the app in the App-in-Toss sandbox, only this window showed up, and it failed.

![Error modal shown when running App-in-Toss on a real device — "A problem occurred while running the app. Please contact the App-in-Toss developer community."](/assets/posts/app-in-toss-device-test-fails-unresolved/01-app-error-dialog.webp)

"A problem occurred while running the app. Please contact the App-in-Toss developer community." — That's all it says, with no explanation of why.

## Things I tried — all failed

- **Matched the same WiFi network** and tried again. → Failed
- **Dug through the logs and changed TCP-related settings.** → Failed
- **Searched the App-in-Toss developer community** for similar cases. → Found **only questions describing the same symptom, no answers with a solution.**

In the end, I couldn't get real device testing to work on the sandbox. That's why I put **unresolved** right in the title. For whoever solves this later (maybe future me), I'm leaving the clues I found in the crash logs in the "Things to dig into further" section below.

## What surprised me — Claude looking at the phone screen and controlling the app

I couldn't solve the problem itself, but something surprised me during the debugging process. With the phone connected, **Claude looked directly at the phone screen and controlled the app** while debugging.

![Claude collecting crash logs and debugging by directly checking the phone screen](/assets/posts/app-in-toss-device-test-fails-unresolved/02-claude-debugging-phone.webp)

It collected the crash stack, said "logs alone aren't enough," **captured the phone screen directly**, and narrowed down the exception by turning the app off and on. It even pointed out that `GraniteActivity` was destroyed right after it launched, and that the name `appsInTossSignTossCert` appeared in the stack. (Still, it never got to the root cause.)

## What remains in the age of AI — experience and the ability to define problems

Going through this whole ordeal, one thing became clear to me. In an age where AI does this much, the value that remains for a person seems to come down to two things: **experience** and **the ability to define problems**. (In [my last post](/en/posts/what-i-learned-building-with-ai-lately), I talked about "the sense of choosing rather than just accepting what AI gives you" — this is an extension of that idea.)

### Experience

Solving something that's stuck is well within what an LLM can do. The problem is **time gets burned trying this and that**. Today was exactly like that — Claude dug through logs, looked at the phone, tried all sorts of things, and still couldn't solve it. That process took a fair amount of time.

Also, LLMs tend to reach for **the most commonly used method** rather than **the best method** from the start. So someone who **knows from experience** that "in this situation, this is the best approach" can move faster with the same tool (an LLM), even without changing anything else.

### The ability to define problems

Faced with the exact same problem, some people **only describe the surface-level symptoms**, while others **think through toward a direction for the solution**. The latter can give an LLM clearer instructions, and they build up **muscle memory** for how to debug in similar situations. "The app won't launch" and "GraniteActivity dies right after it launches, and I suspect it's something with TCP or the certificate" give you very different degrees of control over an LLM.

Ultimately, the more AI takes over execution, the more valuable **the side that decides what to ask for** becomes. Even on a day like today, when I couldn't solve the problem, that much became clear.

## Things to dig into further

- **What is `appsInTossSignTossCert`** — This name showed up in the crash stack. I suspect it's the **certificate signing (sign cert) step** for App-in-Toss, but I need to check why this breaks on a sandbox real device. (This is a guess and needs verification.)
- **`GraniteActivity` being destroyed immediately** — The pattern where the activity dies right after launching. Granite appears to be a Toss-side framework, and "finishes right after launching" usually points to a failure at entry-point validation (permissions, environment, or authentication). Need to reproduce and check logs in that direction.
- **App-in-Toss sandbox network requirements** — Since it failed even on the same WiFi, it might not just be a same-network issue — there could be conditions around ports, proxies, or certificate trust. Worth going back to the official documentation's prerequisites for real device testing.
- **Why the TCP setting change had no effect** — What I changed might have been unrelated to begin with. I should record what I changed and why it didn't work, so I can rule it out next time.