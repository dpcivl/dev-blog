---
title: "What I Added Beyond AstroPaper Defaults — Running a Blog Like a Product"
description: "This blog doesn't leave AstroPaper as-is — I keep expanding it from the perspective of a 'daily-publishing solo content system.' A record of what problems I hit and how I turned them into tools — series page (collapsible) · playground · KR/EN i18n · Sonnet 5 translation automation pipeline · internal/external link checker · local Mermaid pre-rendering · Scratch/Inbox workflow · convention for auto-hiding ended projects · security scrubbing guidelines · post-hoc markdown validator · editorial redesign that removed the sidebar · a publishing heatmap that updates daily on a static site · outcome-first portfolio cards. Each feature follows a 3-part structure: 'what was missing in the default state → how I solved it → the result.' A living document, so it will keep expanding as new features are added."
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

This blog started from **[AstroPaper](https://github.com/satnaing/astro-paper)**, but I didn't leave it as-is. Starting from 2026-05, over roughly three months of running it as a **daily-publishing solo content system**, I've been running into problems and bolting on features. Each item follows a **"what was missing in the default AstroPaper state → how I solved it → the result"** structure.

> **Why I'm writing this:** The code for this blog is public on [GitHub](https://github.com/dpcivl/dev-blog), but **why I made these particular decisions** is scattered across commit messages, with no way to see it all at once. This document is meant to be that context log.
>
> **Living document** — as new features get added, I'll keep appending below. See the bottom for the latest update info.

## Table of contents

## Starting point — AstroPaper is great, but wasn't enough as a personal product

**What AstroPaper does well:**

- A markdown-based static site, fast and SEO-friendly
- Tags · search (Pagefind) · RSS · archive built in
- Dark/light theme, clean typography
- Latest Astro 5, gentle framework learning curve

**But what I wanted:**

- A place to build up daily learning logs → I needed **topic-based series browsing**
- Domestic-focused but getting foreign visitors via x/Google → **KR + EN bilingual support**
- Interactive content (term simulations) → a **playground** route
- Hiding ended projects/series without deleting them → a **soft-hide convention**
- Protection against irreversible mistakes after publishing → **security scrubbing · link checker · publish-time filter**
- Automating repetitive work → **translation · link · Mermaid pipelines**

**Overall:** I stopped thinking of the blog as "a site that stores posts" and started treating it as a **content publishing system**. I kept layering on tools · conventions · scripts to reduce friction in every publishing cycle.

## What I've added (problem → solution mapping)

### 1. Series page `/series` — collapsible

- **Problem**: AstroPaper is tag-based, but there was no flow for "I want to read this topic from the start, in order." Tag pages are chronological but have no series identity (title/description/episode count).
- **Solution**:
  - `src/pages/series/index.astro` — a hardcoded `SERIES` array defines `id` · `title` · `description` · `tag`
  - Each series filters by tag → posts automatically join that series
  - **Collapsible** (`<details>/<summary>`) so the 4 series don't eat up the whole page
  - The chevron rotates 90° and turns accent color when open
- **Result**: [LLM Study (19 posts)](/series) · Backend Study · AGV autonomous driving · Vibe-coding terminology — 4 series compressed onto one page. One click expands the episode list. Zero JS (just `<details>`)

### 2. Playground `/playground`

- **Problem**: When writing a term-explanation post, I had to describe things like "this is the hover state, this is disabled" purely in text. Hard for readers to get a feel for it.
- **Solution**: Split interactive pages into a separate `/playground/` route
  - UI terminology playground (button states · animation · duration · easing, experienced via hover/click)
  - DB terminology playground (normalization Update Anomaly · B-tree search · transaction rollback simulation)
  - API design playground
- **Result**: A terminology post has a "[try it in the playground]" link below it → text + interaction combined

### 3. i18n — KR + EN bilingual

- **Problem**: Most visitors are domestic, but there's foreign traffic via x (Twitter) plus Google search inflow. Without English, they bounce.
- **Solution**:
  - Split the content collection into `src/data/blog/ko/` + `src/data/blog/en/`
  - Mirrored routes: `/en/posts/`, `/en/tags/`, `/en/about`
  - `hreflang` tags to signal language variants to search engines
  - A KO/EN switcher in the sidebar (highlighting the current language)
  - A `getPath()` utility attaches/strips the language prefix from file paths
  - PostDetails · Tag · Sidebar components detect language via `Astro.url.pathname` → labels switch automatically
- **Result**: One publish syncs both language sites. Publishing effort only goes into KR. EN is automatic (see #4 below).

### 4. Sonnet 5 translation automation pipeline

- **Problem**: Manually translating 42 KR posts into EN was impossible. New posts also need EN immediately upon publishing.
- **Solution**: A pipeline under `scripts/translate/`
  - **Model**: Claude Sonnet 5 (intro pricing $2/$10 per MTok)
  - **Prompt caching**: mark the system prompt as cached → 90% savings on repeated calls
  - **6 validators** — code block count · link URLs · image paths · heading structure · HTML tags · length ratio
  - **Automatic anchor rewriting**: maps KR heading slugs (`#인터페이스--규격만-정하고-구현은-상속받는-쪽`) to EN heading slugs automatically (finds the heading at the same position and computes the slug)
  - **CLI**: `pnpm translate one <slug>` · `pnpm translate batch`
- **Result**: Keeps the EN site automatically maintained at $0.05 per post. Under $2 total for 44 translated posts. Consistent tone with automatic verification of link/image integrity.

### 5. Link checker — internal + external

- **Problem**: Refactoring slugs after publishing breaks old anchor links. External links go 404 over time (e.g. deleted after alistair.cockburn.us was restructured). Human eyes can't catch these.
- **Solution**:
  - **`pnpm links`** (internal, ~1 second): verifies across 5 axes — post/anchor/asset/tag/route
    - `/posts/x` — does the file exist?
    - `/posts/x#anchor` — does the heading slug match? (computed exactly with `github-slugger`)
    - `/assets/...` — does the file exist under public/?
    - `/tags/x` — is the tag actually used?
    - `/about`, `/portfolio`, `/playground` — does the route exist?
  - **`pnpm links:external`** (external, ~30 seconds): HEAD → falls back to GET on 405/403/501 → backoff retry × 2 on timeout/transient failures → bot-blocked hosts (st.com, ragas, etc.) get a warn instead of an error
- **Result**: The first run automatically found **13 broken anchors** (1 real KR error + 12 EN pipeline gaps) and **1 external 404**. Stays clean before every publish since.

### 6. Local Mermaid pre-rendering

- **Problem**: I added `remark-mermaidjs` to the Astro pipeline, and **the body content was silently lost on Vercel deploys because Chromium failed to run** (100KB locally vs 15KB live, leaving only the H1). Worked fine locally.
- **Solution**: `scripts/render-mermaid.mjs`
  - Generates SVGs locally with Playwright + `mermaid-isomorphic`
  - File names come from the content's SHA256 hash (first 16 chars) → `public/assets/mermaid/<hash>.svg`
  - Automatically rewrites ```` ```mermaid ```` blocks in the MD into `<img src="/assets/mermaid/<hash>.svg" ...>`
  - Accessibility via a first-line `%% alt: ...` comment (mermaid treats `%%` as a comment, so it doesn't affect rendering)
  - Orphan detection (hash files with no references) + cleanup via `--gc`
- **Result**: **Zero render delay for visitors, zero client-side JS.** Vercel just serves images without running Chromium. This incident and its recovery process itself became a learning case that explains why this pipeline is needed.

### 7. Scratch / Inbox workflow

- **Problem**: I kept getting confused about where to put half-written notes and when to publish them. Managing the inbox as plain text made it impossible to see what had already been processed.
- **Solution**:
  - **`src/000-inbox.md`** — a store for short notes. At the start of a session, Claude scans only the "pending" section → attempts to auto-publish. Processed items get moved to "done," with strikethrough and a link to the published post.
  - **`src/scratch/`** — long free-form notes. `.gitignored` (local only). Only processed on **explicit instruction** (e.g. "clean up scratch/X and publish it").
  - **`src/scratch/published/`** — archive of published items. Tagged with `<!-- 📤 Published: ... -->` at the top.
- **Result**: A single `ls src/scratch/` shows "what's in progress vs. what's published." Publishing friction dropped substantially.

### 8. Soft-hide convention for ended projects/posts

- **Problem**: Deleting a portfolio project when it ends kills its links · history · search index. But leaving it visible causes confusion — "is this still active?"
- **Solution**: **`_`-prefix filename convention**
  - Astro Content Collections glob loader pattern: `**/[^_]*.md`
  - Prefixing a file, e.g. `_edgebook.md`, automatically excludes it from the collection
  - The file stays, only the page gets hidden → reviving it later is just renaming the file back
  - Frontmatter preserves the end info with `status: paused` + `period: "2026-06-08 ~ 2026-06-19"`
- **Result**: An ended project (EdgeBook) is hidden from the page without deletion. The record stays intact.

### 9. Publish-time filter — automatically excluding future pubDatetime

- **Problem**: Accidentally setting `pubDatetime` to the future makes the post visible in the dev server but silently hidden in production — a "I thought I published it" trap.
- **Solution**: The `isPublishTimePassed` filter in `src/utils/postFilter.ts` excludes future-dated posts from production builds
- **Result**: Even a mistake never reaches production. Protects against the trap of checking the dev view and assuming it's published.

### 10. Security scrubbing guidelines

- **Problem**: Since this is a public GitHub repo + Vercel deployment, once a secret · PII · internal URL leaks anywhere — body text, error logs, screenshots, frontmatter — there's no way to pull it back immediately.
- **Solution**: **`CLAUDE.md § 🔴 Security Scrubbing`**
  - An absolute-forbidden list (API keys · JWTs · OAuth secrets · Supabase URLs · card numbers · PII)
  - Pre-publish grep patterns to check (32-char hex, `eyJ` prefix, `sk-*`, near `Bearer`, etc.)
  - A response flow — **rotate the key first** if masking alone isn't enough
  - A note-quoting principle: "read line by line, checking whether it's okay for this to be exposed externally, before copying it over"
- **Result**: Not automated, but it forces a reminder before every publish. This guideline actually caught a few issues during this session.

### 11. Sidebar · Featured · series tag system

- **Problem**: By default, AstroPaper's home page is just a list of the latest posts. No way to highlight representative work. Series membership was manual tagging.
- **Solution**:
  - **`featured: true`** frontmatter → a dedicated section at the top of the home page
  - **Sidebar profile** — avatar · name · role · socials (GitHub · email · RSS) · language switcher fixed on the left
  - **Series tags** — dedicated tags like `LLM공부` · `백엔드공부` · `AGV` · `용어정리` → automatically join the `/series` page
- **Result**: Content curation via convention alone, no editing required. The top 5 representative posts always sit at the top of the home page.
- **Later change (2026-07-27)**: The sidebar and Featured section were **removed in #17.** Only the series tag system remains; the profile moved to the home hero, and the language switcher moved to the header.

### 12. Redesign — tone and rhythm

- **Problem**: Default AstroPaper is dark/minimal. No personal tone.
- **Solution**:
  - **Pretendard** font (dynamic CDN subsetting, for Korean readability)
  - Used collapsible (`<details>/<summary>`) for long TOCs and expandable info, not just series
  - Hover effects (accent color transitions) for interaction rhythm
  - A design log (`docs/design-log.md`) — accumulating decisions by phase
- **Result**: Established a personal tone plus a preserved history of decisions. Phase 1 (layout) led on through Phase 7 (i18n UI).

### 13. Stronger SEO — branching JSON-LD structured data by page type

- **Problem**: By default, every page emitted `@type: BlogPosting` JSON-LD. The home page · series · tag pages were incorrectly marked as "blog posts" too. Standard fields like `description` · `publisher` · `mainEntityOfPage` · `inLanguage` were also missing.
- **Solution**: Branch `structuredData` in `src/layouts/Layout.astro` by page type
  - Posts (has `pubDatetime`) → **BlogPosting** + added `description` · `url` · `mainEntityOfPage` · `inLanguage` · `publisher` fields
  - Everything else (no `pubDatetime`) → **WebSite** schema
- **Result**: Google rich snippets correctly recognize author · publish date · language. Fixed the issue of the home page being mismarked as an article.

### 14. Perf — image lazy loading + PNG → WebP + font preload

Optimized on three fronts at once:

- **Problem**: Initial page load was heavy on screenshot-heavy posts (`public/assets/posts/` totaling 62 MB). On archive/tag pages, images outside the viewport loaded immediately during list scrolling. The Pretendard CSS was render-blocking.
- **Solution**:
  - A **custom rehype plugin** ([`src/plugins/rehype-image-perf.mjs`](https://github.com/dpcivl/dev-blog/blob/main/src/plugins/rehype-image-perf.mjs)) — the first image gets `loading="eager" fetchpriority="high"` (LCP candidate), everything else gets `loading="lazy" decoding="async"`
  - **`pnpm images:webp`** — a script that batch-converts PNG → WebP with sharp. Only swaps when WebP is smaller (some small screenshots actually compress better as PNG), auto-updates image URLs in MD, deletes originals
  - **`<link rel="preload">`** for the Pretendard CSS → gets the font CSS fetched earlier, easing render blocking
- **Result**: `public/assets/posts/` went from **62 MB → 15 MB (75% reduction, 61 conversions)**. Off-screen images now lazy-load during list/tag page scrolling → improved first paint. LCP-candidate images still keep priority.

### 15. A feedback CTA below posts — channels without a comment system

- **Problem**: This blog reads like a learning journal, so there's not enough interaction pressure to justify bolting on a comment section. But the About page isn't linked from nav, sidebar, or footer anywhere, so it effectively only functions as a resume/hiring landing page, and visitors had exactly one avenue to point out errors or add supplementary opinions — a single sidebar email icon. The icon is small and easy to miss.
- **Solution**: [`src/components/Feedback.astro`](https://github.com/dpcivl/dev-blog/blob/main/src/components/Feedback.astro) — a dashed-border box at the bottom of each post. Just two actions placed side by side.
  - **① Email pill (click = copy)** — the email address itself is the button. Clipboard API + a "Copied!" visual response (accent-inverted background + check icon) · text-selection fallback on failure. The standard pattern used by GitHub · Vercel · Notion.
  - **② Open a GitHub Issue** (with a prefilled title)
  - `mailto:` was excluded since a large share of domestic users don't use it. A Gmail compose URL was included at first and then removed — it's meaningless for Naver/Kakao mail users, and even Gmail users end up naturally copying and pasting, making it a redundant UI.
  - Handles i18n (KO/EN copy branching). The intro copy is "Questions, comments, and other perspectives welcome" — an active-voice signal inviting both negative and positive feedback.
- **Result**: Got a real feedback channel without a comment system's JS load · spam · moderation · ghost-town problems. Zero performance cost. Visitors now explicitly recognize "there's a place to talk to the author here."
- **Note**: Comments (giscus, etc.) will be reconsidered once traffic and real feedback pressure build up. For now, a CTA is judged to be enough.

### 16. Post-hoc markdown validator — detecting accidental strikethrough

- **Problem**: The GFM parser was misparsing tildes in numeric ranges like `~1.5~2주` as strikethrough (`~text~`), striking through actual text. Found in 3 published posts (`claude-api-streaming-ttft-and-events` · `fems-project-log-01` · `rag-from-scratch-embedding-and-similarity-search`) — the kind of thing that used to be caught only by eye, so it needed systematic detection.
- **Solution**:
  - **Convention**: Use an en dash `–` for numeric ranges (e.g. `1~2일` → `1–2일`). Rewrite leading approximate `~` as `약` (e.g. `~1.5초` → `약 1.5초`). Tildes are excluded from the body entirely at the source.
  - **Validator**: Added `detectAccidentalStrikethrough(text)` to [`scripts/translate/validate.mjs`](https://github.com/dpcivl/dev-blog/blob/main/scripts/translate/validate.mjs). Excludes code blocks · inline code · intentional `~~strike~~`, then scans for single-tilde pairs. Returns line numbers and snippets.
  - **Translation pipeline integration**: `validateAll(kr, en)` runs it against both KR and EN. Reports with `[KO]` · `[EN]` prefixes. Auto-detects immediately after translation.
  - **Standalone audit**: [`scripts/check-markdown.mjs`](https://github.com/dpcivl/dev-blog/blob/main/scripts/check-markdown.mjs) + `pnpm check:md` — scans all published posts in bulk. Exit codes (0/1) suitable for CI integration.
- **Result**: Scanning all 108 files → automatically found and fixed the tilde misparsing in 3 existing published posts. Auto-detected going forward for future translations. Preserves newlines when stripping code blocks (`m.replace(/[^\n]/g, " ")`) so line numbers stay aligned with the actual file, for correct line-number reporting.

### 17. Editorial redesign — removing the sidebar, moving to a single column

- **Problem**: The 220px profile sidebar on the left **repeated the same info on every page** while narrowing the body width. The bigger problem was the home page. It jumped straight into the latest post list, with **no sentence on the first screen saying "what does this person do."** Many descriptions ran over 200 characters, so 3 cards ate up the whole screen, and the actual asset of this blog — "how consistently I write" — was nowhere to be seen.
- **Solution**:
  - Switched to a **single-column `page-narrow`** (max-w-5xl). Deleted `Sidebar.astro` and the `page-grid` utility. Applied to the home page · portfolio · `/posts` · `/tags` · `/archives` · `/series` · `/playground` · `/404` · post detail pages · About — all of them.
  - **Unified the left edge baseline** — the breadcrumb · back button used `app-layout` (max-w-3xl, centered) while the body used max-w-5xl, so the left edges didn't line up. Moved both to the same container, and for long post pages, constrained the body column to **left-aligned + `max-w-app` (48rem) instead of centered**. Opening the full 5xl width makes a single line of Korean 1088px wide, which wrecks readability.
  - **Reworked the header** — logo shrunk from 36px to 26px + a `PARKHYO.IN` wordmark, nav shrunk with a hover underline, icons went from 24px to 17px. **Moved the KO/EN switcher from the sidebar to the header** (also rewired the counterpart-page override path in post details).
  - **Turned the home post list into a single-line index** — `date | title | series` (`PostRow.astro`). Went from showing 3 posts to 8. Retired the Featured section; `featured: true` now shows only as a ★ in the list. The list page (`/posts`) still keeps cards, since that's a browse-and-pick screen.
  - **Korean line breaking** — the repo had no `word-break` setting, so words like `자세한` were splitting into `자` / `세한`. Added `word-break: keep-all` + `overflow-wrap: break-word` on `body` (keep-all alone lets long URLs overflow).
- **Result**: The h1 and body's left edges now line up at exactly 139px across 8 pages at a 1280px viewport. Zero horizontal overflow at 375px. The profile photo and name now only remain on the home hero and About page; on other pages, the header wordmark takes over that role.

### 18. Publish grass — making it move daily on a static site

- **Problem**: I added a GitHub-style publish heatmap to the home page, but it was **stuck on August 1st.** That's because on a static site, "today" gets baked into the HTML at build time. If the last deploy was on 7/30, it's pinned to that Saturday and never moves again unless a new post ships. GitHub doesn't have this problem because the server draws it fresh on every request.
- **Solution**:
  - **Date computation moved to the browser** — I embed a map containing only dates with actual publishes (`{ "2026-07-30": 2, ... }`, ~700 bytes for 38 days) via `data-counts`, and on load, recompute the window based on the visitor's current time, refreshing cell levels · tooltips · `aria-label`s · the period summary. **It advances daily without a redeploy.**
  - **Date keys pinned to KST** — the server aggregation (`SITE.timezone`) and the client need to use the same baseline, or the publish calendar would shift a day off for overseas visitors.
  - **The last cell is today** — I initially drew all the way through that week's Saturday to fill a 7-row grid, but that meant dates that hadn't happened yet got rendered as "0 posts" cells, with tooltips showing `2026-08-08 · 0 posts`. That's showing "hasn't happened" as "wasn't published," which is wrong. Even if the last column ends up shorter, it should stop at today.
  - **Synchronized cell count** — the number of cells the server drew and the number at the visitor's current time can differ (fluctuating between 91–97 due to week alignment), so the script duplicates/removes cells to match. Without this, the last few days would get cut off whenever the deploy was stale.
  - **The legend matches the actual number of levels** — I drew 5 boxes, but the level mapping skipped 1, so the actual data only used four levels: 0 · 2 · 3 · 4. An unused color was sitting in the legend.
- **Result**: A rolling 90-day window. When I faked `Date` forward by 30 days to test, the window shifted along with it and totals recalculated (numbers can drop since older posts fall out of the window). Visitors with JS disabled see the build-time window — I left the server-rendered values in place, so it never renders blank.

### 19. Portfolio restructuring — outcome-first cards and publication criteria

- **Problem**: Portfolio cards were `<dl>` definition lists listing period / role / tech / description, which meant **measured results (mAP 85.50%, LoRa 2km) were buried inside description paragraphs.** But numbers are what recruiters actually scan for. There was also no publication criteria, so a project with only a repo link sat at the same weight as a deployed product.
- **Solution**:
  - **Replaced with case blocks** — a 2-column layout: narrative on the left + metrics (large type for measured values) on the right. The career section uses a sticky timeline on the left + a 3-column outcome card grid + a 2-column responsibilities table on the right.
  - **Extended the schema** — added `highlight { value, label }`, turned `responsibilities` into `{ k, v }` objects and `outcomes` into an array of `{ value, label }` objects. Legacy strings are still accepted via `z.union` and normalized in the renderer.
  - **Publication criteria** — only projects with a **reachable live site** are shown on `/portfolio`. Projects with only a repo link are hidden with the `_` prefix (files preserved). Locked this criterion into `CLAUDE.md` as a rule.
  - **Intake template** ([`docs/portfolio-intake.md`](https://github.com/dpcivl/dev-blog/blob/main/docs/portfolio-intake.md)) — a prompt for gathering new project info by **pasting it into that project's own Claude session.** The blog session can't see that repo, but the project's own session can check commits · logs · configs directly. The prompt-level rules enforce no promotional language · **numbers must come with measurement conditions** · no secrets.
- **Result**: Cards now read numbers first. The "numbers must come with measurement conditions" rule actually paid off — one performance improvement figure turned out to be a lab-projected value while the measured value was much lower. Presenting it in large type without the condition would have been an exaggeration.

## Common principles

Four things run through all these features:

1. **Minimize publishing friction** — keep reducing the number of clicks and decisions from note to publish. The Inbox/Scratch workflow · translation automation · Mermaid pre-rendering are all on this axis.
2. **Guard against irreversible mistakes** — once something goes out on a public git repo, it's hard to pull back. Security scrubbing · link checker · pubDatetime filter · soft-hiding ended projects are all on this axis.
3. **Substitute for a missing solo reviewer** — teams have reviewers; a solo dev doesn't. Delegate to machines via validators · link checkers · [Claude Code's 2-agent workflow](/en/posts/solo-dev-kit-two-agent-workflow).
4. **A reusable-kit mindset** — every feature is a script + convention pair. Designed so `.claude/agents/` · the `CLAUDE.md` skeleton · scripts under `scripts/` can be carried over to other projects as-is.

## What's next (keep appending from here)

- **Automatic orphan image detection** — cleaning up unreferenced images under `public/assets/posts/`
- **Mermaid label translation in the translation pipeline** — currently EN posts still have Mermaid diagram labels in KR (verbatim policy). Only alt text · descriptions get translated
- **Playground expansion** — Java collections · Spring Boot request flow visualization, etc.
- **RSS category splitting** — separate RSS feeds by language · series
- **Comments/subscriptions** — was considering Giscus. Low priority

## About this document

- **First published**: 2026-07-10
- **Living document** — every time a new feature is added, it gets appended to the list above plus a one-line update note at the bottom
- **Source**: [`src/data/blog/ko/blog-beyond-astropaper-what-i-added.md`](https://github.com/dpcivl/dev-blog/blob/main/src/data/blog/ko/blog-beyond-astropaper-what-i-added.md)

### Update log

- **2026-07-10** — Initial version. Covered 12 features (series · playground · i18n · translation automation · link checker · Mermaid · Scratch/Inbox · soft-hiding · pubDatetime filter · security scrubbing · Featured/series tags · redesign)
- **2026-07-10** (2nd) — Added SEO improvements (branching JSON-LD by page type · standard field additions) + 3 perf items (rehype image lazy loading · PNG → WebP script · Pretendard CSS preload). Also replaced the README from the original AstroPaper version with a custom one.
- **2026-07-10** (3rd) — Added the below-post feedback CTA (`Feedback.astro`). Got a real channel via email · GitHub Issue without a comment system.
- **2026-07-10** (4th) — Reworked feedback CTA UX for domestic users. Instead of `mailto:`, went with a 3-track approach: "copy address (Clipboard API)" + "compose in Gmail" + "open GitHub Issue." Email address shown as plain text + `user-select: all` for one-click full selection. Set up `docs/analytics-log.md` for observation logs (first-30-days snapshot: Visitors 168 · Pages/Visitor 7.8 · Bounce 45%).
- **2026-07-10** (5th) — Slimmed down the feedback CTA. Cut options per Hick's law thinking. The email pill itself is now click-to-copy (the standard GitHub · Vercel · Notion pattern), swapped the copy icon for a check icon. Removed the Gmail button · the separate "copy address" button · the email label entirely. Changed the intro copy from defensive "errors/additions" framing to active "questions · comments · other perspectives welcome."
- **2026-07-10** (6th) — Unified the sidebar email icon to click-to-copy too. Kept the `mailto:` href as a fallback (falls back to native mailto behavior if the Clipboard API fails). Added a fixed toast (bottom-center) confirming "Email address copied." Preserved native behavior (new tab, etc.) for Ctrl/Cmd/Shift/Alt+click. Made email UX consistent site-wide.
- **2026-07-10** (7th) — Introduced the post-hoc markdown validator (`detectAccidentalStrikethrough`). Addresses GFM misparsing numeric-range tildes like `~1.5~2주` as strikethrough. Integrated into the translation pipeline's `validateAll` + a standalone `pnpm check:md` script. Scanning all 108 files found and fixed the tilde misparsing in 3 existing published posts. Convention: use an en dash `–` for numeric ranges, and `약` for leading approximates.
- **2026-07-28** (8th) — Editorial redesign of the home/portfolio (#17–19). Removed the sidebar · `page-grid` for a single-column layout site-wide, moved the header wordmark + KO/EN switcher, turned the home post list into a single-line index (retiring Featured), added the publish grass + metrics grid, replaced portfolio cards with outcome-first case blocks and extended the `highlight`/`outcomes`/`responsibilities` schema. Added a portfolio publication criterion (live site required) and an intake template. Added `word-break: keep-all` to prevent mid-word line breaks in Korean. Converted the grass from being baked in at build time on a static site to client-side recomputation, turning it into a rolling 90-day window.
- **2026-08-04** (9th) — Fixed the publish grass's last cell to be today (#18). Drawing through that week's Saturday to fill a 7-row grid caused not-yet-arrived dates to show as "0 posts" cells. Even with a shorter last column, cutting off at today is correct. Also matched the legend to the 4 levels actually in use (0 · 2 · 3 · 4).