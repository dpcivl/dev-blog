---
title: "Data Engineering Study #1 — Coffee and coffee Are Different Values"
description: "I started studying data engineering. Two days of notes on deliberately creating a dirty CSV to see how case sensitivity and empty values break aggregations, plus the principle of never touching raw data and cleaning it in staging instead, and learning UPPER, CASE, and COALESCE."
pubDatetime: 2026-08-23T01:40:00Z
tags:
  - 데이터엔지니어링공부
  - sql
  - 데이터정제
  - 학습
draft: false
featured: false
---

I started studying data engineering. I'm currently taking the **SK Planet Busan Smart Port & Maritime Logistics Data course** (SK플래닛 부산 스마트항만 · 해양물류 데이터 실무 과정, K-New Deal Academy), and aptitude tests like the Birkman assessment and MBTI both suggested that data engineering suits me well. I also have a collaborative project starting in October, so I started this partly to prepare for that too.

## Table of contents

## Day 1 — I deliberately made dirty data

On the first day, I started by generating random data in a CSV. Instead of just making clean data, I **deliberately broke it**.

- I mixed in values that only differed in case, like `Coffee` and `coffee`
- I scattered empty values throughout

When I ran an aggregation, the values that differed only in case **were recognized as separate categories and weren't grouped correctly.** To a human eye, it's the same coffee, but to a machine, they're different strings. I knew this in theory, but seeing the result after making the data myself felt different.

I also checked two things about the empty values.

- **Checking for missing values** — I counted how many entries contained NULL
- **How SUM behaves** — when computing a sum, entries with NULL are excluded from the total

The second point feels especially worth being careful about. Even with NULLs present, there's no error — the number just comes out with those entries quietly dropped. If you don't first count how many are missing, you end up using that sum without knowing how many records it's actually based on.

## Day 2 — never update raw data

The first principle I learned on the second day was this: **you should never update raw data.**

If it needs fixing, there are only two options.

1. **Transform it on read** — leave the source untouched and convert it at query time
2. **Stage a cleaned copy** — accumulate the cleaned result in a separate stage

Then I learned the SQL used for that cleaning. Along with the basics like `WHERE` and `ORDER BY`, I looked at some cleaning functions.

- **`UPPER`** — normalizes case. This is what resolves the `Coffee` / `coffee` split from Day 1.
- **`CASE`** — works like a conditional. It can output different results depending on the value.
- **`COALESCE`** — replaces NULL with another value, like 0.

```sql
SELECT
  UPPER(category)        AS category,   -- Coffee / coffee 통일
  COALESCE(amount, 0)    AS amount,     -- NULL 을 0 으로
  CASE
    WHEN amount IS NULL THEN '결측'
    ELSE '정상'
  END                    AS status
FROM raw_orders
WHERE ...
ORDER BY ...
```

The stage where you look at this cleaned data is called **staging**. The problems I checked by hand on Day 1 each had a corresponding tool on Day 2, which made me feel like the curriculum was well sequenced.

## Retrospective — the eye that comes before syntax

One thought came to mind as I typed along with the code.

Knowing how to write SQL matters, but **sensing what work is needed just by looking at the data** seems just as important. No matter how well you can clean data and extract the values you need, if you can't look at raw data and tell where it needs to be cleaned, you can't move on to the next step.

Knowing `UPPER` and noticing, when you open up the data, "hey, the case is inconsistent here" are two different abilities. You can look up the former; you can't look up the latter.

## Things to study further

- **Three-valued logic for NULL** — why `NULL = NULL` isn't true in SQL. I should also check the difference between aggregate functions skipping NULLs and `COUNT(*)` vs. `COUNT(column)`. ([PostgreSQL — Comparison Functions and Operators](https://www.postgresql.org/docs/current/functions-comparison.html))
- **When it's okay to replace NULL with 0 using `COALESCE`, and when it isn't** — "value is 0" and "value is missing" mean different things. Mixing the two changes the result when computing an average. When to fill in and when to leave it be.
- **Medallion architecture (bronze / silver / gold)** — whether the raw → staging pattern I learned this time is part of a larger layered structure. ([Databricks — Medallion architecture](https://www.databricks.com/glossary/medallion-architecture))
- **Where to normalize case** — the trade-off between converting with `UPPER` every time you query versus storing normalized values in staging. I've heard that applying a function to an indexed column can prevent the index from being used.
- **Data profiling tools** — whether there are tools that automatically scan for missing rates, duplicates, and value distributions. Something you can run as soon as you receive raw data, instead of counting by hand every time.