---
title: "Beyond AstroPaper Defaults — Running a Blog Like a Product"
description: "This blog didn't stop at the default AstroPaper setup — I keep expanding it from the perspective of 'a one-person content system publishing daily.' Here's what problems I ran into and how I turned them into tools: series page (collapsible), playground, KR/EN i18n, Sonnet 5 translation automation pipeline, internal/external link checker, local Mermaid pre-rendering, Scratch/Inbox workflow, the soft-hide convention for ended projects, security scrubbing guidelines, sidebar profile, collapsible hover states, and more. Each feature follows a 3-part structure: 'What was missing in the default state → How I solved it → The result.' This is a living document, so it'll keep growing as I add new features."
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

This blog started on top of **[AstroPaper](https://github.com/satnaing/astro-paper)**, but I didn't leave it as-is. Starting from 2026-05, over about two months I kept running into problems and adding features, viewed through the lens of running **a one-person content system that publishes daily**. Each item below follows a 3-part structure: **"What was missing in the AstroPaper default state → How I solved it → The result."**

> **Why I'm writing this:** The code for this blog is public on [GitHub](https://github.com/dpcivl/dev-blog), but **why** I made these decisions is scattered across commit messages — there's no single place to see it all. This document is meant to be that context log.
>
> **Living document** — as new features get added, they get appended below. See the update log at the bottom for the latest changes.

## Table of contents

## Starting point — AstroPaper is great, but not enough as a personal product

**What AstroPaper does well:**

- Markdown-based static site, fast and SEO-friendly
- Tags · search (Pagefind) · RSS · archive built in
- Dark/light theme, clean typography
- Latest Astro 5, gentle framework learning curve

**But what I wanted:**

- A place to accumulate daily learning logs → I needed **topic-based series navigation**
- Mostly domestic traffic, but visitors coming in from X/Google searches too → **bilingual KR + EN**
- Interactive content (term simulations) → a **playground** route
- Hiding ended projects/series without deleting them → a **soft-hide convention**
- Protection against mistakes I can't take back after publishing → **security scrubbing, link checker, publish-time filter**
- Automating repetitive tasks → **translation, link, and Mermaid pipelines**

**Overall:** I stopped thinking of the blog as "a site that stores posts" and started thinking of it as **a content publishing system**. I kept adding tools, conventions, and scripts to reduce friction with every publishing cycle.

## What I added (mapping problems to solutions)

### 1. Series page `/series` — collapsible sections

- **Problem**: AstroPaper is tag-based, but there was no flow for "I want to read this topic in order, from the start." Tag pages are chronological, but they don't have a series identity (title/description/episode count).
- **Solution**:
  - `src/pages/series/index.astro` — a hardcoded `SERIES` array defines `id`, `title`, `description`, and `tag`
  - Each series filters by tag → posts are automatically pulled into that series
  - **Collapsible sections** (`<details>/<summary>`) so four series don't take over the whole page
  - The chevron rotates 90° and turns accent color when open
- **Result**: [LLM Study (19 posts)](/series), Backend Study, AGV Autonomous Driving, and Vibe Coding Terminology — four series compressed onto one page. One click expands the episode list. Zero JS (just `<details>`).

### 2. Playground `/playground`

- **Problem**: When writing term-explanation posts, I had to describe things like "this state is hover, this state is disabled" purely in text. Hard for readers to get an intuitive feel.
- **Solution**: Split off interactive pages into a separate `/playground/` route
  - UI terminology playground (experience button states, animations, duration, and easing via hover/click)
  - DB terminology playground (normalization update anomaly, B-tree search, transaction rollback simulation)
  - API design playground
- **Result**: Term explanation posts now link to "[try it in the playground]" below the text — a combination of text and interaction.

### 3. i18n — bilingual KR + EN

- **Problem**: Most visitors are domestic, but there's also inbound traffic from X (Twitter) and Google search from abroad. They'd bounce without English.
- **Solution**:
  - Split the content collection into `src/data/blog/ko/` and `src/data/blog/en/`
  - Mirror routes: `/en/posts/`, `/en/tags/`, `/en/about`
  - `hreflang` tags so search engines recognize language variants
  - Sidebar KO/EN switcher (highlights the current language)
  - A `getPath()` utility that adds/removes the language prefix based on file path
  - PostDetails, Tag, and Sidebar components detect the language from `Astro.url.pathname` → labels switch automatically
- **Result**: One publish syncs both language sites. I only have to write in KR — EN is automatic (see #4 below).

### 4. Sonnet 5 translation automation pipeline

- **Problem**: Manually translating 42 KR posts into EN wasn't feasible. New posts also need EN immediately after publishing.
- **Solution**: A pipeline under `scripts/translate/`
  - **Model**: Claude Sonnet 5 (intro pricing $2/$10 per MTok)
  - **Prompt caching**: mark the system prompt as cached → 90% savings on repeated calls
  - **6 validators** — code block count, link URLs, image paths, heading structure, HTML tags, length ratio
  - **Automatic anchor rewriting**: maps KR heading slugs (e.g. `#인터페이스--규격만-정하고-구현은-상속받는-쪽`) to EN heading slugs automatically (finds the heading at the same position and computes the slug)
  - **CLI**: `pnpm translate one <slug>` and `pnpm translate batch`
- **Result**: Keeps the EN site automatically in sync at $0.05 per post. Translating all 44 posts cost less than $2 total. Consistent tone with automated verification of link/image integrity.

### 5. Link checker — internal and external

- **Problem**: Refactoring a slug after publishing breaks old anchor links. External links go 404 over time (e.g., alistair.cockburn.us was removed after a site redesign). Human eyes miss these.
- **Solution**:
  - **`pnpm links`** (internal, ~1 second): validates 5 axes — post/anchor/asset/tag/route
    - `/posts/x` — does the file exist?
    - `/posts/x#anchor` — does the heading slug match? (computed exactly with `github-slugger`)
    - `/assets/...` — does the file exist under public/?
    - `/tags/x` — is the tag actually used?
    - `/about`, `/portfolio`, `/playground` — do the routes exist?
  - **`pnpm links:external`** (external, ~30 seconds): HEAD → falls back to GET on 405/403/501 → backoff retry ×2 on timeout/transient errors → hosts known to block bots (st.com, ragas, etc.) get a warning instead of an error
- **Result**: The first run found **13 broken anchors** (1 real KR error + 12 EN pipeline gaps) and **1 external 404**, automatically. Since then, everything stays clean before every publish.

### 6. Local Mermaid pre-rendering

- **Problem**: Adding `remark-mermaidjs` to the Astro pipeline caused **the entire post body to be lost on Vercel deploy because Chromium failed to run** (local build 100KB → live 15KB, only the H1 remained). It worked fine locally.
- **Solution**: `scripts/render-mermaid.mjs`
  - Generates SVGs locally using Playwright + `mermaid-isomorphic`
  - Filenames use the first 16 characters of the content's SHA256 hash → `public/assets/mermaid/<hash>.svg`
  - Automatically rewrites ```` ```mermaid ```` blocks in the markdown into `<img src="/assets/mermaid/<hash>.svg" ...>`
  - Accessibility via a first-line `%% alt: ...` comment (mermaid treats `%%` as a comment, so it doesn't affect rendering)
  - Orphan detection (hash files with no references) plus `--gc` to clean them up
- **Result**: **Zero render delay for visitors, zero client-side JS.** Vercel just serves images without running Chromium. This incident and the recovery process itself became a case study explaining why this pipeline is needed.

### 7. Scratch / Inbox workflow

- **Problem**: I kept getting confused about where to put half-written notes and when to publish them. Managing the inbox as plain text meant I couldn't see what had already been processed.
- **Solution**:
  - **`src/000-inbox.md`** — storage for short notes. At the start of a session, Claude scans only the "pending" section → attempts to auto-publish. Processed items get strikethrough plus a publish link, and move to the "done" section.
  - **`src/scratch/`** — long free-form notes. `.gitignored` (local only). Only processed on **explicit instruction** (e.g., "clean up scratch/X and publish it").
  - **`src/scratch/published/`** — archive of published items. Tagged at the top with `<!-- 📤 Published: ... -->`.
- **Result**: A single `ls src/scratch/` shows what's being drafted and what's been published. Publishing friction dropped a lot.

### 8. Soft-hide convention for ended projects/posts

- **Problem**: When a portfolio project ends, deleting it kills links, history, and the search index all at once. But leaving it visible causes people to wonder, "are they still doing this?"
- **Solution**: The **`_`-prefix filename convention**
  - Astro Content Collections glob loader pattern: `**/[^_]*.md`
  - Prefixing a file like `_edgebook.md` automatically excludes it from the collection
  - The file itself stays intact; only the page gets hidden — reviving it later is just a matter of renaming the file back
  - Frontmatter preserves end-of-project info with `status: paused` and `period: "2026-06-08 ~ 2026-06-19"`
- **Result**: An ended project (EdgeBook) is hidden from the page without being deleted. The history stays intact.

### 9. Publish-time filter — automatically excludes future pubDatetime

- **Problem**: Accidentally setting `pubDatetime` to a future date means it shows up on the dev server but gets silently hidden in production — leading to the mistaken belief that it's "published."
- **Solution**: An `isPublishTimePassed` filter in `src/utils/postFilter.ts` excludes future-dated posts in production builds.
- **Result**: Even if I make this mistake, it never reaches production. Protects against the trap of checking the dev screen and assuming it's published.

### 10. Security scrubbing guidelines

- **Problem**: Since this is a public GitHub repo deployed on Vercel, any secrets, PII, or internal URLs exposed anywhere — post body, error logs, screenshots, frontmatter — can't be pulled back once they're out.
- **Solution**: **`CLAUDE.md § 🔴 Security Scrubbing`**
  - An absolute-prohibition list (API keys, JWTs, OAuth secrets, Supabase URLs, card numbers, PII)
  - Pre-publish grep patterns to watch for (32-char hex, `eyJ` prefix, `sk-*`, near "Bearer," etc.)
  - Response flow — if masking alone isn't enough, **reissue the key first**
  - A principle for quoting notes: "read line by line, check whether it's okay for this to be exposed externally, and only then copy it over"
- **Result**: Not automated, but it forces a reminder at every publish. During this very session, this guideline actually caught a few issues.

### 11. Sidebar, Featured, and series-tag system

- **Problem**: By default, AstroPaper's home page is just a list of the latest posts. There was no way to highlight flagship work. Series membership was manual tagging.
- **Solution**:
  - **`featured: true`** frontmatter → a dedicated section at the top of the homepage
  - **Sidebar profile** — avatar, name, role, socials (GitHub, email, RSS), and language switcher pinned to the left
  - **Series tags** — dedicated tags like `LLM공부`, `백엔드공부`, `AGV`, `용어정리` → the `/series` page automatically pulls them in
- **Result**: Content curation through convention alone, no manual editing needed. Five flagship posts always stay at the top of the homepage.

### 12. Redesign — tone and rhythm

- **Problem**: Default AstroPaper is dark and minimal. It had no personal tone.
- **Solution**:
  - **Pretendard** font (CDN dynamic subsetting, good Korean readability)
  - Collapsible sections (`<details>/<summary>`) used not just for series, but for long TOCs and expandable info
  - Hover effects (accent color transitions) for interaction rhythm
  - Design log (`docs/design-log.md`) — accumulates decisions by phase
- **Result**: Established a personal tone while preserving decision history. It's carried forward from Phase 1 (layout) to Phase 7 (i18n UI).

### 13. SEO improvements — branching JSON-LD structured data by page type

- **Problem**: By default, every page emitted `@type: BlogPosting` JSON-LD. The homepage, series pages, and tag pages were all incorrectly marked as "blog posts." Standard fields like `description`, `publisher`, `mainEntityOfPage`, and `inLanguage` were also missing.
- **Solution**: Branch `structuredData` in `src/layouts/Layout.astro` based on page type
  - Posts (has `pubDatetime`) → **BlogPosting** with added `description`, `url`, `mainEntityOfPage`, `inLanguage`, and `publisher` fields
  - Everything else (no `pubDatetime`) → **WebSite** schema
- **Result**: Google's rich snippets now correctly recognize author, publish date, and language. Fixed the issue where the homepage was incorrectly marked as an article.

### 14. Perf — image lazy loading + PNG → WebP + font preload

Three optimizations at once:

- **Problem**: Screenshot-heavy posts had heavy initial page loads (`public/assets/posts/` totaled 62 MB). On archive/tag pages, list scrolling loaded off-screen images immediately. The Pretendard CSS was render-blocking.
- **Solution**:
  - A **custom rehype plugin** ([`src/plugins/rehype-image-perf.mjs`](https://github.com/dpcivl/dev-blog/blob/main/src/plugins/rehype-image-perf.mjs)) — the first image gets `loading="eager" fetchpriority="high"` (LCP candidate), the rest get `loading="lazy" decoding="async"`
  - **`pnpm images:webp`** — a script that batch-converts PNG to WebP using sharp. Only replaces when WebP is actually smaller (some small screenshots compress better as PNG), auto-updates image URLs in markdown, deletes the originals
  - **`<link rel="preload">`** for the Pretendard CSS to fetch the font CSS early → reduces render blocking
- **Result**: `public/assets/posts/` went **from 62 MB to 15 MB (75% reduction, 61 images converted)**. Off-screen images on list/tag pages now lazy load during scrolling → improved first paint. LCP candidate images still keep priority.

### 15. Post-bottom feedback CTA — a channel without a comments system

- **Problem**: This is a learning-log blog, so there isn't enough interaction pressure to justify a full comments system. But the About page isn't linked from the nav, sidebar, or footer — it functions as a resume / portfolio landing accessed only via a direct URL. That left visitors with only a small email icon in the sidebar as a way to point out errors or suggest additions. The icon is easy to miss.
- **Solution**: [`src/components/Feedback.astro`](https://github.com/dpcivl/dev-blog/blob/main/src/components/Feedback.astro) — a dashed-border box at the bottom of every post with exactly two parallel actions.
  - **① Email pill (click to copy)** — the email address itself is the button. Clipboard API + "Copied!" visual feedback (accent background swap + check icon), with a text-selection fallback if the API is unavailable. The pattern GitHub / Vercel / Notion use.
  - **② Open a GitHub Issue** (title pre-filled)
  - `mailto:` was intentionally dropped because a large share of Korean users don't have it wired up. Gmail compose URL was kept briefly, then removed — Naver/Kakao mail users can't use it, and Gmail users end up copy-pasting anyway, so the button was UI redundancy.
  - i18n aware (KO/EN copy branches). Intro copy: "Questions, comments, or a different take — welcome" — active framing that invites both positive and negative signals.
- **Result**: A real feedback channel without the JS overhead, spam, moderation, or ghost-town issues of a comments system. Zero performance regression. Visitors explicitly see "this is where you talk to the author."
- **Note**: Comments (giscus etc.) get re-evaluated once traffic grows and real feedback pressure appears. For now the CTA alone is judged enough.

## Common principles

Four things run through all of these features:

1. **Minimize publishing friction** — keep reducing the number of clicks and decisions between a note and a published post. The Inbox/Scratch workflow, translation automation, and Mermaid pre-rendering all serve this.
2. **Guard against mistakes you can't take back** — once something is out in a public git repo, it's hard to undo. Security scrubbing, the link checker, the pubDatetime filter, and the soft-hide convention for ended projects all serve this.
3. **Substitute for the missing solo reviewer** — teams have reviewers; a one-person operation doesn't. I delegate to machines through validators, the link checker, and the [Claude Code two-agent workflow](/en/posts/solo-dev-kit-two-agent-workflow).
4. **Think in terms of a reusable kit** — every feature is a combination of a script plus a convention. `.claude/agents/`, the `CLAUDE.md` skeleton, and the scripts under scripts/ are designed to be portable to other projects as-is.

## What's next (keeps getting appended here)

- **Automatic orphan image detection** — cleaning up images under `public/assets/posts/` that no references point to
- **Translating mermaid labels in the pipeline** — currently EN posts still keep mermaid diagram labels in KR (verbatim policy). Only alt text and descriptions get translated
- **Expanding the playground** — Java collections, Spring Boot request flow visualization, etc.
- **Splitting RSS by category** — RSS feeds by language, by series
- **Comments/subscription** — was considering Giscus. Low priority for now.

## About this document

- **First published**: 2026-07-10
- **Living document** — every time a new feature is added, it gets appended to the list above plus a one-line update log entry below
- **Source**: [`src/data/blog/ko/blog-beyond-astropaper-what-i-added.md`](https://github.com/dpcivl/dev-blog/blob/main/src/data/blog/ko/blog-beyond-astropaper-what-i-added.md)

### Update log

- **2026-07-10** — First edition. Covered 12 features (series, playground, i18n, translation automation, link checker, Mermaid, Scratch/Inbox, soft-hide, pubDatetime filter, security scrubbing, Featured/series tags, redesign)
- **2026-07-10** (2nd) — Added SEO improvements (JSON-LD branching by page type, standard field additions) and 3 performance items (rehype image lazy loading, PNG → WebP script, Pretendard CSS preload). Also replaced the README from the original AstroPaper version with a custom one.
- **2026-07-10** (3rd) — Added the post-bottom feedback CTA (`Feedback.astro`). Provides a real channel via email + GitHub Issues without adopting a comments system.
- **2026-07-10** (4th) — Reworked the feedback CTA UX for Korean users. Dropped `mailto:` in favor of three tracks: "Copy address" (Clipboard API), "Open in Gmail", and "Open a GitHub Issue." Email address is shown inline as text with `user-select: all` so a single click selects the whole address. Also created `docs/analytics-log.md` (first 30-day snapshot: 168 visitors, 7.8 pages/visitor, 45% bounce).
- **2026-07-10** (5th) — Slimmed the feedback CTA. Fewer options per Hick's law. The email pill itself is now the copy button (GitHub / Vercel / Notion standard pattern), with a copy icon that swaps to a check icon on success. Removed the Gmail button, the standalone copy button, and the "Email" label. Intro copy switched from a defensive "corrections/additions" framing to an active "Questions, comments, or a different take — welcome."