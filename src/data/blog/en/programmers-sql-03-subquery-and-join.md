---
title: "Programmers SQL #3 — Having two tables doesn't mean writing FROM twice"
description: "I ran into a problem with two tables for the first time. Writing FROM twice didn't work, so I solved it with a subquery using IN. JOIN gives the same answer."
pubDatetime: 2026-09-06T06:30:00Z
tags:
  - 프로그래머스
  - sql
  - 학습
draft: false
featured: false
---

This is the third SELECT problem from the Programmers SQL High Score Kit.

I thought I might not need SQL anymore since I seem to be heading toward RAG work, but apparently RAG also needs data preprocessing and cleaning. So I decided to keep studying it.

## Today's problem

[Choosing Ice Cream Made from Fruit](https://school.programmers.co.kr/learn/courses/30/lessons/133025) — Result: success.

The problem asks for flavors whose total order volume in the first half exceeded 3000 and whose main ice cream ingredient is fruit-based, sorted by total order volume in descending order. The information is split across two tables, `FIRST_HALF` and `ICECREAM_INFO`.

Here's the answer I submitted:

```sql
SELECT FLAVOR
FROM FIRST_HALF
WHERE TOTAL_ORDER > 3000
AND FLAVOR IN (SELECT FLAVOR FROM ICECREAM_INFO
              WHERE INGREDIENT_TYPE = "fruit_based")
ORDER BY TOTAL_ORDER DESC
```

## Where I got stuck

**This was the first time I ran into a problem with two tables.** Problems 1 and 2 only had one table each, and the conditions were simple enough that I could solve them with bits and pieces I'd picked up here and there. This time, though, there were two tables, and the problem even used the term "primary key." I didn't know how to handle a primary key, so I spent a long time wondering how the two tables could even be connected.

## What I learned

### A single query only uses one `FROM`

At first, even though I suspected it wouldn't work, I tried running a query with two `FROM` clauses. Of course it failed. Since the problem involved two tables, I figured I'd need `FROM` twice, but just throwing it in blindly wasn't the answer.

To be precise, though, **it's the `FROM` clause that's singular, not the number of tables.** You can list multiple tables after a single `FROM`, separated by commas.

```sql
FROM FIRST_HALF, ICECREAM_INFO   -- syntactically valid
FROM FIRST_HALF
FROM ICECREAM_INFO               -- this doesn't work
```

What I got stuck on was the second case. The first form ties into the `JOIN` discussion below, so I'll cover it separately.

### Use `AND` to add another condition

To add another condition, I needed `AND`. I attached `AND` to the `WHERE` clause so both conditions would be checked together.

### `IN` lets you attach a subquery

When you need a condition that comes from another table rather than the main query, you use `IN`. It keeps only the values that appear within the subquery's result. This is the approach I used in my submitted answer.

That said, **having two tables doesn't automatically mean you need a subquery.**

### Using `JOIN` for the first time

`JOIN` is a name I kept hearing during data analysis training. Apparently it's used when you want to display values from two tables together, or line them up side by side based on a shared key.

If I had used `JOIN` to produce the answer, it would look like this:

```sql
SELECT F.FLAVOR
FROM FIRST_HALF F
JOIN ICECREAM_INFO I ON F.FLAVOR = I.FLAVOR
WHERE F.TOTAL_ORDER > 3000
  AND I.INGREDIENT_TYPE = 'fruit_based'
ORDER BY F.TOTAL_ORDER DESC;
```

I gave `FIRST_HALF` the alias `F` and `ICECREAM_INFO` the alias `I`. In the `ON` clause that follows `JOIN`, specifying that `F`'s `FLAVOR` equals `I`'s `FLAVOR` tells SQL how to match up rows between the two tables.

This is where the "primary key" mentioned in the problem comes into play. The hint was that both tables had a column with the same name, but I didn't realize at the time that this was the connecting link.

## Reflection

Trying `FROM` twice wasn't a waste of effort. It was only after confirming that it didn't work that I moved on to the question of "so where do the two tables actually meet?"

This was also the first time I saw that one problem could be solved two different ways. A subquery works, and so does `JOIN`. I don't yet have criteria for judging which is better, so for now I'll just leave it at having tried both.

## Things to study further

- **When to use an `IN` subquery versus `JOIN`** — Since both produce the same answer, there must be some criteria for choosing between them. I'm also curious whether there are cases where the results diverge. I've heard that when the subquery side has duplicate values, `JOIN` can end up producing extra rows → [MySQL: Optimizing Subqueries](https://dev.mysql.com/doc/refman/8.0/en/subquery-optimization.html)
- **The relationship between `FROM A, B` and `JOIN`** — I've heard that the comma-separated style is the older syntax and that `JOIN` replaced it, but I want to know exactly what's the same and what's different → [MySQL: JOIN Clause](https://dev.mysql.com/doc/refman/8.0/en/join.html)
- **Whether double quotes are okay for strings** — My submitted answer used `"fruit_based"`, while my `JOIN` example used `'fruit_based'`. Both passed, but apparently standard SQL calls for single quotes. I need to check whether this varies by database.
- **What exactly a primary key is** — This term came up in the problem, and I only understood it loosely as "a value that distinguishes each row." Looking at its relationship with foreign keys too should help me understand `JOIN` better.
- **Types of `JOIN`** — I've heard there's `INNER`, `LEFT`, and `RIGHT`. First thing to check: which type is the `JOIN` I used this time.