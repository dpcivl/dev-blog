---
title: "The Screen Froze for a Moment When I Tapped — Tracing the Cause"
description: "Tracing an intermittent tab-switch stutter, I confused my tools (Lighthouse ≠ INP), misdiagnosed Realtime, fixed an obvious waste with little payoff, and concluded it wasn't a single bug but a structural cost of SPA navigation. A retrospective that keeps the failures in."
pubDatetime: 2026-07-10T11:00:00Z
tags:
  - 트러블슈팅
  - 성능
  - react
  - nextjs
  - 회고
  - INP
draft: false
featured: false
---

> A record of tracking down an "intermittent tab-switch stutter" in a service I'm building solo.
> Bottom line up front: **it wasn't a single bug, it was a structural cost — and there was a lot of stumbling along the way.** In the spirit of building in public, I'm keeping the failures in this writeup too.

## Table of contents

## 1. The symptom — what was wrong

Using the app on mobile, the bottom tabs (Home, Goals, Analysis) would **occasionally** feel off.

- Normal: tap a tab, a brief "navigating" loading state appears, then it smoothly transitions to the new screen.
- Problem: no loading indicator at all — **the previous screen just stays frozen for a few seconds**, then suddenly jumps to the new screen.

Because it was "intermittent," it was hard to reproduce. It seemed to happen especially often right after bringing the app back from the background. With launch approaching, I also had a nagging anxiety that "we don't even have an objective metric for how fast our service is."

## 2. First wasted effort — the mistaken belief that "measuring performance" meant this

To measure performance, the first thing I did was run **PageSpeed Insights / Lighthouse**. But that's where I confused the concepts.

> **Lighthouse measures "how fast a page first loads" (loading). My problem was "the stutter when tapping a tab in an already-loaded app" (interaction). These are completely different layers.**

