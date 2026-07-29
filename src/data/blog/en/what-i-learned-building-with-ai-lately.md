---
title: "Things I Built While Taking a Break from Blogging — 3 Lessons from Developing with AI"
description: "My most recent post was 9 days ago. In that time, I built things like stock monitoring, a pottery reservation system, and a free-form practice pad. I organize three lessons learned from building these — verify feasibility before starting, watch for alternatives AI is so good it makes you miss, and request multiple options for areas where you're weak."
pubDatetime: 2026-07-29T02:40:00Z
tags:
  - 회고
  - AI
  - 바이브코딩
  - 개발
draft: false
featured: false
---

I've taken way too long a break from blogging. My most recent post was 9 days ago (July 20), but even though I wasn't writing, I kept working on projects the whole time.

Things I built in that period:

- **Monitoring for stock price surges and crashes based on search volume increases**
- **A pottery craft class reservation system, built around a hypothetical freelance scenario**
- **A free-form practice pad where you can attach images and leave text without saving**

Of these, the stock monitoring project is the one I saw through to completion, and I'm currently building the pottery craft class reservation system. Building several different things gave me a few realizations, which I want to write down here.

## Table of contents

## 1. Verify "feasibility" before you start

When sketching out a project overview, I'd often decide "let's build this with that approach" — but then hit a wall once I actually tried to implement it.

- Sometimes there's an unexpected **cost** I have to pay
- Sometimes it's bad for **scalability**
- Sometimes it **doesn't reflect up-to-date information**, so I have to go back and check again later

I realized that if I decide early on "let's do it this way," it's important to **verify at that point** whether the approach will actually work. Hitting a wall later and having to redo everything from scratch is far more expensive than spending 5 minutes checking upfront.

## 2. AI is so good — it makes you miss alternatives and trade-offs

When implementing a feature, I usually think about "what approach could this be built with" first, then ask AI. But AI has gotten really good lately. It used to lie and write bad code, so there was at least some fun in debugging. These days, if I just hand it over, it implements everything on its own.

That convenience creates a trap. I've started to just go along with whatever approach AI implements **without considering alternatives**, and as a result, I **rarely weigh trade-offs against other options anymore.**

I paid the price for this while building the stock monitoring project. I pulled stock data using `pykrx`, just because "it's widely used in Python examples" — and then ran into **rate-limit issues** and a lack of proper API documentation. It turned out there was an official open API provided by KRX. I think this happened because **I didn't look into multiple alternatives beforehand.** The first approach AI suggested wasn't necessarily the best one.

## 3. Request multiple options for areas where I'm weak

On the other hand, I use AI differently in areas where I'm weak. My approach there is to **get several options at once and choose among them.**

I really have no sense of design. So even when I want to change the UI, it's hard to explain in words, and even trying to copy-paste a reference to explain what I mean can be a struggle just to find the reference itself. What I've been doing lately is **asking Claude to propose several design drafts.** That gives me multiple designs with different concepts, and I pick one and refine it from there.

The same goes not just for design, but for **areas without an objectively clear-cut answer** — things like writing copy. I get several options and choose from them, or take an idea from them and adapt it. In areas where there isn't a single correct answer, laying out several options and choosing among them works better for me than getting just one answer.

## Wrapping up — where do I find my value in the age of AI

AI performance has really improved lately. So on one hand, I find myself thinking that the value of human labor, including developers, is gradually shrinking. Getting a job is getting harder, and I sometimes feel like I'm not being paid what I'm worth in the job market.

So these days, I've been thinking about **ways I can generate income directly, using methods I'm capable of.** Building the pottery craft class reservation system around a hypothetical freelance scenario is part of preparing to start taking on freelance work through platforms like [Kmong](https://kmong.com). By building something from start to finish as if there were an actual client request, I'm trying to develop the instincts needed for freelance work ahead of time.

If I tie the three lessons together into one line, it comes down to the same thing — **hand things over to AI, but don't lose track of where I need to add my own judgment.** Verifying before starting, comparing alternatives, choosing among several options — all of these are moments of "not just accepting what AI gives you, but choosing once more." I suspect that sense of choosing is probably where I can add my value in the age of AI.

## Things to look into further

- **Properly using the official KRX open API** — the authentication, request format, and rate-limit policy for switching from `pykrx` to the official API. This is something I glossed over this time, so it needs a proper write-up.
- **Building a technical verification checklist** — instead of doing "feasibility verification before starting" by gut feeling every time, turning items like cost, scalability, data freshness, and rate-limits into a fixed checklist. Something to run through once at the project overview stage for the next project.
- **Forcing myself to think of alternatives to AI's first suggestion** — making it a habit to ask "is there another way besides this?" at least once before implementing any single feature. A minimal safeguard against missing trade-offs.