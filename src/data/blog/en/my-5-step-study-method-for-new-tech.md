---
title: "The study method I made for myself — 5 steps for learning new technology (prerequisite knowledge → typing out code → applying to real cases → reading others' code → writing it up)"
description: "I tried both the terminology + playground approach and the type-out-code approach, and found the latter suits me better. Based on that realization, I've laid out a 5-step order for learning new technology going forward. Next time I learn something new, I'll come back to this post and follow the steps."
pubDatetime: 2026-06-21T03:45:00Z
tags:
  - 학습방법
  - 메타인지
  - 회고
  - 학습
draft: false
featured: false
---

Lately, while working through [terminology posts](/en/tags/용어정리) and studying RAG, I tried out **two study methods**.

1. Studying via **terminology + playground** ([UI](./ui-vocabulary-for-vibe-coding) / [DB](./db-vocabulary-for-vibe-coding) / [API](./api-vocabulary-for-vibe-coding))
2. **Typing out implemented code myself and watching the results** ([Implementing RAG from scratch](./rag-from-scratch-embedding-and-similarity-search) / [Building a RAG system](./rag-system-chroma-blog-qa))

Both look like "seeing results with my own eyes" approaches, but I concluded that **the latter is the one that suits me**. As I typed out the code, I kept asking myself what meaning each implemented piece carried, and as I watched the results directly, I found myself thinking about what parts needed fixing.

So I want to apply this realization to my future studying. **This post is a memo for me to come back to and check the order the next time I learn a new technology.**

## Table of contents

## The study order I have in mind — 5 steps

1. **Acquire prerequisite knowledge needed to learn the new technology** (just enough)
2. **Learn the new technology by implementing code**
3. **Apply what I learned to a real-world case**
4. **Read other people's code**
5. **Write it up as a post**

Let's go through each one.

## 1. Prerequisite knowledge — the key is "just enough"

Before learning a new technology, start with the prerequisites. This time, when learning RAG, I didn't jump straight into implementing RAG. Instead, **I first learned things like embeddings and vector DBs, then implemented them step by step** to learn how RAG works.

That said, **if you dig too deep into prerequisites, you never even get to start studying the new technology and end up starved of progress.** So it's better to study **just enough** to be able to connect the dots when understanding the new technology, then move on.

> The baseline: "Can I predict roughly where this concept will show up while implementing the new technology?"
> Anything deeper than that can wait until I've actually touched the new technology and need it.

## 2. Typing out code — what "hands-on" means

When learning a new technology, **don't just read about it — write the code yourself.**

Here, "hands-on" doesn't mean I come up with and write the code myself — it's really **just typing out the code AI produces.** But while typing it out:

- I can see **what prior steps are needed** at each implementation stage
- I come to understand **in what order the technology gets implemented**
- I discover **areas I want to study more deeply later**

> The difference between "just running the code AI wrote" and "typing out and running the code AI wrote yourself" is bigger than you'd think. The extra pass your fingers make is an extra pass your brain makes too.

## 3. Applying to a real case — "a high-end technology for a trivial goal"

Once I've confirmed how the new technology works by implementing it in code, the next step is to **bring in real data or a real case and implement it.**

This step does require some planning, but **it shouldn't drag on either.** The point is simply to get a feel for "oh, this is how I could use it" by applying what I learned — **not to build and maintain a full service.**

→ So the picture that emerges is one of **applying high-end technology to a trivial goal.** (For example: mobilizing a full RAG + vector DB + LLM integrated system just to search 270 of my own blog posts.)

Going through this process leaves you with two pieces of code in hand:

- The **basic code** written to learn the new technology (step 2)
- The **applied code** written by applying it to a real case (step 3)

Going through both, I think, will also help when it comes to developing something at a commercial level down the road.

## 4. Reading other people's code — when it feels like it hasn't sunk in yet

If, after going through the process above, **it still feels like the knowledge hasn't really sunk in**, I read other people's code.

- Even code written by AI, since I didn't write it myself, is helpful to read
- But I think reading **actual code from services that other people built by combining that technology** can generate new insight

This means well-made open-source projects on GitHub, or public code from people working in the same domain.

## 5. Writing it up — from "copying" to "internalizing"

Finally, write it up on the blog.

**Honestly, my blog posts up to now have felt less like something I wrote after fully understanding it, and more like copying down what I understood.** But from now on, it'll be different:

- Go through the study process (steps 1–4) first
- **Decide for myself what content I want to write about the topic**
- Then plan out and fill in that content

Of course, I won't be able to recall everything from memory. Whenever that happens, **I'll review briefly to fill in gaps, but I won't transcribe everything the way I have been doing.**

Even now it's not pure copy-paste — I'm writing my own sentences into a markdown file — but **the amount of knowledge that actually gets internalized this way isn't that large**, I think.

## Applying this going forward — study posts will come less often

With this approach, **the cycle between study posts might get longer**, since a post won't come out until I've gone through steps 1 through 4 on a given topic.

That said:
- **Project-related posts** currently in progress (like the [AGV series](/series)) will continue as before
- **Short debugging posts** will also continue as before (even a one-line realization)

### Candidates for the next new technology

Things I'm currently thinking I should learn:

- **LangChain** — the de facto standard framework for RAG integration
- **Hermes agent** — an open-source agent (NousResearch's Hermes series)
- **Implementing a local LLM** — an idea that came up in my [RAG system post](./rag-system-chroma-blog-qa) retrospective (reducing dependence on Claude/OpenAI, plus preparing for cost and censorship concerns)

More will get added as I keep implementing things, and I'll pick up new technology keywords through various routes. **Each time, I'll come back to this post, check the order, and follow it faithfully.**

## So, where this post fits

This post is different from my other study posts — it's not meant to convey information, it's **a memo to myself.** The next time I encounter a new technology keyword:

1. First, open this post again
2. Follow the 5 steps in order
3. At the last step, write it up again

I think repeating this loop will let learning accumulate. This is also a post worth revisiting in six months to see whether this methodology still holds up.