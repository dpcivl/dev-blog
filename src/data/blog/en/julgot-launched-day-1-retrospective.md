---
title: "I Deployed Julgot — Day 1 Retrospective"
description: "I started 'Julgot' because perfectionism left me with nothing to put on my portfolio, and today I finally deployed it. Here's a breakdown of what I experienced for the first time along the way (environment separation, DB backups, business registration) and what I still haven't figured out (marketing)."
pubDatetime: 2026-07-13T04:00:00Z
tags:
  - 회고
  - 사이드프로젝트
  - 배포
  - 완벽주의
  - 인디개발
  - 마케팅
draft: false
featured: false
---

Today, I finally deployed the service I've been dogfooding for a while. It's called **[Julgot](https://julgot.com)**. It's a journaling app dedicated to recording only your achievements.

## Table of contents

## Why I built it — starting from perfectionism

The reason I started this was simple. **Perfectionism left me with nothing to put on my portfolio.** If you keep excluding things because "this one's still not good enough" or "that one isn't finished," you end up with nothing left.

So I tried the opposite approach. I wanted to first look at **what I actually accomplish day to day**. An app that records only the good stuff. A tool that flips perfectionism's "all or nothing" filter on its head.

Now I've developed the habit of logging even small achievements in this app. And when I start to feel my self-esteem slipping, I **go to the analytics tab and remind myself of what kind of person I am and what I'm capable of.** That's the effect I've felt most clearly from dogfooding it.

## First-time experiences on the way to deployment

Since this was my first time actually deploying something, I had to encounter a number of things I'd never dealt with before.

### Verifying it works in other environments — with numbers

I learned firsthand that something running fine on my local machine doesn't mean it's a working service. To actually check how it behaves on different devices and networks, **you can't just eyeball it — you need to measure it with numbers.** So I set up Lighthouse CI (lab data) plus Vercel Speed Insights (real user metrics).

Once I had numbers, it became clear where I needed to focus first. I wrote in detail about how this actually helped in my [previous post on performance tuning](/en/posts/pre-launch-perf-tuning-what-i-couldnt-fix).

### Separating local and production environments

**You should never touch the DB directly while it's live.** Once real user data is involved, even a single bad query can cause a disaster. So I separated my local development environment from the production environment.

I decided a staging environment wasn't necessary yet. With few users and just myself on the team, having a separate pre-prod layer for human verification doesn't make as much sense as **checking things via PR preview URLs and shipping straight to prod.**

### DB backups — Cloudflare + cron + encryption

**The core of this app is analyzing users' records.** If the records disappear, the app itself has no value.

So I set up a daily cron job with Cloudflare Workers to back up the DB, and made sure the backups are encrypted before storage. If data is the foundation of your service, this is something you absolutely need to handle before deployment.

### Business registration — preparing for payments

I registered a business to integrate Toss Payments. Most domestic PG (payment gateway) providers in Korea require a business account rather than a personal one.

But **now isn't the stage to add payments.** There are no users to pay yet. Payments aren't the problem — **acquiring users** is what deserves my full attention right now. I got the business registration out of the way early, but I've put off the payment integration.

## The biggest problem — how do I promote this

Honestly, this is the part I have the least sense of right now.

Even after building the whole thing, **I have no idea how to get the word out.** So far I've posted on X (Twitter), Disquiet, and an old MBTI cafe I used to be active in. But that's nowhere near enough — the service hasn't gotten any real exposure yet, and most people probably don't even know it exists.

**Stopping after a single one-off promotion push** feels too premature. I need to figure out a sustained method and cadence for promotion, but since this is my first time doing this, I don't have a good sense of it yet.

Things I probably need to try going forward:

- Regular posting on Instagram/X (sharing progress and small insights)
- Being active in indie developer communities like Disquiet and Indie Hackers
- Trying overseas channels like Reddit and Product Hunt
- Getting natural exposure in various related communities (MBTI, self-improvement, habit tracking)

I think what I really need to do is **go out and sell this on the internet.**

## Worrying about Vercel/Supabase costs — the difference between yesterday and today

There's one thing I worried about ahead of time. I built this on Vercel and Supabase, and I'd heard that costs can become a real headache down the line.

**Up until yesterday, I was seriously considering whether I needed to migrate away from these.** But now that I've actually deployed today, it doesn't seem necessary. 🥲 Here's why:

- The Vercel Hobby and Supabase Free tiers offer overwhelming headroom (bandwidth, request counts, etc.) relative to my current traffic scale
- The scenarios that would actually be a problem (being flagged for commercial use, viral traffic overruns) don't apply yet
- The time and risk of migrating right now would be far greater than any benefit

**I've decided not to worry about the stack until traffic and users actually show up.** When something that's currently a hypothetical concern becomes an actual problem, I'll deal with it then.

## Going forward — recognizing the perfectionism trap

I'll leave one honest thought here.

After deploying this app, I found myself thinking: **"Wouldn't it be better to start over with a fresh mindset — build a service in a week, deploy it every week, capture the development process step by step, ask for feedback, and check whether there's actual demand?"**

It sounds reasonable, but I think this is also **a trap perfectionism is setting for me**. It's an escape — "what I've built now probably won't work out anyway, so let's shelve it and start the next thing." If I abandon what I've built now without doing any marketing, I'll never know whether this service was actually destined to be buried.

So I've decided not to avoid that question. **I'm going to focus on marketing and increase visibility to find out whether this service really is destined to fail to gain traction.** Moving on to the next thing without going through that process is the real escape perfectionism offers.

## Things to study further

Topics this post only touched on lightly:

- **Solo indie product marketing** — Twitter/X strategy, exposure on Product Hunt and Reddit subreddits, SEO traffic. [Indie Hackers — Marketing](https://www.indiehackers.com/tags/marketing)
- **How to use Disquiet effectively** — a Korean indie developer community. Maker logs, product registration, building connections. [disquiet.io](https://disquiet.io/)
- **Growth metrics — DAU, MAU, retention** — the minimal metrics for measuring whether a service is actually being used. [Amplitude — Product Analytics](https://amplitude.com/blog/product-analytics-metrics)
- **Cloudflare Workers Cron Triggers** — I used this for DB backups this time, but I've only scratched the surface. Scheduled handlers, combining with KV Storage and R2. [Cloudflare — Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- **DB backup encryption strategy** — symmetric key (AES) management, key rotation, backup restoration testing (I've only backed up so far, never tested restoring). [OWASP — Cryptographic Storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- **Comparing Korean PG providers** — Toss Payments vs. KG Inicis vs. Iamport (integrated SDK). Fees and API convenience for each. [Toss Payments Developer Center](https://docs.tosspayments.com/)
- **Indie product launch playbook** — preparing for Product Hunt launch day, copywriting, patterns for acquiring initial users. [Product Hunt — Ship](https://www.producthunt.com/ship)
- **Real-world Vercel/Supabase billing cases** — measuring cost concerns with actual case studies instead of guesswork. [Vercel — Pricing](https://vercel.com/pricing) · [Supabase — Pricing](https://supabase.com/pricing)
- **How to treat perfectionism as a tool** — worth revisiting my [previous retrospective](/en/posts/perfectionism-as-a-tool-vertical-slice-development), which connects to the themes here

*— Day 1 of deployment. This is where the real work begins.*