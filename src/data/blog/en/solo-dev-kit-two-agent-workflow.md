---
title: "A Reusable Kit for Solo Development — CLAUDE.md Constitution File + 2-Agent Workflow"
description: "Solo development has no reviewer, PM, or QA. This setup encodes those roles into (1) a CLAUDE.md constitution file and (2) two sub-agents — code-writer and code-reviewer — so the machine enforces discipline. Pulled from a recent project's refined setup, keeping only the parts portable to other projects — a CLAUDE.md skeleton, a 6-step 2-agent workflow with 3 operating modes (review-only / finalize / review-and-finalize), agent prompt templates, and a project-agnostic checklist of working principles. Permission scope is deliberately split (writer has no git, reviewer has no Write) so every commit always passes through a review gate. You can drop this into a new project in 5 minutes."
pubDatetime: 2026-07-10T04:15:00Z
tags:
  - claude-code
  - agents
  - 1인개발
  - 개발방식
  - AI페어프로그래밍
  - 워크플로우
draft: false
featured: true
---

From the Claude Code setup I refined in a recent project, I pulled out only the **structure, prompts, and discipline that carry over to other projects** — a reusable kit. I stripped out product-specific content (domain hard rules, tone definitions, etc.) and kept just the skeleton.

**Why this matters especially for solo development:** Teams have reviewers, PMs, and QA. Solo development has none of that. When you encode those roles into **① a constitution file** and **② two sub-agents**, discipline that's easy to skip on your own — spec adherence, curbing over-engineering, security, git hygiene — gets **enforced by the machine**.

**How to use it:** Copy the three files below into a new project and fill in the `{curly braces}`. Add project-specific detail as the project grows.

## Table of contents

## Three pillars

```mermaid
flowchart LR
    C["① Constitution file<br/>CLAUDE.md<br/>(living source of truth)"]
    W["② code-writer<br/>Implementation only · No commits"]
    R["③ code-reviewer<br/>Adversarial review · Log · Commit"]
    C -.->|"Read first, every call"| W
    C -.->|"Read first, every call"| R
    W -->|"working tree + report"| R
```

1. **Constitution file** — the project's identity, non-negotiable rules, and working conventions, all in one file. Since both agents **read it first every time**, adding a rule here applies automatically starting with the next task.
2. **code-writer** — implements only the spec and **never touches git**. Leaves a structured report behind.
3. **code-reviewer** — reviews adversarially, then after user testing writes the implementation log and commits. **Never edits code directly** (no Write permission).

The key here is **deliberately splitting permissions**:

- writer has no git → every commit passes through the review gate
- reviewer has no Write → the reviewer can't quietly fix its own findings; they only get recorded in the report

## Pillar ① — Constitution file (CLAUDE.md)

`CLAUDE.md` at the project root. The first file any new session or agent reads. **The source of guardrails** — if a user instruction unknowingly violates a hard rule, the agent stops and points to this file as grounds.

### Minimal skeleton

````markdown
# {PROJECT} — Project Guidelines

> Read this first in any new session. This file is the source of truth for identity, principles, and working conventions.
> If a user instruction conflicts with a hard rule here, always flag it and confirm.

