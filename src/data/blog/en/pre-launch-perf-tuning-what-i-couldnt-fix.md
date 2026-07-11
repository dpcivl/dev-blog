---
title: "The Day Before Launch, I Overhauled Performance — And One Thing I Never Fixed"
description: "A tuning retrospective from the day before launching a solo-developed app: TTFB 3.15s → 10ms, LCP 22.1s → 1.4s. And the story of the PWA bottom system bar color I burned a whole day on but never fixed on the web."
pubDatetime: 2026-07-11T07:00:00Z
tags:
  - 성능
  - 트러블슈팅
  - nextjs
  - pwa
  - 회고
  - TTFB
  - LCP
draft: false
featured: false
---

With launch approaching, I spent an entire day on performance. Some of it went well, but what I really want to record in this post is **the one thing I burned a whole day on and still couldn't fix on the web.**

**The bottom line, up front**:

- Landing TTFB: **3.15s → 10ms**
- Landing LCP: **22.1s → 1.4s** (lab)
- What I couldn't fix: the bottom system navigation bar color in the installed PWA

## Table of contents

## 0. Principle — measure first

I set one principle before starting: **don't optimize by guessing.** I'd wired up Lighthouse CI (lab) and Vercel Speed Insights (real-user metrics) the day before, and the very first measurement pointed at the culprit. **TTFB was 3.15 seconds.** That was the biggest bottleneck.

It wasn't a feeling of "this seems slow" — the numbers told me exactly where to start fixing. That kept the whole day from turning into blind flailing.

## 1. TTFB 3.15s → 10ms — something that should have been static was dynamic

The cause was structural. **The logged-out landing page was reading a cookie to check login status**, and that one line meant a page that should have been entirely static was being server-rendered on every single request. On top of that, the logged-in home page was doing auth checks (`getUser`) **three network round trips in a row** — in the proxy, the layout, and the page.

How I fixed it:

1. **Split the logged-out landing page into its own static route** — the proxy rewrites logged-out `/` requests there. If there's no auth cookie at all, it's handled with zero server round trips → the static HTML is served from the CDN edge.
2. **Auth checks happen once per request** — deduplicated with React's `cache()`.

After deploying, I only relaxed once I saw `X-Vercel-Cache: HIT` in the response headers. **3.15s → 10ms.**

I almost caused an incident here. A `rewrite` keeps the URL at `/` while carrying metadata from a different page. A stray `noindex` I'd left on that other page nearly ended up on the homepage. I caught it during code review. **One layer of automated review just defused an SEO landmine right before launch.**

## 2. LCP 22.1s → 1.4s — the Korean web font trap

This was the most dramatic one. The landing page's lab LCP came in at **22.1 seconds.** I doubted my own eyes at first.

The culprit was the Korean web font. I was loading a Korean display font in four weights for the landing headline, and Korean fonts get split into many Unicode-range chunks because of the sheer number of characters. As a result, this single landing page was downloading **288 font files, 2.4MB total.** Under slow-network simulation, these requests saturated the connection and pushed LCP up to 22 seconds.

> Note: the actually observed LCP was 2.3 seconds. The 22-second figure is a throttling projection, so real users weren't experiencing that directly — but 2.4MB and 288 requests is still waste, and it's a real cost on slow mobile connections.

The fix was simple but decisive. The landing copy only ever uses a small, fixed set of characters. So I **built a subset font containing only those characters:**

- Used `pyftsubset` to extract only the glyphs actually in use (232 characters) → 3 woff2 files, 53KB
- Dropped one unused weight, and self-hosted instead of using the Google Fonts CDN

**288 requests / 2.4MB → 3 requests / 53KB.** Lab LCP went from 22.1 seconds to 1.4 seconds. After tuning, **the landing page became the fastest page in the app.**

Since the subset needs to be regenerated whenever new copy is added, I left a regeneration script in the repo.

## 3. Tab-switch "stutter" — when the metrics look fine but it feels bad

There was a moment of hesitation on mobile when tapping a tab ([the same issue I dug into in my previous post](/en/posts/debugging-tab-switch-freeze-postmortem)). But when I re-measured INP (the interaction metric) this time, it was already **8–40ms, which is good.** A common situation: the metric is fine, but the feel is bad.

The cause wasn't INP — it was **navigation delay.** Specifically, when the app had been backgrounded and the prefetch cache had expired, tapping a tab wouldn't show a loading indicator right away — the previous screen would just stay frozen.

