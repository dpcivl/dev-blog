---
title: "How Far Can AI Go in Researching User Pain? — Limits I Hit While Searching for a Portfolio Topic"
description: "In an age where AI lets you code fast, you get stuck at the stage of figuring out 'what to build.' Here are 4 ways to find people's pain points, and the limits I found when I handed that research over to AI."
pubDatetime: 2026-05-29T23:30:00Z
tags:
  - 회고
  - 프로덕트
  - AI Agent Directing
  - 포트폴리오
draft: false
featured: false
---

I need to build something for my portfolio, but it turns out **"what to build"** is the part that takes the most time. It's ironic — we're in an era where AI makes coding easy, yet I get stuck at the step before that.

Today I went to resolve that question. How do other people find people's **pain** and use it to kick off a project? And where does the line fall for handing that research over to AI?

## Table of contents

## The problem — I can build things, but I can't find something to build

Put plainly, the questions in my head boiled down to three:

- How do other people research pain?
- Do other people experience the same pain I do?
- Where does AI's help end when it comes to this kind of research?

I threw these questions straight at Claude.

![The question I asked Claude — for advice on how people find pain points for projects in the age of AI](/assets/posts/ai-limits-in-user-pain-research/01-my-question-to-claude.png)

I got back **4 representative approaches**.

## 4 ways to find people's pain

### 1) Starting from your own frustration

- **Pros**: Since it's a problem I actually experience, I barely need to verify "does this pain really exist?"
- **Risk**: It could be "**my problem alone**." I still need to separately check whether other people share the same problem.

> This is actually how I usually start projects, but if I find out too late that it was "my problem alone," what I built ends up unused. This is a step I need to check before starting.

### 2) Observing where people complain

- **Low-rated reviews** on popular apps and services
- **Questions and gripes** posted in communities
- Situations where users of some tool are **awkwardly working around its limitations** (= a spot where a better tool could fit)

### 3) Talking / interviewing directly

Meet the target people directly and ask about their concrete experiences and pain.

- **Pros**: Most reliable. You can even gauge the intensity of the pain directly.
- **Cost**: High. Gathering people to meet is itself a job.

Offline meetups are one methodological option, but since **reaching the target people is the key part**, running an SNS account occurred to me as another approach.

### 4) Observing inefficiencies in your own industry / domain

- This is the most powerful approach. There are inefficiencies visible only to people inside the domain.
- Limit: **You can't use this without domain knowledge.**

This is actually the approach I want to take the most, but since I haven't settled on a domain yet, it's hard to apply. I do have one relatively lightweight example — a system I built recently while playing Diablo 2. **A tool where you capture a screenshot of a dropped item you're unsure about, and AI scores its value.** It's a game domain, but the next task is figuring out whether the same pattern — "delegating decisions in an area I don't know well to AI" — can be moved into an industrial domain for a bigger impact.

## A side question — do I need to manage an SNS account?

I thought that running an SNS account as a supplement to direct interviews would naturally let me learn people's needs. But once I actually thought it through:

- **Growing an account alone takes a lot of time.**
- Ultimately, target users are **already gathered in specific communities** (e.g., a subreddit on Reddit).
- Going directly into that community to observe and ask questions is **faster and more accurate**.

→ Conclusion: **Rather than growing an account, it's better to pick a target community and go directly into it.** And to do that, I'm back to the original question — **I need to decide on a target / domain first.**

## So, can I hand off pain research to AI?

The proper approach is for a person to dig through community posts directly, but with AI tools getting better these days, the natural next question was whether **having AI do the research** would work. Here are the limits I worked out:

### 1) Only public territory is accessible

AI only sees publicly available text (the web, public forums, Twitter, etc.). The following is **inaccessible**:

- Private cafes / Discord servers
- Group chats / Slack workspaces / internal wikis
- Content behind a login wall

→ **The pain AI finds for you is pain that's already well surfaced.** Well-surfaced pain is easy to spot, which also means **someone else is probably already building a tool for that exact spot.** In other words, the room for differentiation shrinks.

### 2) It can't accurately gauge the "intensity" of pain

> Knowing the difference between "it's inconvenient, but not enough to pay for" and "I want to pay to use this" is something only a human can do.

AI plausibly synthesizes data, but it can't measure **how urgent that pain actually is**. This is something only a human can capture from AI, and only if someone explicitly wrote it down in text. Most pain isn't recorded in writing with that level of precision.

### 3) Other limits

- **It misses context** — it's imperfect at distinguishing a joke from something sincere, or last year's story from today's.
- **Sources are opaque** — it's often hard to trace back "where did you see this" in AI's answers.
- **Hallucination** — it produces plausible-sounding fakes.
- **It can't gauge how universal the pain is** — it's hard to tell whether one person wrote it, or ten thousand people are saying the same thing.

## Summary — leave the research to AI, but leave the judgment to people

| Stage | Human vs. AI role |
|---|---|
| **Broad exploration** (where are people talking) | Can be delegated to AI |
| **Extracting candidate pain points** (which frustrations show up often) | AI-assisted + human verification |
| **Measuring pain intensity** (would they really pay for it) | **Human, directly (interviews / empathy)** |
| **Confirming pain universality** (how many people experience this) | **Human, directly (quantitative research)** |
| **Verifying it's not just my own problem** | **Human, directly (asking in the community)** |

The conclusion I drew today is this: **AI saves time in broad exploration, but the decisive verification steps are a human's job.**

## Things to study further

### 1. How to decide on a target / domain

- How to narrow down a domain by cross-referencing your own strengths (existing career + interests) with market size
- If I start from a domain in my existing career — like **embedded object recognition / NDT** — that's where I already have domain knowledge and can spot inefficiencies. Let me reconsider this as the proper approach.
- Frameworks worth referencing: exploring PMF (Product-Market Fit), "niche down" thinking

### 2. User interview techniques

- "The Mom Test"-style questioning — interviewing without leading people toward the answer you want to hear
- The UX research rule of thumb that interviewing just 5 people surfaces 80% of the problems
- Analysis patterns like affinity diagramming for organizing interview results

### 3. The reality of AI-based market research tools

- OSS / commercial tools that gather and auto-analyze Reddit, Twitter, and app store reviews (e.g., a Reddit API + LLM pipeline)
- An area worth building myself — pain research itself could become a portfolio tool

### 4. Expanding a lightweight project that started in the game domain

- Generalizing a pattern like the Diablo 2 item valuation system — "AI assisting decisions in an area I don't know well"
- Candidates for industrial application: used parts valuation, industrial equipment diagnostic scoring, assisted opinions for non-destructive testing, etc.

### 5. How to capture pain that isn't written down

- How to collect and accumulate pain from areas AI can't see (private chats, direct conversations)
- How to turn the insights gathered that way into an asset that's uniquely your own

## Retrospective

Today's question was actually fundamental. **"Would this sense of being stuck also disappear if I used AI?"** The answer is partly yes, partly no.

Coding is something you can do fast with AI these days, but **for a service to actually run, you need to spend more time on the stage before coding (what to build) and the stage after it (how to reach the right people), than on coding itself.** As coding gets faster, the relative weight of those two surrounding stages grows.

I'm narrowing my next actions down to two:

1. **Decide on a target domain** — narrow it down to about 3 candidates based on my existing career (possibilities in embedded object recognition / NDT)
2. **Observe that domain's communities / reviews / complaints directly** — let AI assist only up to broad exploration; make the decision myself