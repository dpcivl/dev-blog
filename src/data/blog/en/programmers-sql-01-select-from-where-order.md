---
title: "Programmers SQL #1 — SELECT · FROM · WHERE have an order"
description: "I started solving Programmers problems to study SQL. On the first problem I hit a syntax error because I didn't follow clause order, then worked through it by looking up AS · AVG · ROUND one by one."
pubDatetime: 2026-08-30T03:30:00Z
tags:
  - 프로그래머스
  - sql
  - 학습
draft: false
featured: false
---

I decided to start solving Programmers problems today to study SQL. Today is day one.

## The problem I solved today

[Finding the Average Daily Rental Fee](https://school.programmers.co.kr/learn/courses/30/lessons/151136) — result: success.

Here's the answer I submitted.

```sql
SELECT ROUND(AVG(DAILY_FEE)) AS AVERAGE_FEE
FROM CAR_RENTAL_COMPANY_CAR
WHERE CAR_TYPE = 'SUV'
```

## What I learned

**You have to write it in SELECT → FROM → WHERE order.** This was the biggest one. With fragmented knowledge, I wrote `WHERE` and then `FROM`, and got a syntax error. Knowing the clauses and knowing their order turned out to be separate things.

**`AS` names the result.** I needed to output the average value under the name `AVERAGE_FEE` but didn't know how. I learned you use `AS` for that.

**`AVG` and `ROUND`.** I found `AVG` for computing averages and immediately got the average out. But the result came out as a decimal, which failed, and I didn't know `ROUND`, so I had to look it up.

**I wrote something other than `SELECT *`.** Up to now I'd only ever done full table queries. This was the first time I picked out and computed only the values I needed.

## Reflection

Running into the syntax error actually helped. I knew `SELECT`, I knew `FROM`, I knew `WHERE` — but the error taught me that **you can't just place the pieces you know in any order you like**. That also meant I'd memorized each of them separately, without connecting them.

To solve one problem, I had to look up three things: `AS` · `AVG` · `ROUND`. Not bad for day one, I think.

> I built a [SQL clause order playground](/playground/sql-order/) where you can try this ordering issue hands-on. You can place clauses in any order to trigger errors, and watch step by step how the same query actually gets processed as `FROM → WHERE → SELECT`.

## Things to study further

- **What are the rows and columns of a table called** — the vertical direction is a **column**, the horizontal direction is a **row**, and the names at the very top of the table are the **column names**. I had a note saying "should I call this a column?" — if that's what it was pointing at, then yes. I previously put together a [DB / data modeling vocabulary](/en/posts/db-vocabulary-for-vibe-coding) post, so I should go over it again
- **Writing order and execution order are different** — you write it as `SELECT → FROM → WHERE`, but I heard the actual processing order is `FROM → WHERE → SELECT`. Knowing this should also explain why an alias assigned in `SELECT` can't be used in `WHERE`
- **The digit argument of `ROUND`** — this time I used it with no argument, so it rounded to an integer. I should learn how to specify decimal places, and how it differs from `CEIL` · `FLOOR`
- **How aggregate functions handle NULL** — [in my data engineering study I confirmed that sums are calculated excluding NULL](/en/posts/de-study-01-dirty-data-and-staging), so I should check whether `AVG` also excludes it from the denominator. If it does, the result would differ from a "true overall average"
- **`GROUP BY`** — this time I filtered down to just SUVs with `WHERE` and took the average, but I should find out what's needed to get averages per car type all at once