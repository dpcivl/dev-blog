---
title: "What I Added on Top of AstroPaper's Defaults — Running a Blog Like a Product"
description: "This blog didn't leave AstroPaper as-is — I've kept expanding it as a 'one-person content system that publishes daily.' Here's what problems I hit and how I turned them into tools: series pages (collapsible), playground, KR/EN i18n, Sonnet 5 translation automation pipeline, internal/external link checker, Mermaid local pre-rendering, Scratch/Inbox workflow, soft-hide convention for ended projects, security scrubbing guidelines, sidebar profile, collapsible hover effects, and more. Each feature follows a 3-part structure: 'what was missing in the default state → how I solved it → the result.' This is a living document that will keep expanding as new features are added."
pubDatetime: 2026-07-10T05:15:00Z
tags:
  - 블로그
  - astro
  - astropaper
  - 프로덕트
  - 기획
  - 개발방식
  - 살아있는-문서
draft: false
featured: true
---

This blog started on top of **[AstroPaper](https://github.com/satnaing/astro-paper)**, but I didn't leave it as-is. Starting in May 2026, I spent a bit over two months running **a one-person content system that publishes daily** and bolted on the features described below. Each item follows a 3-part structure: **"what was missing in AstroPaper's default state → how I solved it → the result."**

> **Why I'm writing this:** The code for this blog is public on [GitHub](https://github.com/dpcivl/dev-blog), but the **reasons behind these decisions** are scattered across commit messages with no single place to see them all. This document serves as that context log.
>
> **Living document** — as new features get added, I'll keep appending below. See the bottom for the last update info.

## Table of contents

## Starting point — AstroPaper is great, but wasn't enough as a personal product

**What AstroPaper does well:**

- Markdown-based static site, fast and SEO-friendly
- Built-in tags, search (Pagefind), RSS, archive
- Dark/light theme, clean typography
- Latest Astro 5, gentle framework learning curve

**But what I wanted was:**

- A place to accumulate daily learning logs → needed **topic-based series navigation**
- Domestic-focused, but getting foreign visitors via x/Google → needed **bilingual KR + EN support**
- Interactive content (terminology simulations) → needed a **playground** route
- Hiding ended projects/series without deleting them → needed a **soft-hide convention**
- Protection against mistakes that can't be undone after publishing → needed **security scrubbing, link checker, publish-time filter**
- Automating repetitive tasks → needed **translation, link, and Mermaid pipelines**

**Overall:** I started treating this blog not as "a site that stores posts" but as a **content publishing system**. I kept adding tools, conventions, and scripts to reduce friction in every publishing cycle.

## What I added (problem → solution mapping)

### 1. Series pages `/series` — collapsible

- **Problem**: AstroPaper is tag-based, but there was no flow for "I want to read this topic from the beginning, in order." Tag pages are chronological but lack a series' identity (title/description/episode count).
- **Solution**:
  - `src/pages/series/index.astro` — a hardcoded `SERIES` array defines `id`, `title`, `description`, and `tag`
  - Each series is filtered by tag → automatically incorporated into that series
  - **Collapse/expand** (`<details>/<summary>`) so 4 series don't eat up the whole page
  - The chevron rotates 90° and turns accent color when open
- **Result**: [LLM Study (19 posts)](/series), Backend Study, AGV Autonomous Driving, and Vibe Coding Terminology — 4 series compressed into one page. One click expands the episode list. Zero JS (just `<details>`).

### 2. Playground `/playground`

- **Problem**: When writing terminology explanation posts, I had to describe things like "this is the hover state, this is the disabled state" purely in text. Hard for readers to get a feel for it.
- **Solution**: Separated interactive pages into their own route `/playground/`
  - UI terminology playground (experience button states, animations, duration, easing via hover/click)
  - DB terminology playground (normalization Update Anomaly, B-tree search, transaction rollback simulation)
  - API design playground
- **Result**: Terminology posts now have a "[try it in the playground]" link below them — a combination of text plus interaction.

### 3. i18n — bilingual KR + EN

- **Problem**: Most visitors are domestic, but there's foreign traffic via x (Twitter) and Google search. Without English, they'd bounce.
- **Solution**:
  - Split content collections into `src/data/blog/ko/` and `src/data/blog/en/`
  - Mirror routes: `/en/posts/`, `/en/tags/`, `/en/about`
  - `hreflang` tags to signal language variants to search engines
  - Sidebar KO/EN switcher (highlights the current language)
  - A `getPath()` utility attaches/strips language prefixes from file paths
  - PostDetails, Tag, and Sidebar components detect language via `Astro.url.pathname` and auto-switch labels
- **Result**: One publish syncs both language sites. Publishing effort is only spent on KR — EN happens automatically (see #4 below).

### 4. Sonnet 5 translation automation pipeline

- **Problem**: Manually translating 42 KR posts into EN wasn't feasible. New posts also need EN immediately after publishing.
- **Solution**: A pipeline under `scripts/translate/`
  - **Model**: Claude Sonnet 5 (intro pricing $2/$10 per MTok)
  - **Prompt caching**: system prompt marked as cacheable → 90% savings on repeated calls
  - **6 validators** — code block count, link URLs, image paths, heading structure, HTML tags, length ratio
  - **Automatic anchor rewriting**: KR heading slugs (`#인터페이스--규격만-정하고-구현은-상속받는-쪽`) get automatically mapped to EN heading slugs (finds the heading at the same position and computes the slug)
  - **CLI**: `pnpm translate one <slug>`, `pnpm translate batch`
- **Result**: EN site stays automatically maintained at $0.05 per post. Total cost for all 44 translated posts is under $2. Consistent tone with automatic integrity checks for links/images.

### 5. Link checker — internal and external

- **Problem**: Refactoring slugs after publishing breaks old anchor links. External links go 404 over time (e.g., alistair.cockburn.us was deleted after a site redesign). The human eye can't catch these.
- **Solution**:
  - **`pnpm links`** (internal, ~1 sec): validates 5 axes — post/anchor/asset/tag/route
    - `/posts/x` — does the file exist?
    - `/posts/x#anchor` — does the heading slug match? (computed precisely via `github-slugger`)
    - `/assets/...` — does the file exist under public/?
    - `/tags/x` — is the tag actually used?
    - `/about`, `/portfolio`, `/playground` — does the route exist?
  - **`pnpm links:external`** (external, ~30 sec): HEAD request → falls back to GET on 405/403/501 → backoff retry × 2 on timeout/transient errors → bot-blocked hosts (st.com, ragas, etc.) get a warning instead of an error
- **Result**: The first run automatically found **13 broken anchors** (1 real KR error + 12 EN pipeline gaps) plus **1 external 404**. Since then, everything stays clean before each publish.

### 6. Mermaid local pre-rendering

- **Problem**: Adding `remark-mermaidjs` to the Astro pipeline caused **entire post bodies to disappear on Vercel deployment because Chromium failed to run** (100KB locally → 15KB live, only the H1 remained). It worked fine locally.
- **Solution**: `scripts/render-mermaid.mjs`
  - Generates SVGs locally using Playwright + `mermaid-isomorphic`
  - Filenames based on content SHA256 hash (first 16 chars) → `public/assets/mermaid/<hash>.svg`
  - Automatically rewrites ```` ```mermaid ```` blocks in MD into `<img src="/assets/mermaid/<hash>.svg" ...>`
  - Accessibility via a first-line `%% alt: ...` comment (mermaid treats `%%` as a comment, so it doesn't affect rendering)
  - Orphan detection (hash files with no references) plus `--gc` for cleanup
- **Result**: **Zero render delay for visitors, zero client-side JS.** Vercel never runs Chromium — it just serves images. This incident and the recovery process itself became a learning case that explains why this pipeline is necessary.

### 7. Scratch / Inbox workflow

- **Problem**: I kept losing track of where to put half-written notes and when to publish them. Managing the inbox as plain text made it impossible to see what had already been processed.
- **Solution**:
  - **`src/000-inbox.md`** — a repository for short notes. At the start of a session, Claude scans only the "pending" section and attempts to auto-publish. Processed items get struck through with a publish link and move to "done."
  - **`src/scratch/`** — long free-form notes. `.gitignored` (local only). Only processed on **explicit instruction** (e.g., "clean up scratch/X and publish it").
  - **`src/scratch/published/`** — an archive of completed publications, each tagged at the top with `<!-- 📤 Published: ... -->`.
- **Result**: A single `ls src/scratch/` shows what's still in progress and what's been published. Publishing friction dropped significantly.

### 8. Soft-hide convention for ended projects/posts

- **Problem**: Deleting a portfolio project once it ends kills its links, history, and search index. But leaving it visible creates the misconception that "is this still ongoing?"
- **Solution**: **`_` prefix filename convention**
  - Astro Content Collections glob loader pattern: `**/[^_]*.md`
  - Prefixing a file like `_edgebook.md` automatically excludes it from the collection
  - The file stays, only the page is hidden — reviving it later is just renaming the file back
  - Frontmatter preserves closure info too, via `status: paused` and `period: "2026-06-08 ~ 2026-06-19"`
- **Result**: Ended projects (EdgeBook) get hidden from the page without deletion. The record stays intact.

### 9. Publish-time filter — auto-excludes future pubDatetime

- **Problem**: Accidentally setting `pubDatetime` to a future time meant it showed up on the dev server but was silently hidden in production — leading to the mistaken belief that "it's published."
- **Solution**: The `isPublishTimePassed` filter in `src/utils/postFilter.ts` excludes future-dated posts from production builds.
- **Result**: Even mistakes never reach production deployment. Guards against the trap of checking the dev screen and assuming it's published.

### 10. Security scrubbing guidelines

- **Problem**: Since this is a public GitHub repo deployed on Vercel, exposing secrets, PII, or internal company URLs anywhere — post body, error logs, screenshots, frontmatter — can't be walked back once it's out.
- **Solution**: **`CLAUDE.md § 🔴 Security Scrubbing`**
  - An absolute-prohibition list (API keys, JWTs, OAuth secrets, Supabase URLs, card numbers, PII)
  - Pre-publish grep for suspicious patterns (32-character hex strings, `eyJ` prefixes, `sk-*`, near `Bearer`, etc.)
  - Remediation flow — **rotate the key first** if masking alone isn't enough
  - Principle for quoting notes: "read line by line, check whether it's okay for this to be exposed externally, then transfer it"
- **Result**: Not automated, but it forces a reminder at every publish. This guideline actually caught several issues during this very session.

### 11. Sidebar, Featured, and series tag system

- **Problem**: AstroPaper's default homepage is just a list of latest posts. No way to highlight flagship work. Series membership required manual tagging.
- **Solution**:
  - **`featured: true`** frontmatter → a separate section at the top of the homepage
  - **Sidebar profile** — avatar, name, role, socials (GitHub, email, RSS), language switcher, fixed on the left
  - **Series tags** — dedicated tags like `LLM공부`, `백엔드공부`, `AGV`, `용어정리` → the `/series` page auto-incorporates them
- **Result**: Content curation via convention alone, no manual editing. The top 5 flagship posts always sit at the top of the homepage.

### 12. Redesign — tone and rhythm

- **Problem**: Default AstroPaper is dark/minimal. No personal tone.
- **Solution**:
  - **Pretendard** font (CDN dynamic subsetting, for Korean readability)
  - Used collapse/expand (`<details>/<summary>`) not just for series but for long TOCs and expandable info
  - Hover effects (accent color transitions) for interaction rhythm
  - Design log (`docs/design-log.md`) — accumulates decisions by phase
- **Result**: Established a personal tone plus preserved decision history. Runs from Phase 1 (layout) through Phase 7 (i18n UI).

## Common principles

Four things run through all these features:

1. **Minimize publishing friction** — keep reducing the number of clicks and decisions from note to publish. The Inbox/Scratch workflow, translation automation, and Mermaid pre-rendering all fall on this axis.
2. **Guard against unrecoverable mistakes** — once something goes out on public git, it's hard to take back. Security scrubbing, the link checker, the pubDatetime filter, and the soft-hide convention for ended projects all fall on this axis.
3. **Substitute for the absent solo reviewer** — teams have reviewers, but a solo dev doesn't. Delegate to machines via validators, the link checker, and the [Claude Code two-agent workflow](/en/posts/solo-dev-kit-two-agent-workflow).
4. **Treat it as a reusable kit** — every feature is a combination of scripts and conventions. `.claude/agents/`, the `CLAUDE.md` skeleton, and the scripts under scripts/ are designed to be portable to other projects as-is.

## What's next (keep appending from here)

- **Automatic orphan image detection** — clean up unreferenced images under `public/assets/posts/`
- **Translating Mermaid labels in the translation pipeline** — currently even EN posts keep Mermaid diagram labels in KR (verbatim policy). Only alt text and descriptions get translated.
- **Playground expansion** — Java collections, Spring Boot request flow visualization, etc.
- **RSS category separation** — RSS feeds split by language and by series
- **Comments/subscription** — was considering Giscus. Low priority.

## About this document

- **First published**: 2026-07-10
- **Living document** — every time a new feature is added, I'll append it to the list above plus one line to the update log below
- **Source**: [`src/data/blog/ko/blog-beyond-astropaper-what-i-added.md`](https://github.com/dpcivl/dev-blog/blob/main/src/data/blog/ko/blog-beyond-astropaper-what-i-added.md)

### Update log

- **2026-07-10** — First version. 12 features documented (series, playground, i18n, translation automation, link checker, Mermaid, Scratch/Inbox, soft-hide, pubDatetime filter, security scrubbing, Featured/series tags, redesign)