- **With `useLinkStatus`, the moment a tab was tapped**, I showed a highlight and spinner on the tapped tab immediately (delayed 150ms so it doesn't flash on fast transitions). Just that "this was tapped" feedback made a huge difference in feel. I verified this on a real device.
- **Revisits now display instantly via the client cache (`staleTimes`)**. To keep data from looking stale, I added cache invalidation at every point where records are added, edited, or deleted.

## 4. What I couldn't fix even after burning a whole day

This is the real reason I'm writing this post.

In the installed PWA (added to the home screen), **the bottom system navigation bar area showed up white, with scrolled text faintly visible behind it.** The app background is a warm cream color, but just that strip at the bottom was white. It looked fine in the browser (Chrome) — only the installed app had the problem.

Things I tried to make it cream-colored, in order:

1. `viewport-fit=cover` to extend to the screen edge → still white
2. Changing the manifest's `background_color` / `theme_color` from white → cream → no effect
3. Adding a fixed element covering the bottom safe area with opaque cream → didn't cover it
4. Wondering if dark-mode auto-switching was the issue, forcing light-only → unrelated
5. On outside advice, using `min-height: 100dvh` to extend the background across the full dynamic viewport → still white

I toggled `cover` on and off more times than I'd like to admit. **My commit log is embarrassing to look at.**

The decisive clue was this:

> **Identical HTML/CSS, but cream in the browser and white in the installed app.**

If CSS were the cause, the browser should show the same thing. So the cause wasn't the code — it was the **rendering environment**: how Android draws the bottom system bar for an installed PWA (WebAPK). And **that color can't be changed from the web or the manifest.** (It varies by device and Android version, and this particular device ignored the web signals entirely.)

**Conclusion: this is a limit of web PWAs.** If you want reliable control over the system bar color, the only way is native wrapping (TWA/Capacitor) and setting `navigationBarColor` directly. I've pushed that to the next major version's backlog.

**What I learned**: it was a mistake to hit a problem that only reproduces on a real device with five guess-and-commit attempts, without the device in hand. A single fact — **"it works in the browser but not in the installed app"** — should have led me to conclude much earlier that **"this is the platform layer."** Pushing on a web-only fix for something the web can't fix is just flailing.

## 5. Something I built and immediately threw away — a loading skeleton

I tried replacing the "Loading…" text that appears during tab transitions with a gray skeleton mimicking the page shape. The common thing everyone does these days.

The moment I tried it, it felt wrong. **An unfamiliar gray block flashing between tabs actually looked cheap.** I reverted it immediately. For short transitions, plain text worked better.

This lesson pairs with #4: **don't add loading states or visual elements just because they "seem like they'd look good."** Especially for UI you can't visually verify locally — don't ship it live until you've actually seen it and judged it for yourself.

## 6. Wrapping up the day — 4 lessons

1. **Measurement determines direction.** Numbers, not feelings.
2. **Big improvements are usually structural.** Why was the landing page dynamic? Why was the font loaded whole?
3. **Admit quickly when something can't be done.** You can't change the system bar color from a web PWA. I should have stopped around the second attempt, not the fifth.
4. **Don't add UI based on gut feeling.** Skeletons, loading logos — none of it ships without verification.

I suspect **the judgment call of stopping in front of something I couldn't fix** will stick with me longer than the successful numbers (22 seconds → 1.4 seconds).

## Further study

Things this post only skimmed:

- **Next.js `rewrite` vs `redirect`** — whether the URL is preserved, how metadata is carried, and SEO pitfalls. [Next.js — rewrites](https://nextjs.org/docs/app/api-reference/next-config-js/rewrites)
- **React `cache()`** — per-request dedup inside Server Components. Differences between `React.cache`, `unstable_cache`, and `fetch` caching. [React docs — cache](https://react.dev/reference/react/cache)
- **`X-Vercel-Cache` header states** — what `HIT`, `MISS`, `STALE`, `BYPASS`, and `REVALIDATED` each mean. [Vercel Edge Network — Caching](https://vercel.com/docs/edge-network/caching)
- **Korean web font subsetting** — `pyftsubset` (fonttools), Unicode-range splitting vs. unified subsets, the `unicode-range` CSS property. [Google Fonts subset guide](https://developers.google.com/fonts/docs/getting_started#specifying_script_subsets)
- **`font-display` policy** — `swap`, `optional`, `fallback`, `block`. The FOIT vs FOUT tradeoff. [MDN — font-display](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display)
- **Next.js `useLinkStatus`** — a hook for detecting link pending state. Combining it with Suspense and `loading.tsx`. [Next.js — useLinkStatus](https://nextjs.org/docs/app/api-reference/functions/use-link-status)
- **Next.js Router `staleTimes`** — tuning the client-side router cache TTL. Cache policy for `dynamic` vs `static` segments. [Next.js — staleTimes](https://nextjs.org/docs/app/api-reference/next-config-js/staleTimes)
- **Web PWA display modes** — how `standalone`, `fullscreen`, `minimal-ui`, and `browser` each expose system UI. [MDN — display](https://developer.mozilla.org/en-US/docs/Web/Manifest/display)
- **Trusted Web Activity (TWA) vs Capacitor** — options for wrapping web apps as native Android apps. TWA runs on top of Chrome, Capacitor uses its own WebView; where you set `navigationBarColor` differs between them. [Chrome Developers — TWA](https://developer.chrome.com/docs/android/trusted-web-activity)
- **Android WebAPK rendering characteristics** — the minimal APK generated by Chrome's "Add to Home Screen." Why system bar handling varies by device/OS version. [WebAPK Minting](https://web.dev/articles/webapks)
- **INP (Interaction to Next Paint)** — I only used it this time to confirm 8–40ms; for details see [the "Further study" section of my previous tab-switch retrospective](/en/posts/debugging-tab-switch-freeze-postmortem#further-reading)

*— the day before launch*