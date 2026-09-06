---
title: "Daily 08:00 Ingestion Stopped — 'Yesterday by Calendar' Had No Data Yet"
description: "The automated ingestion pipeline failed, the gate worked correctly, and the wrong thing was my assumption. A record of the cost of computing external data publish delays by calendar, and discovering a test that gave false green lights."
pubDatetime: 2026-07-27T22:30:00Z
tags:
  - 트러블슈팅
  - 사이드프로젝트
  - gcp
  - cloud-run
  - bigquery
  - 테스트
draft: false
featured: false
---

presearch collects search volume and stock prices every morning at 08:00 (KST) and loads them into BigQuery. Cloud Scheduler wakes up a Cloud Run Job to do this. That ingestion stopped.

## Table of contents

## The Situation — the Gate Blocked It

This is what the log showed.

```text
표시 검색량 목표일 관측 커버리지 부족: target=2026-07-26 fresh=0/400
```

This means that out of 400 stocks, zero had data for the target date. I had built in a gate so that if coverage falls short, the pipeline stops instead of showing half-complete data on screen. That gate is what triggered.

<img src="/assets/mermaid/d1c0d3e23595e49f.svg" alt="presearch 수집 파이프라인 — Cloud Scheduler 가 매일 08시 Cloud Run Job 을 깨우고, 네이버 검색량과 주가를 모아 BigQuery 에 적재한다. 커버리지 게이트가 목표일 데이터 확보율을 검사해 부족하면 발행을 멈춘다" width="489" height="826" style="max-width:min(100%, 489px);height:auto;" />

## What I Tried — I suspected the infrastructure first

My first thought was infrastructure. Maybe a Cloud Run cold start cut the job off mid-execution, or the Naver API had temporarily gone down.

Neither was true. When I called the Naver API directly, the response was fine — but **the latest publish date was only up to 07-25**. The 07-26 data I was requesting simply didn't exist yet.

## The Cause — I computed the target date by calendar, ignoring publish delay

The code sets the target date as **"yesterday by calendar."** If today is the 27th, it asks for the 26th's data. The problem is that Naver DataLab's publishing runs about a day behind, and even further behind over weekends. If you look for Sunday's data on Monday morning, it doesn't exist in the world yet.

To summarize:

- The gate worked exactly as designed. It wasn't a bug.
- The wrong thing was **my assumption** that "yesterday's data is available this morning."
- What's worse, since the target date advances by one day every day, **there's no self-recovery.** If it fails once, it fails again the next day too. This wasn't the kind of failure that resolves itself if you just wait.

That third point hurt the most. If it had been a failure that could be handled with a retry, I wouldn't have even noticed it in the morning.

## The Second Hotfix — Publishing Varies Stock by Stock

Right after deploying the first hotfix, the very first run broke again. This time it was because **Naver publishes different stocks up to different dates.** Instead of everything coming in up to 07-25, some stocks had data up to the 25th, others only up to the 24th.

I had actually already thought of this case while working on the first hotfix. But since it was still a hypothesis I hadn't observed in practice, I pushed it to the backlog. A few hours after deferring it, I ran into it in production.

## What I Didn't Fix — 37 Seconds of Snapshot Loading

The **37 seconds it takes for the API to read a snapshot itself, I couldn't reduce.**

It runs a full `SELECT *` sequentially across 6 BigQuery tables. The stock price table alone has about 120,000 rows, and there's neither column pruning nor date-range pruning. Fixing this would require restructuring the code, which was out of scope this time.

Instead, I used a caching strategy to **make sure the user never has to wait those 37 seconds.** I set the cache TTL to match the data refresh cycle (one day), and added preloading on startup along with stale-while-revalidate. The result: the first response from `/api/meta` went from 33.6 seconds to 0.58 seconds (measured with `curl` locally on macOS).

The loading itself remains in the backlog. Once that's resolved, I'd have the option to bring `min-instances` down to 0 and cut costs. Right now, I'm essentially masking the slow startup by paying to keep an instance running.

## Things I Learned for the First Time This Time

These topics are scattered, but worth writing down together since they're worth revisiting.

**1. The summary from `gcloud run services describe` doesn't match what's actually applied.** The summary showed this:

```text
Scaling: Auto (Min: 0, Max: 20)
```

But the actual applied value in the revision template was `Min: 1, Max: 3`. If you go by the summary alone and conclude "min-instances must be 0," you'll end up with the opposite of the truth.

**2. Building without specifying a platform on Apple Silicon gets rejected by Cloud Run.** If you leave out `--platform linux/amd64`, you get an arm64 image, and it gets blocked at the deployment stage.

```bash
docker build --platform linux/amd64 -t <image> .
```

**3. When passing a value containing a comma to `gcloud --set-env-vars`, use an alternate delimiter instead of escaping.** Escaping with `\,` gets rejected by the parser. You need to prepend an alternate delimiter like `^@^` for it to work.

```bash
gcloud run deploy <svc> --set-env-vars "^@^KEY1=a,b@KEY2=c"
```

**4. Code with 100% branch coverage still had 3 concurrency bugs.** Coverage measures "which lines executed," not "in what order things got tangled up." Hitting 100% doesn't mean concurrency has been verified.

## Retrospective — Two Judgments Were Wrong

**One. I underestimated the probability of occurrence.** My basis for deferring the per-stock publish discrepancy to the backlog was "the cost of failure is low." That part was correct. But I didn't also weigh the probability of occurrence. Even if the cost of failure is low, if the probability is high, it's cheaper to handle it now. Going forward, I plan to record both cost and probability together.

**Two. My way of trusting tests was wrong.** I had set up a test to prevent an accident where an environment variable gets dropped from documentation, and judged that "the test will catch this." When I actually commented out that line, **the test passed.**

It was a test that gave a false green light for the very accident it was supposed to prevent. This is worse than having no test at all. Without it, at least you're anxious enough to check by hand — with it, you stop checking.

From now on, whenever I build a safety mechanism, I **actually reproduce the accident it's meant to prevent and confirm that it turns red.** Rather than just writing a test, I add one more step to verify that the test actually works.

## Things to Study Further

- **BigQuery cost and performance optimization** — how to avoid `SELECT *`, select only the columns you need, and reduce scan range with partitioning and clustering. This is where to start if I want to cut down that 37 seconds. ([Optimize query computation](https://cloud.google.com/bigquery/docs/best-practices-performance-compute) · [Control costs](https://cloud.google.com/bigquery/docs/best-practices-costs))
- **The tradeoff between Cloud Run minimum instances and cold starts** — the cost of paying to keep `min-instances` at 1 versus the latency you accept by bringing it down to 0. I want to calculate where the tipping point is. ([Minimum instances](https://cloud.google.com/run/docs/configuring/min-instances))
- **`gcloud` argument escaping rules** — why alternate delimiters are needed and which flags they apply to. ([gcloud topic escaping](https://cloud.google.com/sdk/gcloud/reference/topic/escaping))
- **Tests that catch concurrency bugs** — how to turn races that coverage can't catch into reproducible tests. I need to check whether there are strategies like deterministic scheduling or repeated execution.
- **Mutation testing** — an approach that automatically finds false green lights. It deliberately breaks the code and checks whether the tests fail. ([mutmut](https://github.com/boxed/mutmut))
- **Designing without assuming the freshness of external data** — instead of computing the target date by calendar, it seems more correct to first query "the latest date the provider has actually published." Though I still haven't worked out where to draw the line for "normal" in situations where publish dates diverge stock by stock. ([Naver DataLab Search Trend API](https://developers.naver.com/docs/serviceapi/datalab/search/search.md))