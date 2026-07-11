---
title: "One Day Before Launch, I Tore Performance Apart — and Still Couldn't Fix One Thing"
description: "A performance tuning retrospective from the day before launching a solo-developed app: TTFB 3.15s → 10ms, LCP 22.1s → 1.4s. And the story of the PWA bottom system bar color that I burned a whole day on and still couldn't fix on the web."
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

I spent an entire day on performance right before launch. What I want to record here isn't just the wins — it's the **one thing I couldn't fix even after a full day of digging**, on the web at least. That's the part that sticks with me more.

**The results first:**

- Landing page TTFB: **3.15s → 10ms**
- Landing page LCP: **22.1s → 1.4s** (lab metric)
- What I couldn't fix: the bottom system navigation bar color in the installed PWA

## Table of contents

## 0. The principle — measure first

I set one rule at the start: **don't optimize on guesswork.** I had already wired up Lighthouse CI (lab metrics) and Vercel Speed Insights (real-user metrics) the day before, and the first measurement immediately pointed at the culprit: **TTFB of 3.15 seconds.** That was the biggest lever.

Instead of a vague feeling that "this seems slow," the numbers told me exactly where to dig. That's why the day didn't go to waste wandering around — and it's the main point I want to make in this post.

## 1. TTFB 3.15s → 10ms — something that should have been static was dynamic

The cause was structural. **The logged-out landing page was reading a cookie just to check login status**, and that single line meant the whole page — which should have been static — was being server-rendered on every single request. On top of that, the logged-in home page checked auth (`getUser`) with **three consecutive network round trips**, once each in the proxy, layout, and page.

The fix went like this:

1. **Split the logged-out landing page into a separate static route** — the proxy rewrites logged-out `/` requests to that route. If there's no auth cookie at all, it's handled without any server round trip → the static HTML gets served straight from the CDN edge.
2. **Dedupe the auth check to run once per request** — using React's `cache()`.

After deploying, I only relaxed once I saw `X-Vercel-Cache: HIT` in the response headers. **3.15s → 10ms.**

There was a near-miss here. `rewrite` keeps the URL as `/` but carries over the metadata from the other page. A `noindex` tag I had carelessly left on that page almost ended up on the homepage. I caught it during code review. **One layer of automated review ended up blocking an SEO landmine right before launch.**

## 2. LCP 22.1s → 1.4s — the Korean web font trap

This was the most dramatic one. The lab LCP for the landing page came in at **22.1 seconds**. I doubted my eyes at first.

The culprit was the Korean web font. I was loading a nice display font in four weights, and since Korean has a huge number of characters, the font gets split into pieces by Unicode range. As a result, the single landing page was pulling in **288 font files totaling 2.4MB**. Under slow-network simulation, these requests saturated the connection and pushed LCP up to 22 seconds.

> Note: the actual observed LCP was 2.3 seconds. The 22-second figure is a throttling projection, so real users don't actually experience it that way — but 2.4MB across 288 requests is still wasteful, and it's a real cost on slow mobile connections.

The fix was simple but effective. The landing page copy uses only a small, fixed set of characters. So I **built a subset font containing just those characters**:

- Used `pyftsubset` to extract only the glyphs actually in use (232 characters) → 3 woff2 files, 53KB
- Dropped one unused weight, and switched from Google Fonts CDN to self-hosting

**288 requests / 2.4MB → 3 requests / 53KB.** Lab LCP went from 22.1s to 1.4s. After the tuning, **the landing page became the fastest page in the app**.

Since I'll need to regenerate the subset whenever new copy gets added, I also committed a regeneration script to the repo.

## 3. Tab-switch "jank" — when metrics look fine but it still feels bad

On mobile, there was a slight hitch when tapping a tab ([the issue I dug into in a previous post](/en/posts/debugging-tab-switch-freeze-postmortem)). But when I re-measured INP (the interaction metric) this time, it was **already good, at 8–40ms**. A common situation: the metric looks fine, but it still feels off.

The cause wasn't INP — it was **navigation delay**. Specifically, when the app had been backgrounded and I came back to it, the prefetch cache had expired. So tapping a tab didn't immediately show a loading indicator — the previous screen just silently froze in place.

