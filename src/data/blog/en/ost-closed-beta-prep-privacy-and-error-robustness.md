---
title: "OST Closed Beta Prep — Error Robustness, Privacy Notice Draft, Consent Gate"
description: "Preparing to hand off the perfectionism companion app OneSmallThing (OST) to other users after 2 weeks of dogfooding. Today's three things — (1) discovering that optimistic mutation code had zero catch blocks and adding rollback, (2) drafting a privacy notice — closed beta doesn't require a full privacy policy (a fine of up to 50 million KRW applies at full launch if one isn't written), but consent is required for three items: general collection/use, sensitive information (emotions/records), and cross-border transfer (Anthropic API = US, no Korea region), (3) building a consent gate UI that re-prompts existing users who haven't consented yet. KISA and PIPC's free consulting (for SMEs, small business owners, solo developers) is the review path for full launch."
pubDatetime: 2026-07-06T08:30:00Z
tags:
  - onesmallthing
  - 개인정보
  - 프라이버시
  - dogfooding
  - 상용화
draft: false
featured: false
---

I'm preparing the **closed beta** for **OneSmallThing (OST)**, the perfectionism companion app I've been building.

I dogfooded it alone for 2 weeks and judged it usable at this point. But it's time to see **other users' cases** — there must be problems that don't surface when I'm the only one using it.

Today I did three things — checked error robustness, drafted a privacy notice, and implemented a consent gate.

## Table of contents

## 1. Error robustness — zero catch blocks in optimistic mutations

First I went through the mutation flows and split them into two types:

- **Pessimistic**: `await → setState` — reflect the UI after receiving a server response
- **Optimistic**: `setState → await` — change the UI first, verify with the server in the background

The pessimistic side had error handling built in naturally (`try / catch`). The problem was **optimistic**. Going through the code, I found **not a single catch block anywhere.**

That means even when the server fails, the UI stays "as if it succeeded." There was no rollback logic at all. This is the worst kind of UX — the user thinks something was saved when it wasn't.

I went through everything, adding `catch` blocks and logic to revert to the previous state on failure. **Optimistic updates require failure rollback as a pair** — deciding to use optimistic updates is a contract to explicitly handle failure cases, and that entire piece was missing.

## 2. Drafting a privacy notice — how far do closed beta requirements go?

I lacked legal knowledge, so this was my biggest worry. Here's what I found out:

- **Closed beta stage**: A full **privacy policy** isn't required yet. It's enough to have **notice + consent** for the required items to proceed.
- **Full launch**: Failing to have a privacy policy can result in a **fine of up to 50 million KRW**.

Given OST's characteristics, three consent items are needed:

### (1) Consent for general personal information collection/use

Email, journal content, photo attachments, timestamps, etc. Must explicitly state the AI analysis purpose.

### (2) Consent for processing sensitive information

OST records emotions/feelings together with entries in a form called **"How I felt then."** **Emotional records can qualify as sensitive information**, so this needs to be consented to separately from general consent.

### (3) Consent for cross-border transfer of personal information

The weekly AI analysis uses the **Anthropic API** → data gets transferred to the US. **If a Korea region existed, this could be processed without cross-border transfer, but it doesn't exist yet** (I confirmed this).

→ Notice and separate consent for cross-border transfer are required. I designed this as an optional consent — if refused, only the weekly AI analysis feature is restricted.

## 3. Free consulting from PIPC and KISA

While searching for how much legal counsel might cost, I found out that the **Personal Information Protection Commission (PIPC) and KISA offer free consulting for SMEs and small business owners.**

- Privacy policy review
- Collection/use consent form review
- Entrustment contract review

**Solo developers are eligible too.** There's now a review path before full launch without paying for a lawyer. I'll proceed with my own draft during the closed beta and use this channel before the full launch.

## 4. Implementing the consent gate

After drafting the privacy notice, I added a **consent gate**. Even existing users who haven't consented now see the consent screen right after entry. I was still in dogfooding, but I ran into this new screen myself and had to click through it.

![OST consent gate — checkbox UI for 3 items: (Required) personal information collection/use, (Required) sensitive information (emotion/feeling records) processing, (Optional) cross-border transfer of personal information](/assets/posts/ost-closed-beta-prep-privacy-and-error-robustness/01-consent-gate.webp)

- (Required) General collection/use — service access restricted if refused
- (Required) Sensitive information processing — journaling/analysis features restricted if refused
- (Optional) Cross-border transfer — saving/display features remain unaffected even if refused; only weekly AI analysis is disabled

## Retrospective

Three things I learned today:

1. **Optimistic updates must always pair with failure rollback** — the moment you decide "I'll use optimistic updates," the contract "I'll explicitly handle failure cases" comes bundled with it. A state with catch blocks entirely missing, like what I found today, doesn't deserve to call itself optimistic.
2. **Legal matters aren't "can't do it because I don't know" — they're "worrying and procrastinating because I don't know"** — there are clear public channels (KISA, PIPC) for free review. Closed beta requirements also turn out to be clearly divided once you search for them.
3. **AI services inherently carry cross-border transfer issues** — this is mandatory until a Korea region opens up. The consent flow needs to be built into the design from the start.

## Remaining tasks

- **Consent withdrawal UX** — users should be able to withdraw consent for any item at any time, but the settings screen isn't implemented yet. I'll continue this in the next session.

## Further study

### 1. Deeper dive into optimistic mutation patterns

- [TanStack Query's `onMutate` / `onError` / `onSettled` rollback flow](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)
- Handling race conditions when multiple mutations occur simultaneously under optimistic updates
- What UX to use when notifying users of failure (toast? inline error?)

### 2. Criteria for determining sensitive information

- The precise definition of sensitive information under the Personal Information Protection Act (ideology/beliefs, health, sex life, genetic information, criminal record, political views, etc.)
- Actual cases of whether "emotional records" qualify as sensitive information — referencing mental health app categories
- Reference: [PIPC's standard privacy policy guidelines](https://www.pipc.go.kr/)

### 3. Anthropic's Zero Data Retention (ZDR) option

- Whether an Anthropic ZDR agreement could mitigate cross-border transfer risk through no-storage processing
- Whether this option is available to individual developers as well (Enterprise only?)

### 4. Standard UX patterns for consent withdrawal

- Immediate halt of data processing and disposal flow when an item is withdrawn
- The practice of clearly stating to users "how quickly withdrawal takes effect"
- Consent management requirements in iOS/Android app store review guidelines

### 5. Application path for KISA/PIPC free consulting

- The actual application process and turnaround time
- Whether the consulting outcome carries legal defensibility (reference material vs. official review)
- Reference: [KISA's privacy consulting guide](https://www.kisa.or.kr/)