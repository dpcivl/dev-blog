---
title: "Checking Demand Before Writing Code — A 4-Step Validation Process for Solo Developers"
description: "When you develop alone, time is your most expensive resource. To flip the order of 'build first, figure out who uses it later,' I've written down how to check demand before building. From lurking in communities to cold messages, asking about the past, and fake door tests."
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

When you develop alone, time is your most expensive resource. But when you build things alone, it's easy to end up worrying about "who's going to use this?" only after you've built it. That order is backwards.

If you check demand **before** building, you can back out much more cheaply. Finding out you're wrong without writing a single line of code, versus finding out no one uses it after weeks of building — the cost is completely different. To flip that order, I'm writing down validation methods a solo developer can actually use, so I can come back to this later.

## Table of contents

## 1. Go where people are already gathered

You don't need to run some elaborate survey to check demand. You just need to go **where people are already gathered and complaining**.

- For online sellers, there are Naver cafes (related to sellers/Smart Store), communities like "Being a Boss Is Hard," and related open chat rooms or Discord servers.
- Self-employed business owners also have industry-specific cafes and communities.

Join, lurk for a few days, and you can just see what people struggle with **repeatedly**. If the same complaint keeps coming up from multiple people, that's already demand research. You're finding a problem that actually exists, not one you imagined.

## 2. Ask, don't sell

Reach out briefly to someone in the community who voiced that complaint. The key here is **not trying to sell anything**. The moment they sense you're trying to sell something, the conversation closes. Your tone needs to be that you want to understand the problem.

> Hi, I'm someone studying development, and I saw your post about how hard it is to write product detail pages. Could I ask you about how you're handling that, just for 5 minutes? I'm not trying to sell anything — I just want to understand the problem.

With this kind of tone, you get more responses than you'd expect. If you send this to 10 people and 2-3 reply, that's enough. You don't need everyone to respond in the first place.

## 3. Ask about the past, not the future

When you actually talk to them, asking the wrong question can waste all the effort you put into reaching out. The most common mistake is **asking about the future**.

"Would you use something like this?" — This question is useless. Everyone says "yes" out of politeness. If you trust that "yes" and build based on it, you'll get burned.

Instead, you need to ask about **past behavior**.

- "How are you handling this right now?"
- "When was the last time this frustrated you?"
- "Have you ever paid for something to solve this?"

If they've **actually spent money or time on it**, that's real demand. If they just say "that would be nice," it's fake. Past behavior tells the truth, not future intentions.

## 4. Run a 'fake door' test before building

Once you've verified it through conversation, do one more validation round — without code. This is the **fake door test**.

Don't write a single line of code. Just make one landing page. Put up something like: "This service is coming soon. Leave your email if you're interested." Then post that link **exactly once** in the community you found earlier.

- If emails come in → there's demand.
- If nobody signs up → **you found out before building**.

The latter is actually the win. You backed out early. This single test saves you weeks of development.

## Tying it into one sequence

The four points above might look like separate tips, but they actually connect into a single sequence. Let me walk through it start to finish using **online sellers** as an example, since it's an easy field to enter.

1. **Pick a field** — Start with something accessible to you. Online selling has a low barrier to entry, making it a good place to get your feet wet directly.
2. **Experience the pain yourself** — Open a Smart Store account and list a few products. Feel "what's the most annoying part" with your body, not just your head.
3. **Check demand in the community** — See whether it's just your own frustration or whether everyone gets stuck at the same point, both by lurking and by asking a few people directly. (This is the earlier "ask, don't sell" and "ask about the past.")
4. **Validate before building** — Run the email test with a landing page. (This is the earlier "fake door test.")
5. **Only then start the project** — Write the first line of code with people already waiting.

If the four points above were about "what to do," this sequence is about "in what order to do it." In particular, if step 2 — **experiencing it yourself** — is missing, everything else becomes secondhand. A pain you haven't experienced yourself just passes you by even when you see it in the community, and even if you interview people, you won't have a sense of what to dig deeper into. Only after experiencing it firsthand can you properly read other people's complaints.

## Retrospective

Once I laid it all out, the four steps point in one direction: **look at actions, not words**.

- In communities, you look at the action of "repeated complaints."
- With cold messages, you look at the action of "whether they actually reply."
- With past-tense questions, you look at the action of "whether they've already spent money or time."
- With the fake door, you look at the action of "whether they leave their email."

"That would be nice" is free, so anyone can say it. Real demand shows up in traces of what people are already doing. Finding those traces before you build is much cheaper than regretting it after you've built.

## Further reading

- **The Mom Test (Rob Fitzpatrick)** — The original source, so to speak, for "ask about the past, not the future." It covers how to phrase questions so people can't lie to you out of politeness. Start here if you want to dig properly into point 3.
- **The ethical line for fake doors / smoke tests** — Where does saying "coming soon" and not actually building it cross from validation into deception? How to design follow-up communication after collecting emails.
- **Setting quantitative thresholds in advance** — Deciding "I'll build it if I get more than X emails" before running the test. Otherwise, you end up rationalizing the result after the fact.
- **Applying this retroactively to my past projects** — Applying these 4 steps retroactively to side projects I've already built and abandoned lets me trace back at which step they would have been filtered out.