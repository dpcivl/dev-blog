---
title: "Checking demand before writing code — a 4-step validation process for solo developers"
description: "As a solo developer, time is my most expensive resource. To flip the order of 'build first, figure out who uses it later,' I put together a way to check demand before building. From lurking in communities to cold messages, asking about the past instead of the future, and fake door tests."
pubDatetime: 2026-07-20T03:10:00Z
tags:
  - 1인개발
  - 제품
  - 수요검증
  - 회고
  - 학습
draft: false
featured: false
---

As a solo developer, time is my most expensive resource. But when you build things alone, it's easy to leave "who's going to use this after I build it?" as a question for later. That's the wrong order.

If I check demand **before** building, I can scrap the idea much more cheaply. Finding out something doesn't work without writing a single line of code, versus finding out nobody uses it after weeks of building — those are completely different costs. To flip that order around, I'm writing down validation methods that a solo developer can actually use, so I can come back to them later.

## Table of contents

## 1. Go where people are already gathered

You don't need to run some elaborate survey to check demand. Just go to **where people are already gathered and complaining**.

- If you're targeting online sellers, there are Naver cafes for sellers/Smart Store, communities like "It's Hard Because I'm the Boss," and related open chat rooms or Discords.
- Self-employed business owners also have industry-specific cafes and communities.

Join and just lurk for a few days, and you'll naturally see what people are **repeatedly** struggling with. If the same complaint keeps coming up from multiple people, that's already market research. You're finding a problem that actually exists, not one you imagined.

## 2. Ask, don't sell

Reach out briefly to someone in the community who voiced that complaint. The key here is **not trying to sell anything**. If there's any hint that you're trying to sell something, the conversation closes immediately. Your tone needs to be that you want to understand the problem.

> Hi, I'm someone studying development and I saw your post about how hard it is to write product detail pages. Would you mind if I asked you about how you're handling that right now, just for 5 minutes? I'm not trying to sell anything — I just want to understand the problem.

With this tone, you get more responses than you'd expect. Send to 10 people, get 2-3 responses, and that's enough. You don't need everyone to respond in the first place.

## 3. Ask about the past, not the future

When you actually talk to someone, asking the wrong question wastes all the effort you put into reaching out. The most common mistake is **asking about the future**.

"Would you use something like this?" — this question is useless. Everyone says "yes" out of politeness. If you believe that "yes" and build something, you'll get betrayed.

Instead, ask about **past behavior**.

- "How do you handle this right now?"
- "When was the last time this frustrated you?"
- "Have you ever paid for something to solve this?"

If someone has **actually paid money or is spending time on this**, that's real demand. If they only say "that would be nice to have," it's fake. Past behavior tells the truth, not future intentions.

## 4. Run a 'fake door' test before building

Once you've verified it verbally, validate once more without writing any code. This is the **fake door test**.

Don't write a single line of code — just make a landing page. Put up "This service is coming soon. Leave your email if you're interested." Then post that link **exactly once** in the community you found earlier.

- If emails pile up → there's demand.
- If nobody signs up → **you found out before building anything**.

The latter is actually the better outcome. You got to scrap the idea early. This single test can save you weeks of development.

## Reflection

Looking back at all this, the four steps all point in one direction: **watch actions, not words**.

- In the community, you watch the action of "repeated complaints."
- With cold messages, you watch the action of "who actually replies."
- With past-tense questions, you watch the action of "who has already spent money or time."
- With the fake door, you watch the action of "who leaves their email."

"That would be nice to have" is free, so anyone can say it. Real demand shows up in the traces of what people are already doing. Finding those traces before you build is far cheaper than regretting it after.

## Things to dig into further

- **The Mom Test (Rob Fitzpatrick)** — the original source for "ask about the past, not the future." This book covers how to phrase questions so people can't politely lie to you. If you want to go deeper on point 3, start here.
- **The ethical line for fake doors / smoke tests** — if you say "coming soon" and never build it, where's the line between validation and deception? How should you design the follow-up communication after collecting emails?
- **Setting quantitative thresholds in advance** — decide "I'll build it if I get X or more emails" before running the test. Otherwise you'll rationalize the results after seeing them.
- **Applying this retroactively to my past projects** — I could apply these 4 steps backward to side projects I already built and then abandoned, to figure out which stage they would have been filtered out at.