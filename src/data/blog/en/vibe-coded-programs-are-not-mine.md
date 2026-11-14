---
title: "A program made with vibe coding isn't something I built"
description: "I built several programs through vibe coding, but when I had to explain my projects during a job search, I needed to study more. Making something work the way I wanted by putting my intent into it, and actually understanding the structure I built, turned out to be two different things."
pubDatetime: 2026-10-04T10:18:00Z
tags:
  - in-sight
  - 바이브코딩
  - AI
  - 회고
  - 학습
draft: false
featured: false
---

## Overview

I've built a lot of programs through vibe coding. This blog is one of them, and so is a program that recommends stocks based on search terms.

But when it came time to explain my projects during a job search, I realized I needed to study more. I had put my intent into these programs and made them work the way I wanted, built with vibe coding, and I mistakenly believed that meant I understood the structure I'd built.

To be able to say I truly built something, the structure of how that service works needs to be in my head. Putting in your intent and knowing the structure are two different things.

## Table of contents

## What I learned at work

A skilled developer can make fixes right away without relying heavily on AI. That's because they already have the structure mapped out in their head.

LLMs spew out tons of code. Sometimes you feel like you can maintain it later without fully understanding it, but I think that confidence ultimately comes from understanding the structure. This is still just my guess.

If someone asks whether writing down requirements and a problem statement, then building a service to solve it, makes you a skilled developer, my answer is no. We've entered an era where you can build something with a few clicks, but ultimately it's a human who takes responsibility for the service they built.

When someone asks how you managed to build something so well, you can't just say "AI did it" without explaining the structure. And if someone asks why you made something so complicated and you answer "that's how the AI wrote it," your credibility takes a hit.

At the very least, you need to know the code structure of the service you built. And I think that along with explaining how it works, you need a rationale for why a given feature is necessary to solve the problem at hand.

## What habits should I build

### Don't just say "do it" — be as detailed as possible

It seems better to write out the implementation approach in detail. I haven't tried this yet, but I think it might also help to ask for alternative approaches, so the implementation doesn't stay confined to what I already know.

### Spend time on the design phase

I suspect that planning step by step — wireframe → mockup → PoC → prototype → pilot → deployment — leads to work with fewer gaps.

<img src="/assets/mermaid/27dd166c6229d81a.svg" alt="기획 단계 순서 — 와이어프레임, 목업, PoC, 프로토타입, 파일럿, 배포" width="906" height="70" style="max-width:min(100%, 906px);height:auto;" />

AI can do anything. And precisely because it can do anything, it might implement parts you never planned for, resulting in a service that turns out differently than expected.

So I think it's important to spend time on the design phase, and that verifying your approach to solving the problem (PoC) matters. Once the design and the "yes, this can be implemented" verification are done, you can just take it as-is in a markdown file, say "do it," and test it.

### Give specific context rather than general information

Since LLMs can implement anything, I think giving specific context about the project you're currently working on — rather than general information — is what keeps it from over-engineering.

### As things get faster, communication matters more

Because implementation can happen so fast, communication has become more important than ever. Building quickly inevitably leads to frequent revisions, and that directly shows up as excessive token usage.

## So, once again, I need to study

### Understanding the domain

Understanding the domain has become extremely important. If you build something with only a rough understanding and no real grasp of the domain, you end up working hard on a service nobody uses.

### Feature design

I think I need to study feature design. I believe you need to be able to picture the structure in your head and have a sense of which direction things will flow.

For example, if you're implementing anomaly detection, you need to collect data, define the criteria for an anomalous state, decide what input values will be used to detect anomalies, decide the output values, and decide how to present it to the user.

<img src="/assets/mermaid/2fbf23707612fbc0.svg" alt="이상 탐지 기능 설계 순서 — 데이터 수집, 이상 기준 정의, 탐지 방식과 입력값, 출력값, 사용자 표출" width="276" height="510" style="max-width:min(100%, 276px);height:auto;" />

To think through the detailed structure within each step of a process like this, I think you need to understand the underlying principles of how those features are actually implemented.