Because Lighthouse spat out numbers like LCP (Largest Contentful Paint), I fixated on them and wandered off into optimizing **landing page images** — completely unrelated to my actual problem. (The image optimization wasn't bad in itself, but it had nothing to do with my real issue.)

**Lesson ①:** Loading metrics (LCP, FCP) and interaction responsiveness (INP, runtime jank) are different problems. You have to pick the right tool first. To look at tab-switch stutter, you don't want Lighthouse — you want the **DevTools Performance panel (trace recording)**.

As an aside, I spent a lot of time trying to attach remote debugging on a real device (`adb`) and fell into an `offline` hell. In the end, **throttling CPU and network in desktop Chrome** was enough to profile. A real device wasn't actually necessary.

## 3. Measuring it properly — Performance profiling

In desktop Chrome:
- Open the app while logged in
- DevTools → **Performance** → CPU **4–6x slowdown** + network **Slow 4G** (to simulate a weak mobile device)
- Start recording → switch tabs back and forth several times → stop

Look at the `Main` track in the timeline for **Long Tasks (the red triangles ▲)**. Every time I tapped a tab, a long task showed up.

## 4. The wrong hypothesis — "Realtime must be the culprit"

My first hypothesis: this app syncs records in real time via Supabase **Realtime (WebSocket)**. When the phone comes back from the background, the WebSocket reconnects — could **that reconnection be blocking the main thread**, freezing the screen at the moment of the tap?

It sounded plausible. But when I opened the profile and dug into the long tasks:

- Every individual JS function call was **small** (`1.6ms`, `0.3ms`, ...). There was no trace of Realtime-related code eating up time.
- Instead, **`Layout`, `Recalculate Style`, `Paint`, `Commit`** — i.e., the **browser rendering pipeline** — were consuming all the time. `Layout` alone took 90–100ms per transition (under throttling).

**The hypothesis was wrong.** The "Realtime reconnection" theory I'd built from reading the code was flatly disproven by the profile.

**Lesson ②:** Don't fix things based on guesses — **verify with a profile**. Reading code alone makes you confident in plausible-sounding wrong answers.

## 5. The real cause — render/layout bound

The cause, cleaned up:

> **Every time you tap a tab, the previous page's DOM gets torn down entirely and the new page is laid out and painted from scratch. That, by itself, was heavy.**

Each tab in this app is a **separate dynamic page that fetches its own data from the server**. When you tap a tab:
1. A server round trip (data fetch)
2. React renders the new page's component tree (a deep, recursive render)
3. The browser does **Layout → Paint** on the new DOM

Under 4–6x desktop throttling, this whole chunk took ~1.5 seconds. **A real mobile CPU is roughly that weak.** That's why it "froze" on the phone.

I found one more thing in the profile: **the shared UI (top header, bottom tab bar) lived inside each page, so every time you switched tabs, the header and tab bar got remounted too — and the "account deletion scheduled" banner attached to the header sent a fresh server request on every single transition.** Something that should have been shared was being reborn on every page.

## 6. The attempted fix — sharing the header/tab bar via a shared layout

I decided to fix the most visible waste first. I restructured things using Next.js App Router's **route groups + a shared `layout.tsx`**.

- Grouped the authenticated app routes (`/`, `/analysis`, `/goals`, `/history`, `/settings`) into an `(app)` route group (URLs stayed the same),
- Rendered the header and tab bar once in the shared `layout.tsx`,
- Made each page return only the "content between the header and the tab bar."

Expectation: even when switching tabs, the header and tab bar would **persist** (no remount, no repeated requests), and only the page content would swap out — meaning less work per transition.

### Why it was only a partial success

After the refactor, I profiled again — and **`Layout` was still dominant.**

- ✅ What I got: no more header/tab bar remounting, no more repeated server requests from the banner, no more flicker, and a cleaner structure.
- ❌ What I didn't get: **the biggest cost wasn't the header/tab bar (the chrome) — it was re-laying out the page body itself.** That remained untouched.

In other words, **I eliminated one waste, but didn't touch the dominant cost.** Honestly, the payoff was smaller than I expected.

**Lesson ③:** "Visible waste" isn't always "the biggest cost." I should have looked at the **dominant item the profile pointed to** first.

## 7. Conclusion — not a single bug, but a structural cost

Here's the core of it:

> **This stutter isn't a single "bug" that can be fixed — it's the "structural cost" of SPA navigation redrawing the entire page.**

- Since it happens even now with a small amount of data, it's not a data-volume problem.
- It's not Realtime, and it's not any specific function.
- The essence of it is **the Layout/Paint cost of a full-page transition on a weak mobile CPU.**

Problems like this don't disappear with one fix. Reducing them requires **several scattered tuning efforts**, and each one's ROI isn't huge. So I **judged this wasn't a launch blocker**, kept the partial improvement (the shared layout), and **pushed the real tuning work to after launch**.

## 8. Post-launch plan — how to fix this without hurting UX while the service is live

Once launched, I'll need to fix this with real users on the app. Fortunately, two things are working in my favor.

**(1) Deployment is zero-downtime.** With Vercel + push-to-deploy, deployments are atomic. When a new version is ready, traffic switches over instantly, and if a build fails, the previous version stays in place. I can fix things **with no downtime**.

**(2) Tuning doesn't change the appearance.** The improvements below make things **only faster, not visually different**, so they don't hurt UX.

### A safe order of improvements (measure → target → improve → verify → deploy, each step independently deployable)

1. **First, attach a measurement metric.** Aggregate real users' **INP (Interaction to Next Paint)** (Vercel Speed Insights, cookieless). Turn "how slow is tab response, really" into a number so improvements can be proven.
2. **Audit expensive CSS.** Properties like `text-wrap: balance` (`text-balance`) and `break-keep` trigger layout recalculation multiple times. Find where they're overused and keep them only where truly needed. → Directly reduces Layout cost.
3. **Reduce DOM/render count per page.** Especially for screens that get heavier as history accumulates (the analysis tab loads the entire history), switch to **the most recent N items + "load more"** to lighten the initial render.
4. **Trim the JS bundle.** Reduce the initial chunk (hundreds of KB) through code splitting and removing unnecessary polyfills, lowering the hydration/execution burden.
5. (Optional) **Lighten the transitions themselves.** Cache/prefetch data for frequently visited tabs to reduce server round trips.

Each step ships through **branch → verify on a preview URL → merge**, so each one can be applied safely, one at a time, without affecting the live service. If an improvement is confirmed by the INP numbers, keep it; if not, roll it back.

## 9. Rough time estimate (solo, focused days)

| Task | Estimate |
|---|---|
| Set up INP measurement with Speed Insights | 0.5 day |
| Audit and clean up expensive CSS | 1–2 days |
| Paginate heavy screens (e.g., analysis) | 2–3 days |
| Code-split the JS bundle | 3–5 days |
| Transition caching/prefetching (optional) | 2–3 days |

- Doing **just "measurement + expensive CSS cleanup"** first could yield a noticeable improvement in ~2–3 days.
- The whole thing is **~1.5–2 weeks** of work, but since each item is independent, it can be **rolled out incrementally**. No need to do it all at once.

## 10. Lessons learned

1. **Loading performance (Lighthouse) and interaction responsiveness are different problems.** Pick the right tool first.
2. **Don't fix based on guesses — verify with profiles.** A plausible-sounding wrong answer (my "Realtime" hypothesis) was disproven by the profile.
3. **"Visible waste" ≠ "the biggest cost."** Start with the dominant item in the profile.
4. **Not everything is a single bug.** Some slowness is structural, and in that case, decide priority by first asking "is this a blocker?"
5. **With zero-downtime deployment + appearance-preserving tuning**, you can improve things incrementally without hurting UX, even while the service is live.

## Further reading

Things this post only skimmed over:

- **INP (Interaction to Next Paint)** — the interaction metric in Core Web Vitals, successor to FID. How to break down why a given interaction is slow. [web.dev — INP](https://web.dev/articles/inp)
- **Chrome DevTools Performance panel, in depth** — beyond Long Tasks, using Layout Shift Regions, the Interactions track, Bottom-Up, and Call Tree. [Analyze runtime performance](https://developer.chrome.com/docs/devtools/performance)
- **The CSS `contain` property** — using `contain: layout` to isolate child layout changes so they don't propagate to the parent. A card that could partially mitigate the "page body layout cost" from this post. [MDN — contain](https://developer.mozilla.org/en-US/docs/Web/CSS/contain)
- **`content-visibility: auto`** — skips layout/paint for content outside the viewport. Especially effective for long lists like a history list. [web.dev — content-visibility](https://web.dev/articles/content-visibility)
- **Next.js App Router — `parallel routes` and `intercepting routes`** — this post only used route groups, but there's room to reduce transition costs with more sophisticated routing patterns. [Next.js Routing](https://nextjs.org/docs/app/building-your-application/routing)
- **The real cost of `text-wrap: balance`** — actual measurements of how slow it is, and grounds for why overusing it is a problem. [Chrome team on text-wrap: balance](https://developer.chrome.com/blog/css-text-wrap-balance)
- **React reconciliation and memoization** — does `React.memo`, `useMemo`, `useCallback` actually reduce Layout cost? (Mostly the answer is: they shrink the render tree, but don't reduce browser Layout.) [React docs — memo](https://react.dev/reference/react/memo)
- **Vercel Speed Insights vs Web Analytics** — the Web Analytics this blog uses is visit statistics; Speed Insights is real-user RUM for INP, LCP, CLS. Different things. [Vercel Speed Insights](https://vercel.com/docs/speed-insights)

*— I didn't fix it perfectly, but I now understand the problem correctly and know what to do next. For now, that's enough.*