- **Using `useLinkStatus` to react the instant a tab is tapped** — I added a highlight and spinner on the tapped tab (delayed by 150ms so it doesn't show up on fast transitions). Just the "you tapped it" feedback made a huge difference in how it felt. I confirmed this on a real device.
- **Instant display on revisits via client cache (`staleTimes`)**. To keep data from looking stale, I wired up cache invalidation at every point where a record gets added, edited, or deleted.

## 4. What I couldn't fix even after burning a whole day

This is the real reason I'm writing this post.

In the installed PWA (added to the home screen), **the bottom system navigation bar area showed up white, with scrolled text faintly showing through behind it.** The app background is a warm cream color, but there was a white band right below it. Opening it in the browser (Chrome) worked fine — it only happened in the installed app.

Things I tried, in order, to make it cream-colored:

1. `viewport-fit=cover` to extend to the edge of the screen → still white
2. Changing `background_color` / `theme_color` in the manifest from white → cream → no effect
3. Adding a fixed element covering the bottom safe area with opaque cream → didn't cover it
4. Wondering if automatic dark-mode switching was the issue, so I locked it to light mode only → unrelated
5. On outside advice, setting `min-height: 100dvh` to extend the background across the entire dynamic viewport (this was the missing piece I'd overlooked) → still white

I toggled `cover` on and off more times than I'd like to admit. **My commit log is embarrassing to look at.**

The decisive clue was this:

> **Same HTML/CSS, but cream in the browser and white in the installed app.**

If CSS were the cause, it should look the same in the browser too. So the cause wasn't the code — it was the **rendering environment**: how Android draws the bottom system bar for an installed PWA (WebAPK). And **that color cannot be changed via the web or the manifest.** (It varies by device and Android version, and this particular device just ignored the web-level signals.)

**Conclusion: a limitation of web PWAs.** To reliably control the system bar color, the only option is to set `navigationBarColor` directly in a native wrapper (TWA/Capacitor). I've parked that for the next major version.

**What I learned:** it was a mistake to hit an issue that only reproduces on a real device with five guess-based commits, without the device in hand. The single fact that **"it works in the browser but not in the installed app"** should have led me to conclude much earlier that **"this is a platform-layer issue."** Continuing to push at something the web can't fix, using the web, is just wasted effort.

## 5. Something I built and immediately threw away — a loading skeleton

I tried replacing the "Loading…" text shown during tab transitions with a gray skeleton that mimics the page shape. The thing that's common these days.

As soon as I tried it, it felt off. **An unfamiliar gray block flashing between tabs actually made things look cheaper.** I reverted it right away. Plain text turned out to be better for short transitions.

The lesson pairs with #4: **don't add loading states or visual elements based on a hunch that they'll "look good."** Especially for UI you can't visually verify locally — don't ship it live until you've actually seen it and judged it for yourself.

## 6. Wrapping up the day — four lessons

1. **Measurement sets the direction.** Numbers, not feelings.
2. **Big levers are usually structural.** Why was the landing page dynamic? Why was the whole font being downloaded?
3. **Recognize quickly when something isn't going to work.** You can't change the system bar color with a web PWA. I should have stopped around the second attempt, not the fifth.
4. **Don't add UI on a hunch.** Not skeletons, not loading logos — nothing goes live without verification.

I suspect the judgment call of **stopping in front of something I couldn't fix** will stay with me longer than the successful numbers (22 seconds → 1.4 seconds).

## Further study

Things this post only touched on lightly:

- **Next.js `rewrite` vs `redirect`** — whether the URL is preserved, how metadata is carried over, and the SEO pitfalls. [Next.js — rewrites](https://nextjs.org/docs/app/api-reference/next-config-js/rewrites)
- **React `cache()`** — per-request dedup inside Server Components. The differences between `React.cache`, `unstable_cache`, and `fetch` cache. [React docs — cache](https://react.dev/reference/react/cache)
- **`X-Vercel-Cache` header states** — what `HIT`, `MISS`, `STALE`, `BYPASS`, and `REVALIDATED` each mean. [Vercel Edge Network — Caching](https://vercel.com/docs/edge-network/caching)
- **Korean web font subsetting** — `pyftsubset` (fonttools), Unicode range splitting vs. unified subsets, the `unicode-range` CSS property. [Google Fonts subset guide](https://developers.google.com/fonts/docs/getting_started#specifying_script_subsets)
- **`font-display` policy** — `swap`, `optional`, `fallback`, `block`. The FOIT vs. FOUT trade-off. [MDN — font-display](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display)
- **Next.js `useLinkStatus`** — a hook for detecting a link's pending state. How it combines with Suspense and `loading.tsx`. [Next.js — useLinkStatus](https://nextjs.org/docs/app/api-reference/functions/use-link-status)
- **Next.js Router `staleTimes`** — adjusting the client-side router cache TTL. Cache policy differences between `dynamic` and `static` segments. [Next.js — staleTimes](https://nextjs.org/docs/app/api-reference/next-config-js/staleTimes)
- **Web PWA display modes** — how `standalone`, `fullscreen`, `minimal-ui`, and `browser` each expose system UI. [MDN — display](https://developer.mozilla.org/en-US/docs/Web/Manifest/display)
- **Trusted Web Activity (TWA) vs. Capacitor** — options for wrapping a web app into native Android. TWA runs on top of Chrome, Capacitor uses its own WebView. Where `navigationBarColor` gets set differs between them. [Chrome Developers — TWA](https://developer.chrome.com/docs/android/trusted-web-activity)
- **Android WebAPK rendering behavior** — the minimal APK generated when you "Add to Home Screen" in Chrome. Why system bar handling differs by device/OS version. [WebAPK Minting](https://web.dev/articles/webapks)
- **INP (Interaction to Next Paint)** — used here only to confirm 8–40ms; for details, see ["Further study" in the previous tab-switch retrospective](/en/posts/debugging-tab-switch-freeze-postmortem#further-reading)

*— the day before launch*