---
title: "Managing AI Sessions in Vibe Coding — How to Split Common vs. Specialized Instructions"
description: "A problem I ran into managing multiple Claude Code sessions like company departments: instruction management. I worked out how much should live in the common CLAUDE.md, and where the line is for splitting off specialized CLAUDE.md files in each working folder."
pubDatetime: 2026-05-14T05:30:00Z
tags:
  - claude-code
  - 바이브코딩
  - 워크플로우
  - 에이전트
  - 학습
draft: false
featured: false
---

In [my last post](./claude-code-instructions-placement-by-working-dir), I wrote about a case where department-style Claude Code sessions weren't following instructions well, and how I fixed it by placing a `CLAUDE.md` directly in each working folder. This post takes that one step further and works out **"so what's the actual criterion for splitting up instructions?"**

## Table of contents

## How I currently run things — department separation

I run my vibe coding project by mimicking an actual company's department structure.

- **Frontend session** — UI work
- **Backend session** — server functions, DB work
- **QA session** — testing, regression checks
- **Code analysis/management session** — reviews, refactoring, git commands
- (a planning/PM session added when needed)

Each session only handles its own work, and when it needs help from another department, it writes up a **"work request message"**. In effect, I'm running a one-person company.

## First attempt — a `guidelines.md` per department

I created a `guidelines.md` inside each department's folder with department-specific rules. The intent was good, but in practice it wasn't followed well. **The sessions I used most often were the ones most likely to start work without checking their own guidelines.**

The key fix from my last post: a file named `guidelines.md` is essentially a document for humans, while **what Claude Code automatically recognizes is `CLAUDE.md`**. Once I put a `CLAUDE.md` in the department's actual working folder (e.g., `flutter/lib/`), it got applied automatically and followed properly.

Once I applied this, the next question came up naturally.

> **Where do common rules go? Do I have to copy-paste the same rules into every department?**

## New principle — common rules in the common place, specialized rules in the specialized place

After running things for a few days, I worked out an approach.

### Common instructions — the root `CLAUDE.md`

Rules that every session needs to know go in the root. Notable examples:

- **Version control / git usage rules** — who has commit/push authority, branch naming, PR flow. Even a planning/PM session that doesn't touch code directly needs to know this (it affects how work gets broken into units).
- **Repository-wide rules** — basic hygiene like file naming, directory policy, security (never commit secrets).
- **Inter-session communication protocol** — rules for how departments interact, like "where and how to write a work request message" or "never touch another department's code directly."

There's no reason these should differ by department, and **the key point is that they apply identically to everyone**.

### Specialized instructions — `CLAUDE.md` in each department's working folder

Rules that only make sense "within that specific working folder" go in a `CLAUDE.md` inside that working folder.

- **Frontend session's working folder (`flutter/lib/`)**: widget structure conventions, state management approach, screen folder policy
- **Backend session's working folder (`supabase/functions/`)**: Edge Function patterns, environment variable rules, DB access patterns
- **QA session's working folder**: test case writing standards, regression checklist

From other departments' perspective, this is information they don't need to know and that would only bloat their context. Since it's only automatically loaded when a session starts in its own working folder, **the context each session receives is narrowed down to exactly what that department needs.**

## Summary — in one line

> **Gather common rules in one place, but a role doing specialized work needs specialized instructions specific to that role, kept separately.**

This is the principle I settled on this time. It looks like a simple question of file placement, but from the angle of **deliberately designing the context a session receives**, it's actually one dimension of agent design.

## Limitations and open questions

I've settled on an approach, but running it in practice raised new questions.

### 1. What happens if common rules grow bloated?

The longer the root `CLAUDE.md` gets, the more every session has to read it, every time. That affects cost, latency, and focus. I don't have a clear standard for **what the right size limit is**, or how to split it up once it gets too long (e.g., splitting further by category).

### 2. Rules that cross departments

Example: "the API response schema is decided by backend, but frontend must follow it too" — this is neither a common rule nor specific to one department. Where should a rule that's simultaneously needed by both sides go? Should it be duplicated in both places, or written once and referenced from the other?

### 3. What happens as departments multiply

Right now 4-5 departments are enough, but if departments get split more finely (e.g., splitting frontend into a UI department and a state management department), working folders will nest, and so will `CLAUDE.md` files. I don't precisely know **how Claude Code merges multiple levels of CLAUDE.md** or what the priority order is.

## Things to study further

To resolve the questions above, I need to look into the following topics.

### 1. Official documentation on how Claude Code uses `CLAUDE.md`

- How far up from the working directory it searches for `CLAUDE.md`
- Merge/priority rules when multiple `CLAUDE.md` files are found
- The relationship between global (`~/.claude/CLAUDE.md`), project-level, and subfolder-level files
- Reference: [Claude Code Memory docs](https://docs.claude.com/en/docs/claude-code/memory)

### 2. Agent engineering / prompt engineering in general

- How to deliberately design the context an agent should receive
- The tradeoff between "tell it everything up front" vs. "call it when needed"
- Patterns like role-based prompting and instruction layering
- Reference: [Anthropic's Building effective agents post](https://www.anthropic.com/engineering/building-effective-agents)

### 3. Multi-agent system design

- Running departments separately is itself a form of the multi-agent pattern — I should see how the formal literature frames this
- Communication protocols between agents, permission isolation, conflict resolution methods
- When multi-agent setups are better than having a single agent do everything

### 4. Things to measure through direct experiments

- Compare the same task run (a) with everything in a single root CLAUDE.md, no separation, vs. (b) with common/specialized separation — measuring token usage, instruction violation frequency, task completion time
- Where the efficiency threshold falls as department count increases (5 → 10 → 15)

### 5. How to maintain a human-facing document like "guidelines.md"

- Patterns for keeping a single source of truth between a human-facing document and the AI-facing `CLAUDE.md`
- How to make edits in one place automatically propagate to the other

## Retrospective

This started out as simply "the AI isn't listening to me," but working through it, the real issue turned out to be **how to design and deliver context to an agent**. There's a clear efficiency-based reason companies keep separate manuals per department while also sending out company-wide notices separately — and that same structure applies naturally to running AI sessions.

The next step is to prioritize items 1 and 2 from the "things to study" list above. Once I have a precise understanding of **how CLAUDE.md actually works, and what agent design patterns Anthropic recommends**, I want to line up my department-based setup against that established wisdom and see where it matches and where it diverges.