---
title: "How to Use Perfectionism as a Tool — Discovering the Vertical Slice Development Approach"
description: "I tried to fix my perfectionism, but the attempt to fix it was itself perfectionism. So I changed direction. A record of redesigning my development process using 'vertical slices' — cutting vertically instead of stacking horizontally."
pubDatetime: 2026-06-14T05:30:00Z
tags:
  - 회고
  - 워크플로우
  - 생산성
  - 포트폴리오
draft: false
featured: true
---

On a day off, spending time with family, I found myself thinking about my career path. **The fact that I'd been developing for 3 years and "didn't have a single finished project"** kept nagging at me. Maybe I'd picked the wrong field. Maybe I needed to find a different path. I threw that question at an AI, and the conversation that followed unexpectedly led me to a conclusion that changed the way I develop altogether.

## Table of contents

## The start — "I don't know what I'm good at"

![The first question I threw at the AI — a vague worry about finding my aptitude](/assets/posts/perfectionism-and-vertical-slice-dev/01-question-about-aptitude.png)

I asked the AI how to figure out what I'm good at. The answer: **write down things others have asked you to do, things you got so absorbed in you lost track of time, things where you produced results.** I tried to write them down, but drew a blank. Whatever experiences came to mind, I dismissed as "doesn't everyone go through this?" — nothing seemed worth writing.

So I just **listed out what I'd done at work, in chronological order.** Starting from a liberal arts background, learning embedded hardware design, debugging PCBs with OrCAD, self-studying C and getting certified, maintaining embedded software, and — to explore the possibilities of edge AI — building object detection / fire monitoring models through transfer learning and running them on a dev board myself.

![The career timeline I organized and sent](/assets/posts/perfectionism-and-vertical-slice-dev/02-my-career-history.png)

Even as I wrote it, I kept thinking "none of this is really special." But the response I got back was completely unexpected.

## The diagnosis — "It's not a matter of aptitude, it's a broken self-evaluation circuit"

