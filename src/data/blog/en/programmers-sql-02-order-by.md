---
title: "Programmers SQL #2 — Sorting Isn't sort, It's ORDER BY"
description: "The second problem was easy to solve. When I thought of sorting, sort came to mind first, but in SQL it's ORDER BY. I also used multi-column sorting for the first time, something I only knew conceptually before."
pubDatetime: 2026-08-31T11:30:00Z
tags:
  - 프로그래머스
  - sql
  - 학습
draft: false
featured: false
---

This is my second Programmers SQL problem.

## Today's Problem

[Popular Ice Cream](https://school.programmers.co.kr/learn/courses/30/lessons/133024) — result: success.

The problem asks you to sort ice cream flavors (`FLAVOR`) from the `FIRST_HALF` table in descending order of total orders (`TOTAL_ORDER`), and when the total orders are equal, in ascending order of shipment ID (`SHIPMENT_ID`).

Here's the answer I submitted:

```sql
SELECT FLAVOR
FROM FIRST_HALF
ORDER BY TOTAL_ORDER DESC, SHIPMENT_ID ASC
```

## What I Learned

**Sorting isn't `sort`, it's `ORDER BY`.** When I realized I needed to sort, the first word that came to mind was `sort`. The name I was used to from programming languages came up first. In SQL it's `ORDER BY`, and fortunately I remembered that correctly.

**You can chain multiple sort conditions with commas.** I only knew conceptually that you could sort again by a different criterion when values are equal, but this time I was able to use it right away. The earlier condition takes priority, and the later condition only applies when values from the earlier one are equal.

I also confirmed this time that you can attach `DESC` and `ASC` separately to each condition. You can mix them — one descending, one ascending.

For example, suppose there are rows with the same total order count:

| SHIPMENT_ID | FLAVOR | TOTAL_ORDER |
| --- | --- | --- |
| 3 | Chocolate | 100 |
| 1 | Strawberry | 100 |
| 5 | Vanilla | 80 |

With just `TOTAL_ORDER DESC`, it's undetermined whether Chocolate or Strawberry comes first. Adding `SHIPMENT_ID ASC` afterward fixes the order to Strawberry(1) → Chocolate(3). The second condition isn't there to make the order look nice — its role is to **make the order deterministic**.

## Retrospective

This problem was easy, so there's not much more to reflect on. In the [first problem](/en/posts/programmers-sql-01-select-from-where-order), I ran into a syntax error because I didn't know the clause order. This time I passed in one go without getting stuck anywhere.

If I had to pick one thing, it's that I confirmed the opposite side of **knowing a concept vs. being able to use it**. I only knew multi-column sorting conceptually, but this time my hands moved right to it.

## Things to Study Further

- **When does `ORDER BY` actually execute?** — [In the first post, I left as homework the fact that write order and execution order differ](/en/posts/programmers-sql-01-select-from-where-order). I should check where `ORDER BY` falls in that execution order. Checking whether aliases defined with `AS` in `SELECT` can be used in `ORDER BY` might give the answer too.
- **Order of rows with equal sort values** — In the example above, I wrote that the order is "undetermined" if you don't add the second condition. I need to actually check what order the DB gives in practice, and whether the same order is guaranteed every time ([MySQL ORDER BY Optimization](https://dev.mysql.com/doc/refman/8.0/en/order-by-optimization.html)).
- **Where do `NULL`s go when mixed in?** — If the sorted column contains `NULL`, does it go first or last, and does this differ by DB?
- **Using it together with `LIMIT`** — Problems like "only the top N" probably need to cut the count after sorting. I need to check that syntax.
- **Using column numbers in `ORDER BY`** — I heard you can use ordinal numbers instead of column names, like `ORDER BY 1, 2`. I need to check whether this works, and whether it's recommended.