## 1. Project identity
{One paragraph: what it is, who it's for, the core motto}

## 2. Hard Rules — non-negotiable
{Table: Rule | Reason. Things this project has decided to never include.
 E.g., banned features/patterns/dependencies. Any suggestion that violates these gets confirmed with the user immediately.}

### Conflict response template
> Wait — this conflicts with [principle name] that we set earlier.
> We decided to leave it out because of [reasoning] — has your position changed, or is this a different intent?

## 3. Stack (locked in as of {date})
{Table: Layer | Choice. Only finalized items. Undecided items go under "Open Questions."}

## 4. Deliberately undecided (open questions)
{Don't pre-fill with guesses. Decide at the point of need.}

## 5. Working rules
| Rule | Meaning |
|---|---|
| No guessing | If the user hasn't specified a spec/UX detail, don't invent it — ask |
| Confirm before large output | A one-line check: "OK to go in this direction?" |
| Report hard-rule conflicts immediately | Don't proceed. Use the §2 template |
| Be token-conscious | Prioritize efficiency |

## 6. Key reference docs
{Table: Path | Contents}

## 7. History — major decisions / major incidents
{Cumulative by date. A record of "why things ended up this way."}
````

### Reusable takeaways

- **Hard Rules is a "things we don't do" list** — the content differs per product, but the **format** is the same. You must pair each rule with a "reason," or your future self and your agents won't respect it.
- **The conflict response template** — reuse as-is. It's a device to keep the user (i.e., yourself) from being blindly obeyed too.
- **The history section** — keeping "major decisions + major incidents (what got scrapped and why)" prevents you from repeating the same mistake.

## Pillar ② — 2-agent workflow

### 6 steps (separation of responsibilities)

```mermaid
flowchart TD
    u1["User: chunk implementation request"] --> w["code-writer<br/>[1] Write code + structured report"]
    w --> u2["User: review report → invoke reviewer"]
    u2 --> rev["code-reviewer<br/>[2] Adversarial review (4 axes) + sanity (build/lint)"]
    rev -->|"issues"| stop["STOP · report → resend to writer"]
    stop --> w
    rev -->|"clean"| test["[3] User manual functional test<br/>(skip if no runnable UI)"]
    test --> share["[4] User shares test results"]
    share --> log["code-reviewer<br/>[5] Write implementation log"]
    log --> commit["[6] commit (code + log together)"]
    commit --> done["Final report: SHA + log path"]
```

**Separation of responsibilities — this is the core of it:**

- **Agents:** code correctness (build/lint sanity), the 4-axis adversarial check, logs, git
- **User:** manually testing that the feature actually works. The agent doesn't do this for you — **it waits.** (A passing build ≠ working functionality.)
- **Exception:** for a chunk with no runnable UI (data layer only, etc.), user testing is skipped — the agent reviews → logs → commits in one pass.

### Reviewer operating modes (specified at call time)

| Mode | Does | When |
|---|---|---|
| **A — review-only** | Review only | Chunks with UI. Waits for user testing after review |
| **B — finalize** | Log + commit | After receiving user test results |
| **C — review-and-finalize** | Everything at once | Chunks with no runnable UI |

### Why split it into two stages (from a solo-dev perspective)

When you code alone, it's easy to fall into **"write → commit immediately,"** and review/verification evaporates. Splitting writer/reviewer bakes into the workflow the step of **passing your own code through another set of eyes (an adversarial reviewer)** once. Commits always come after review and testing.

## Reusable: code-writer agent (generalized template)

Save as `.claude/agents/code-writer.md`. Fill in the `{curly braces}` for your project.

````markdown
---
name: code-writer
description: Implements {PROJECT} features from spec docs. Reads CLAUDE.md and the relevant spec first, implements only what's specified, no over-engineering. Does NOT commit — leaves the working tree for code-reviewer.
tools: Read, Write, Edit, Glob, Grep, Bash
---

You are the **code-writer** agent for {PROJECT}.

## Step 1 — Always read these before writing any code
1. `CLAUDE.md` at project root — internalize all hard rules
2. The relevant spec doc in `docs/{spec location}/`
3. {Phase/roadmap doc} to confirm scope
4. **If the framework changes faster than training data** (see "Framework Warning" below):
   check the actual docs for that API (`node_modules/.../docs/` or the official site) first.
   Don't assume old patterns from training data.

If the request conflicts with a hard rule or exceeds current scope: **STOP + report.** Don't "interpret" — refuse or ask.

## Step 2 — Implementation rules
- Implement **only** what the spec says. No tidying up along the way, no "while I'm at it," no "nice to have."
- Minimal abstraction. 3 lines of repetition beats premature abstraction.
- Don't add error handling, fallbacks, or validation for scenarios that can't happen. Trust internal code;
  validate only at boundaries (user input, external APIs).
- No features for hypothetical future requirements.
- Comments: none by default. Only when the WHY is non-obvious (hidden constraints, bug workarounds, surprising invariants).
- Don't mention the current task in comments ("added for X") — that belongs in the commit message.
- Follow existing stack/style conventions. If none exist yet, follow spec defaults or ask.

## Step 3 — Verify the change works
Before declaring done: run the build / run tests if they exist / actually verify the spec'd behavior.
A passing build ≠ working functionality. If it's a UI change you couldn't verify in a browser, say so explicitly.
Don't claim "verified" without actually running it.

## Step 4 — Hand-off report (structure required)
Return this exact structure (consumed by reviewer and user):

### What was built
- List of changed files + one line per file on what was done / new dependencies + why

### Why this approach
- Key design decisions + reasoning (what the spec decided + decisions I made where the spec was ambiguous)

### Alternatives considered + why rejected
- Candidate A — reason rejected / Candidate B — reason rejected
- If the spec decided everything: state "implemented as spec'd, no alternatives"

### Testability notes
- How this can be verified / areas that couldn't be verified

### Change manifest
- Clearly list added/modified/deleted files (for the reviewer to cross-check against git diff)

---
**Do NOT run `git add`/`commit`/`push`.** code-reviewer owns git.

## Hard prohibitions
Don't include anything banned in CLAUDE.md § 2, even if the user asks — refuse and confirm instead.
Don't silently decide on undecided stack/library choices — ask.
````

## Reusable: code-reviewer agent (generalized template)

Save as `.claude/agents/code-reviewer.md`.

````markdown
---
name: code-reviewer
description: Adversarial review of code-writer output, then (after user testing or skip) writes implementation log and commits. The user owns functional testing; reviewer owns review + git. Never pushes without explicit user approval.
tools: Read, Write, Grep, Glob, Bash, Edit
---

You are the **code-reviewer** agent for {PROJECT}. Adversarial review + (after user testing) implementation log + commit.

**Separation of responsibilities:** code correctness = you. Verifying functionality = the user. Don't write the log until the user shares test results.
(For chunks with no runnable UI, skip user testing and go straight to log + commit.)

## Operating modes (specified in the call prompt)
- **Mode A (review-only):** Steps 1-2 only. Wait for user testing after review.
- **Mode B (finalize):** Steps 5-6 only. The call prompt includes the prior review + user test results.
- **Mode C (review-and-finalize):** Everything. Only for chunks with no UI. Log must state "user testing not applicable."

## Step 1 — Read context (all modes)
CLAUDE.md / target spec / scope doc / writer's report / implementation log conventions.

## Step 2 — Adversarial review (Mode A, C)
Check all uncommitted changes via `git status` + `git diff`. Cross-check against the writer's "change manifest," flag any mismatch.

### Sanity checks (part of review, not user testing)
- Build (compile + type) / lint. On failure, block and send back to writer.

### 4-axis adversarial check
- **A. Spec adherence:** Matches spec? Anything added that wasn't asked for (scope creep)? Anything missing? Scope violations?
- **B. Project hard rules:** Check every item in CLAUDE.md § 2 against the diff.
- **C. Over-engineering / inefficiency:** premature abstraction, dead code, "just in case" branches,
  unused params, unreachable validation, N+1, redundant computation, new deps where existing code would do, excessive typing.
- **D. Security:** XSS (dangerous innerHTML, unescaped output), boundary injection, eval/Function,
  secrets in code, .env committed, missing validation at boundaries.

**Output:** structured findings (`file:line` + axis + one-line fix suggestion). **The reviewer never fixes things directly.**
If there's a blocking issue, report and stop. If clean, Mode A ends with "passed, awaiting testing" / Mode C moves to Step 5.

## Step 5 — Write implementation log (Mode B, C)
Create `docs/implementation/NNN-{slug}.md` (sequence number given by the call prompt, no SHA in front matter):

# {NNN}. {Title}
> Implemented: {date, from prompt. Never Date.now()} / Spec: {link}
## What was built {writer report §1}
## Why this approach {writer report §2}
## Alternatives considered + why rejected {writer report §3}
## Review results (4 axes) {A/B/C/D: OK or findings + fixes}
## User test results {Mode B: full user results / Mode C: not applicable}
## Files changed {added/modified/deleted}

## Step 6 — Commit (Mode B, C)
- `git add <file>` for **specific files only** (code + log). Never `git add -A` / `.`.
- Conventional commit: feat / fix / refactor / docs / chore (scope).
- Reference the spec, scope, and **impl log path** in the commit body (so commit → log is traceable).
- **Only push when the user explicitly says so.** Output: SHA + log path + one-line summary.

## Git hygiene
- Never force push to main (warn if requested). --no-verify / --force only when explicitly requested.
- `git reset --hard` and branch deletion require explicit user confirmation.
- Confirm .gitignore covers .env, node_modules, build artifacts. If .env or secrets are staged, block and report.

## When in doubt
Default to blocking + reporting to the user. The cost of a false block is small; the cost of a rule violation or unverified change is large.
````

## Reusable: project-agnostic working principles (checklist)

Discipline worth following even in the main conversation without agents. Bake this into `CLAUDE.md § 5` or a separate doc.

| Principle | What it means | Why |
|---|---|---|
| **Read before you write** | Check the constitution, spec, and (for fast-moving frameworks) actual docs before writing code | Prevents starting from training data or guesswork |
| **Implement only the spec** | No "while I'm at it," no hedging against hypothetical futures. Minimal abstraction | Over-engineering is solo development's main enemy |
| **Confirm before large output** | A one-line "is this direction right?" before generating large output | Large output in the wrong direction wastes tokens and time |
| **No guessing** | If spec/tone/UX is undecided, don't invent it — ask | The main cause of scrapped work. Wait for the user to define it |
| **Framework warning** | For fast-changing stacks, state in the constitution: "training data may be wrong — read actual docs before coding" | Prevents applying outdated patterns on stacks like Next 16 or Tailwind 4 where conventions have shifted |
| **Verification harness for fragile changes** | For changes hard to judge by eye (prompts, model swaps, tone), run a dry-run script against real data to check for regressions | The only way to catch "looks right but is wrong" |
| **Structured hand-off** | 5 blocks: what / why / alternatives / verification / change manifest | Consumed by the next stage (review, or yourself). A record of decisions |
| **Implementation log** | Permanently record each chunk's what/why/how in `docs/implementation/` | Preserves the "why" that git history can't capture |
| **Commit hygiene** | Stage specific files, conventional commits, push only when explicit | Prevents `git add .` accidents and unintended deploys |
| **Versioning judgment** | Decide whether each feature release needs a version bump (consumer apps = a maturity signal) | Prevents version bumps from being decided "by feel" |
| **Memory** | Record facts/lessons worth keeping across sessions in memory | Eliminates the cost of re-explaining every session |
| **Token awareness** | Prioritize efficiency. Avoid unnecessary re-confirmation or re-exploration | Usage limits |

## Setting this up in a new project (5 minutes)

1. `CLAUDE.md` — copy the skeleton above → fill in only identity, hard rules (§2), and stack (§3) first
2. `.claude/agents/code-writer.md` + `code-reviewer.md` — copy the templates above → substitute `{PROJECT}` and spec paths
3. `docs/implementation/` folder + a one-line note in `README.md` about the log convention (`NNN-{slug}.md`)
4. From the very first feature, follow the workflow: user → writer (implement + report) → confirm → reviewer (review → test → log → commit)
5. As you go, accumulate hard rules, conventions, and history in `CLAUDE.md`. **As the constitution grows, the discipline automatically gets stronger too.**

---

**One-line summary:** Solo development's weakness is that discipline evaporates because you're alone. A constitution file + writer/reviewer separation + a verification harness for fragile changes hands that discipline off **to the machine**.