![The AI's analysis — a diagnosis that the circuit for acknowledging your own good work as good is broken](/assets/posts/perfectionism-and-vertical-slice-dev/03-perfectionism-analysis.png)

> "You're not failing to find your aptitude. **The circuit that lets you acknowledge good work as good is broken.**"
>
> "**You're grading yourself on a system where anything short of first place is zero.** This isn't an aptitude problem — it's a problem with your self-evaluation standard."

It felt like getting hit on the head. Every single line landed.

- Even when told I was good at singing, I'd interpret it as "**there's someone better than me, so I'm not good enough**." By that standard, no one in the world is good at anything.
- The reason I had no portfolio after 3 years of work wasn't that I hadn't made anything — it's that **anything that didn't clear the single bar of "complete and delivered" counted as nothing at all.**
- Starting a project and then, if I didn't like how it turned out, **wiping it all and starting over** — this pattern comes from the same root. It's a "defensive move: destroy it before you have to face it being imperfect." That way I never have to confront something unfinished.

Hearing this, I realized something else too. **The very effort I'd put into "trying to get rid of perfectionism" was itself something perfectionism was doing.** A perfectionist tries to perfectly fix even their own flaws. And when that fails, they tear themselves down again. An infinite loop.

## The shift — "Don't eliminate perfectionism, use it"

I changed my approach. **If perfectionism isn't going away, it's far more realistic to design where that energy flows instead.** To do that, I needed to understand in what kind of workflow perfectionism becomes medicine instead of poison for me.

Fortunately, that pattern was already there in my own experience. I was **happiest working when I started from a vague, one-line big picture and gradually broke it into smaller pieces, watching the direction get clearer and clearer.** Finishing one small piece gave me a sense of accomplishment, and that momentum carried me to the next piece.

There's already a term for this approach.

> **Vertical slice / incremental development.**

## The core idea — cut vertically, don't stack horizontally

![Comparison diagram: horizontal stacking (the perfectionist trap) vs vertical slicing](/assets/posts/perfectionism-and-vertical-slice-dev/04-horizontal-vs-vertical-slicing.png)

This one image captured the core idea I needed to hold onto.

### Horizontal stacking — the perfectionist trap

```
1주차: 모터 제어를 완벽히
2주차: 카메라 검출을 완벽히
3주차: 판단 로직을 완벽히
4주차: 여기서야 처음으로 전체가 한 번 돌아감
```

There's **nothing "working"** until week 4. If you burn out before that, you're left with zero. This was the pattern I fell into every single time.

### Vertical slicing

```
슬라이스 1:    카메라: 대충 봄
              판단: 대충
              모터: 살짝 움직임
              → 엉성해도 작동!

슬라이스 2:    카메라: 더 정확히
              판단: 더 똑똑히
              모터: 부드럽게
              → 더 나아짐!

슬라이스 3:    장애물 회피 추가
              속도 조절 추가
              ROS로 정리
              → 완성에 가까워짐
```

**Starting from slice 1, you already have a "working whole" in hand.** No matter where you stop, something functional remains.

The core idea: **cut features not by "level of completeness," but as a "thin line that runs end to end."** The starting point is **connecting the entire path — camera → decision → motor — even if roughly — just once.**

## Why this approach fits me

It's clear why this approach fits me. The core drive of perfectionism — **"I want this part to be better"** — flows naturally into slice 2, 3, 4. In horizontal stacking, "I can't move on until this part is perfect" holds you back. But in vertical slicing, that same perfectionism turns into an **improvement engine**: "there's something in this slice I can make better."

There's one more thing — **what you've already done never becomes zero.** Even if slice 1 is rough, it's still "something that works." If you don't do more after that, you can stop there, and the result still remains. This is what makes it impossible to end up with a portfolio of zero.

## Summary

- Perfectionism can't be eliminated. It needs to be acknowledged, and designed to flow in a direction that actually works.
- **Horizontal stacking** (pursuing perfection stage by stage) is the perfectionist's trap. Something working only appears at the very end, so if you burn out midway, you're left with zero.
- **Vertical slicing** — build a thin line that runs end to end first, even if rough, then thicken it slice by slice.
- The real value of this approach isn't "seeing the finished product faster" — it's **"making sure what you've already done never becomes zero."**

## Further study

### 1. Vertical Slice / Walking Skeleton in software engineering

- **Walking Skeleton pattern** (Alistair Cockburn) — start with the thinnest possible end-to-end working system
- **Tracer Bullet development** (The Pragmatic Programmer) — a different expression of the same idea
- The **"horizontal slice vs vertical slice"** debate in agile, when cutting user stories
- Reference: [Walking Skeleton — c2 wiki (contributed by Alistair Cockburn)](https://wiki.c2.com/?WalkingSkeleton)

### 2. MVP / incremental release methodology

- Lean Startup's definition of MVP and the common misconception (that "minimal" means "shoddy" rather than "verifiable")
- Continuous delivery and incremental rollout using feature flags
- In Phase 1 → Phase 2 style development, **how to set the release criteria for each phase**

### 3. The relationship between perfectionism and productivity (meta)

- The distinction between **adaptive perfectionism and maladaptive perfectionism**
- Real cases where "done is better than perfect" actually applies
- The effect of self-evaluation standards on learning outcomes (growth mindset vs fixed mindset)

### 4. Things to try firsthand

- **Consciously apply the vertical slice principle** to the solo app I'm developing and the Busan public data competition project currently in progress
- When defining a phase, enforce the criterion: "**does this slice alone produce a working demo?**"
- Insert a step **showing the result to someone** between slice 1 and slice 2 (validation + outside feedback)

### 5. Resetting the self-evaluation circuit

- Consciously count the moments when the "if it's not first place, it's zero" pattern shows up
- Every time I finish a small slice, explicitly record it as **"this counts as a result too"** (this blog is that tool)

## Reflection

The purpose of writing this post is **to remember which approach works for me when I'm developing.** A reference point to ask myself, the next time things feel vague again: "am I stacking horizontally right now?"

Today's conclusion: perfectionism isn't a weakness — it's **energy that becomes fuel if you channel it well.** The effort I used to spend fighting to eliminate it, I now spend channeling from one slice to the next. That way, what's left in my hands never becomes zero.