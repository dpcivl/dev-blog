---
title: "When department-specific Claude Code sessions don't follow instructions — putting CLAUDE.md in the actual working folder"
description: "While running multiple Claude Code sessions split by role in one project, the frontend session kept using git commands. Moving the instructions from the 'department folder' to the 'actual working folder' fixed it."
pubDatetime: 2026-05-06T09:30:00Z
tags:
  - claude-code
  - 바이브코딩
  - 워크플로우
  - 학습
draft: false
featured: false
---

I run my solo app development by splitting Claude Code into multiple sessions (for convenience, I call this "department sessions"). Here's one problem that wasn't going well, and how a simple location change fixed it.

## Table of contents

## How I operate — splitting sessions by department

My vibe coding setup is roughly structured like this.

- **Frontend department session**: handles Flutter code (UI / local state) work
- **Backend department session**: handles Supabase functions, schema, and policy work
- **Code review/management session**: handles review, refactoring, and **git commands** (commit/push/branch)

Each session has role boundaries. Among these, git commands are set to be "usable only by the code review/management session." If a department commits its own work, the review step becomes meaningless.

## The problem — the frontend session kept using git

The problem was that **the frontend department session kept executing git commands**. It would have been fine if it happened once or twice, but the same thing repeated every time I started a new session.

To find the cause, I inspected the instruction structure I had set up.

```
project-root/
├── CLAUDE.md             ← shared across all departments / overall rules
├── fe/
│   ├── GUIDELINES.md     ← frontend department-specific rules
│   └── flutter/          ← actual Flutter working folder
│       └── lib/
└── be/
    └── GUIDELINES.md     ← backend department-specific rules
```

Claude Code automatically reads the root `CLAUDE.md`, but I had written department-specific rules in a file called `GUIDELINES.md` and instructed it to "read this when needed." The intent was good, but the problem was that **it often skipped reading GUIDELINES.md whenever a new session started**.

A new session has no context from the previous one. Even though I named it the "frontend department session," in reality it was just the same Claude Code being launched fresh with a different working folder. Expecting it to actively find and read its own department's GUIDELINES.md every time was leaving things to chance.

## Hypothesis and attempt

Two directions I considered.

### Direction A — Consolidate all rules into the root CLAUDE.md

Put all department-specific rules into the root CLAUDE.md as well. This guarantees every session reads them, but it **bloats the context**, and the frontend session ends up reading backend detail rules too — wasting tokens.

### Direction B — Put CLAUDE.md in the "actual working folder"

Claude Code automatically reads the `CLAUDE.md` in the working directory. So if I rename department-specific rules from **GUIDELINES.md to CLAUDE.md**, and moreover place it in the folder the department **actually works in**, then any session launched from that folder will automatically read those rules.

I went with this direction.

```
project-root/
├── CLAUDE.md
├── fe/
│   ├── GUIDELINES.md         ← (left as is — kept as human-facing documentation)
│   └── flutter/
│       ├── CLAUDE.md         ← ★ added: directly in the frontend working folder
│       └── lib/
│           └── CLAUDE.md     ← ★ added: also at a narrower scope
└── be/
    └── GUIDELINES.md
```

The key point: **keep the human-facing document (`GUIDELINES.md`) as is, but put the rules the AI needs to auto-recognize as `CLAUDE.md` in the working folder.** This effectively separates the two kinds of documents.

## Result

> It follows instructions well now.

When I spin up a new frontend session and give it a task, it naturally recognizes the `CLAUDE.md` inside the working directory and follows its rules. It respects department boundaries (e.g., "don't use git commands") without me having to repeat that every time.

It seems like a minor change, but it was a case where I directly saw the effect of **putting the right information in the right place**.

## Summary

| Wrong assumption | What actually works |
|---|---|
| "If I put GUIDELINES.md in each department folder, it'll read it on its own" | Don't expect active reading. Instead, hook into the **auto-load mechanism** (`CLAUDE.md` in the working directory) |
| "It's cleaner to gather all rules in one place (the root)" | Every session ends up reading every rule, which is inefficient. **Rules should be scoped to match the session's working scope** |

## Things to study further

### 1. Claude Code's CLAUDE.md loading mechanism

- Which files get auto-recognized as you go up from the working directory (`CLAUDE.md`, the user home directory, etc.)
- Priority / merging behavior when multiple CLAUDE.md files are found
- Whether a CLAUDE.md in a subdirectory only applies when launched inside that directory, or also when launched from a parent
- Reference: [Claude Code official docs — Memory](https://docs.claude.com/en/docs/claude-code/memory)

### 2. Anti-patterns in multi-session workflows

- Cases where splitting by department helps vs. cases where it just adds friction
- Merge conflicts / locking / change-visibility issues when multiple sessions work on the same repo at once
- The role of the "review session" — is preventing a department from committing its own code actually valuable, or is it better for a human to review at the PR level instead?

### 3. Separating the roles of instruction documents

- Rules the AI should auto-recognize (`CLAUDE.md`) vs. human-facing guides (`GUIDELINES.md` / `README.md` / `CONTRIBUTING.md`) — how to consistently manage these two kinds of documents
- How to maintain a single source of truth (SoT) once the two start to drift apart (e.g., having `CLAUDE.md` reference the GUIDELINES)

### 4. Things to measure directly

- Track **the frequency of instruction violations per session** for about a week, before vs. after introducing department-specific CLAUDE.md files, for a quantitative comparison
- It would probably make for a cleaner comparison to first set up an environment where the same prompt repeated multiple times reliably reproduces the violation pattern

## Reflection

When I see an AI not following instructions, my first reaction is frustration — "why won't it listen?" But it always comes back to the question of **how I'm delivering information to the AI**. Each department has its own rules, but if those rules are posted on a bulletin board in the meeting room (a GUIDELINES.md outside the working folder) instead of at the department's own desk (the working folder), it's unreasonable to expect it to go all the way to the meeting room to read them every time. It's much more natural to have the day's tasks written right there on the desk.

The next experiment is to see how the effect changes if I break the department CLAUDE.md files down even further — for example, having separate ones for `lib/screens/` and `lib/services/`.