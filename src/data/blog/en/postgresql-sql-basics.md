---
title: "PostgreSQL Basics — CRUD and the Korean Sorting (COLLATE) Trap"
description: "I'd only used SQLite before, and this was my first time touching PostgreSQL. From CREATE to CRUD mapping, and a collation issue where ORDER BY wasn't sorting in Korean alphabetical order."
pubDatetime: 2026-07-14T13:00:00Z
tags:
  - postgresql
  - sql
  - 데이터베이스
  - 학습
featured: false
draft: false
---

Today I learned PostgreSQL and SQL basics. I'd been working in a WSL2 environment until now, but today I got a used MacBook and studied on macOS instead. I'd used SQLite here and there, but this was my first time with PostgreSQL, so the syntax felt a bit unfamiliar.

## Table of contents

## Creating and Connecting to a Database

After installing PostgreSQL, the first thing I did was `CREATE`. I created a database, connected to it with `\c`, then created a table inside it.

```sql
CREATE TABLE todos (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    done BOOLEAN NOT NULL DEFAULT false
);
```

You can check the table list with `\dt`, and the schema with `\d todos`.

![Screen showing schema check with \dt and \d todos after CREATE TABLE](/assets/posts/postgresql-sql-basics/01-create-table.png)

When I set `BIGSERIAL` as the PRIMARY KEY, `\d todos` showed the default value set to `nextval('todos_id_seq'::regclass)`. I could see with my own eyes that what corresponds to SQLite's `AUTOINCREMENT` is handled internally by PostgreSQL as a sequence.

## How CRUD Maps to SQL

It struck me today that the CRUD operations I'd done in Java map directly onto the SQL I learned today.

| SQL | Operation | REST / Method Name |
| --- | --- | --- |
| `INSERT INTO` | Create | POST / create |
| `SELECT` | Read | GET / findAll |
| `UPDATE ... SET` | Update | PUT / update |
| `DELETE FROM` | Delete | DELETE / delete |

And almost always accompanying these commands is `WHERE`. It's the clause that determines **which target the operation should act on**, so it attaches to updates, deletes, and reads alike. It turned out to be the most versatile part.

## What Actually Matters Isn't SQL Syntax, but Data Structure Design

Going through all this, I had a realization. In databases, what matters far more than memorizing SQL syntax is **the ability to design a data structure**.

Once you've designed which data structure to store things in, implementing it in SQL is something AI can do quickly these days. But designing the structure to satisfy requirements while respecting constraints like primary keys and foreign keys is ultimately something a human has to judge.

## An Interesting Discovery — ORDER BY Wasn't Sorting in Korean Alphabetical Order

I ran into something interesting. I tried `ORDER BY title ASC` to sort titles in Korean alphabetical order, but **it wasn't sorted that way at all.**

![Screen showing ORDER BY title ASC result not in Korean alphabetical order — order was 청소하기, 밥 먹기, 스프링 공부, 책 읽기](/assets/posts/postgresql-sql-basics/02-order-by-wrong.png)

The result came out as "청소하기 → 밥 먹기 → 스프링 공부 → 책 읽기," which isn't Korean alphabetical order at all (which would be 밥 → 스프링 → 청소 → 책).

To find the cause, I checked the database's collation.

```sql
SELECT datcollate FROM pg_database WHERE datname = 'study';
```

The result was `en_US.UTF-8`. In other words, this database was sorting based on US English rules. It was laying out Korean text roughly by Unicode code point order rather than Korean language rules, so the result looked jumbled.

So I looked up which Korean collations were installed on the system.

```sql
SELECT collname FROM pg_collation WHERE collname LIKE 'ko%';
```

Thirteen came up, and I picked `ko-KR-x-icu` (a Korean locale provided by the ICU library). Specifying this explicitly with `COLLATE` gave me the sort order I wanted.

```sql
SELECT * FROM todos ORDER BY title COLLATE "ko-KR-x-icu" ASC;
```

You can specify collation per query with `COLLATE` like this, or bake it in at the column or database creation level. This time, I just changed it for a single query.

## Retrospective

The SQL commands themselves felt familiar, thanks to my SQLite experience. Even so, I arrived at the same conclusion twice today — **what's really worth studying is how to design the database structure, not the syntax.** The collation issue, too, turned out to be part of a design decision: "what rules should govern how this data is handled?"

## Things to Study Further

- **How to avoid attaching collation to every query** — Typing `COLLATE "ko-KR-x-icu"` every time is tedious. I want to compare specifying a default collation at the column definition level (`title VARCHAR(255) COLLATE "ko-KR-x-icu"`) versus at database creation time (`CREATE DATABASE ... LC_COLLATE`). → [PostgreSQL: Collation Support](https://www.postgresql.org/docs/current/collation.html)
- **What `ko-KR-x-icu` actually is** — The difference between collations with the `x-icu` suffix and libc-based collations (like `en_US.UTF-8`). Why ICU is needed. → [PostgreSQL: ICU Collations](https://www.postgresql.org/docs/current/collation.html#ICU-COLLATIONS)
- **`BIGSERIAL` vs `IDENTITY`** — The `nextval(...::regclass)` sequence approach I saw in `\d todos`. How this differs from `GENERATED ALWAYS AS IDENTITY`, which is recommended in modern PostgreSQL. → [PostgreSQL: Identity Columns](https://www.postgresql.org/docs/current/ddl-identity-columns.html)
- **Practicing data structure design** — Primary keys, foreign keys, normalization. Moving beyond a single todos table to practice tying multiple tables together with relationships (e.g., a users–todos relationship).
- **Indexes** — `\d todos` already showed `todos_pkey` set up as a btree index. How indexes connect to WHERE / ORDER BY performance.