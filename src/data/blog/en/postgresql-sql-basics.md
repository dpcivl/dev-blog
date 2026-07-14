---
title: "PostgreSQL Basics — CRUD and the Korean-Sorting (COLLATE) Trap"
description: "Coming from SQLite, I picked up PostgreSQL for the first time. From CREATE to how CRUD maps onto SQL, and the collation problem where ORDER BY refused to sort Korean alphabetically."
pubDatetime: 2026-07-14T13:00:00Z
tags:
  - postgresql
  - sql
  - 데이터베이스
  - 학습
featured: false
draft: false
---

Today I learned the basics of PostgreSQL and SQL. Until now I'd been working in a WSL2 environment, but today I picked up a used MacBook and studied on macOS. I've used SQLite here and there, but PostgreSQL was new to me, so the syntax felt a little unfamiliar.

## Table of contents

## Creating a database and connecting to it

After installing PostgreSQL, the first thing I did was `CREATE`. I created a database, connected to it with `\c`, and then made a table inside it.

```sql
CREATE TABLE todos (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    done BOOLEAN NOT NULL DEFAULT false
);
```

You can check the list of tables with `\dt` and a table's schema with `\d todos`.

![Checking the schema with \dt and \d todos after CREATE TABLE](/assets/posts/postgresql-sql-basics/01-create-table.png)

When I set `BIGSERIAL` as the PRIMARY KEY, `\d todos` shows the default value as `nextval('todos_id_seq'::regclass)`. I could see with my own eyes that the equivalent of SQLite's `AUTOINCREMENT` is handled internally by PostgreSQL as a sequence.

## How CRUD maps onto SQL

It struck me that the CRUD I'd done in Java maps directly onto the SQL I learned today.

| SQL | Action | REST / method name |
| --- | --- | --- |
| `INSERT INTO` | create | POST / create |
| `SELECT` | read | GET / findAll |
| `UPDATE ... SET` | update | PUT / update |
| `DELETE FROM` | delete | DELETE / delete |

And the clause that shows up almost every time you use these commands is `WHERE`. Since it decides **which rows you're targeting the operation at**, it attaches to updates, deletes, and reads alike. It was the most broadly useful of the bunch.

## What actually matters isn't the SQL — it's the data structure design

Working through all this, here's the thought I landed on. On the database side, being able to *sketch out the data structure* matters far more than memorizing this SQL syntax.

Once you've designed what data structure to store things in, implementing it in SQL is something AI can spit out quickly these days. But designing the structure to meet the requirements — honoring constraints like primary keys and foreign keys — is ultimately a judgment call a human has to make.

## An interesting discovery — ORDER BY wasn't sorting alphabetically

I ran into something interesting. I tried to sort titles alphabetically with `ORDER BY title ASC`, but **it didn't sort in Korean alphabetical order.**

![The ORDER BY title ASC result isn't in Korean alphabetical order — 청소하기, 밥 먹기, 스프링 공부, 책 읽기](/assets/posts/postgresql-sql-basics/02-order-by-wrong.png)

The output came out as "청소하기 → 밥 먹기 → 스프링 공부 → 책 읽기", which is nowhere near Korean alphabetical order (밥 → 스프링 → 청소 → 책).

To find the cause, I checked the database's collation (sort rule).

```sql
SELECT datcollate FROM pg_database WHERE datname = 'study';
```

The result was `en_US.UTF-8`. In other words, this database was sorting on a US-English basis. Because it lined Korean characters up by something close to Unicode code-point order rather than by Korean rules, they looked all jumbled.

So I looked for the Korean collations installed on the system.

```sql
SELECT collname FROM pg_collation WHERE collname LIKE 'ko%';
```

Thirteen showed up, and out of them I picked `ko-KR-x-icu`. (It's the Korean locale provided by the ICU library.) When I specified this with `COLLATE`, the sorting came out the way I wanted.

```sql
SELECT * FROM todos ORDER BY title COLLATE "ko-KR-x-icu" ASC;
```

You can specify the sort rule ad hoc like this, per query with `COLLATE`, or you can bake it in at the column level or when creating the database. This time I just changed it once in the query.

## Wrapping up

The SQL commands themselves were familiar (thanks to my SQLite experience). Even so, I arrived at the same conclusion twice today — **the real thing worth studying is how you design the database structure, not the syntax.** The collation problem, too, was ultimately part of a design decision: "by what rules should this data be handled?"

## Further study

- **How to avoid attaching a collation to every query** — writing `COLLATE "ko-KR-x-icu"` every time is tedious. Compare specifying a default sort rule in the column definition (`title VARCHAR(255) COLLATE "ko-KR-x-icu"`) or at database creation (`CREATE DATABASE ... LC_COLLATE`). → [PostgreSQL: Collation Support](https://www.postgresql.org/docs/current/collation.html)
- **What `ko-KR-x-icu` really is** — the difference between an `x-icu`-suffixed collation and a libc-based one (like `en_US.UTF-8`), and why ICU is needed. → [PostgreSQL: ICU Collations](https://www.postgresql.org/docs/current/collation.html#ICU-COLLATIONS)
- **`BIGSERIAL` vs `IDENTITY`** — the `nextval(...::regclass)` sequence approach I saw in `\d todos`. How it differs from `GENERATED ALWAYS AS IDENTITY`, which is recommended in recent PostgreSQL. → [PostgreSQL: Identity Columns](https://www.postgresql.org/docs/current/ddl-identity-columns.html)
- **Practicing data structure design** — primary keys, foreign keys, normalization. Moving beyond a single `todos` table to exercises that tie multiple tables together with relationships (e.g. a user–todo relationship).
- **Indexes** — `\d todos` already had `todos_pkey` set up as a btree index. How WHERE / ORDER BY performance connects to indexes.
