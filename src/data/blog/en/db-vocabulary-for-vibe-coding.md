---
title: "DB & Data Modeling Vocabulary for Vibe Coding — From Normalization to Migration"
description: "Part 2 of the vocabulary series that follows the UI vocabulary post. Six core terms to help you move past vague instructions like 'just build me a DB' — normalization, relationships, indexes, transactions, isolation levels, migrations — woven into a single thread. Core concepts also come with a hands-on playground."
pubDatetime: 2026-06-16T12:30:00Z
tags:
  - DB
  - 바이브코딩
  - 용어정리
  - 데이터모델링
  - 학습
draft: false
featured: false
---

**Part 2 of the vocabulary series**, following [the UI vocabulary post](./ui-vocabulary-for-vibe-coding). If you don't know much about DBs, you end up giving the AI vague instructions like "just build me a DB," and then you can't even understand the code it writes. The goal of this post is to build up enough vocabulary that **even if you hand coding off to an AI, you can assign the work clearly**.

> 📍 The core concepts (normalization / relationships / indexes / transactions / isolation levels / migrations) each get their own hands-on section in the [playground](/playground/db-terms/) at the end of this post.

## Table of contents

## The 6 terms form a single thread

Don't memorize them separately. There's a flow.

| Group | Terms | Question |
|---|---|---|
| **How do you split and connect data** | Normalization · Relationships | How do you split up and store facts? |
| **How do you read it fast** | Indexes | How do you find things quickly? |
| **How do you bundle multiple operations safely** | Transactions · Isolation levels | How do you keep concurrent operations from colliding? |
| **How do you safely operate structural changes** | Migrations | How do you change the schema while running in production? |

## 1. Normalization

> **The process of splitting tables so that the same fact is stored in exactly one place, eliminating data duplication and inconsistency.**

The core concept is **functional dependency** — the relationship where "knowing A determines B." Normal forms are stages that progressively clean up this dependency.

### The 4 stages of normal forms

| Stage | Description |
|---|---|
| **1NF** | Column values must be **atomic**. Violated if you put multiple values in one cell or have repeating groups (e.g., `phone1`, `phone2`, `phone3`) |
| **2NF** | 1NF + **eliminate partial dependency**. With a composite key, separate out columns that depend on only part of the key |
| **3NF** | 2NF + **eliminate transitive dependency**. If a non-key column depends on another non-key column, split it out |
| **BCNF** | A stronger version of 3NF. **Every determinant must be a candidate key** |

### The 3 major anomalies normalization prevents

- **Insert anomaly**: If customers and orders are mixed in one table, **you can't register a customer without an order**
- **Update anomaly**: To change one customer's address, you have to **update every order row for that customer**
- **Delete anomaly**: Deleting the last order **also wipes out the customer's information**

### Denormalization isn't wrong either

There are cases where you **intentionally merge data rather than duplicate it by accident** — to avoid JOIN costs. Over-normalization can actually slow queries down by forcing 5-6 JOINs together.

> Normalization is the **default**; denormalizing based on observed performance is the normal flow.

→ In the **normalization section** of the playground, you can compare the same data before/after normalization and see exactly how an update anomaly occurs.

## 2. Relationships

> Connecting tables via a foreign key (FK) to express **"who points to whom."** There are three types: 1:1, 1:N, N:M.

| Pattern | Example | FK location |
|---|---|---|
| **1:N** (most common) | 1 customer — N orders | The FK goes **on the "N side"** |
| **1:1** | 1 user — 1 profile | Add a **`unique` constraint** on one side's FK |
| **N:M** | Posts ↔ Tags | **A junction table is required** — direct connection is impossible |

### FK delete behavior — CASCADE / SET NULL / RESTRICT

Options that determine what happens to child rows when the referenced row is deleted. If you don't understand these, data consistency breaks or data gets wiped unintentionally.

| Option | Behavior | When to use |
|---|---|---|
| **CASCADE** | Deleting the parent also deletes the children | When the child's existence is meaningfully dependent on the parent (deleting a post → deletes its comments) |
| **SET NULL** | Deleting the parent sets the child's FK column to NULL | When the child should survive even if the parent disappears (author deletes account → post stays, author field just goes blank) |
| **RESTRICT** (default) | **Refuses** to delete the parent if children exist | The safest default. Forces an explicit deletion flow |

→ In the **relationships section** of the playground, you can visually see where the FK goes for 1:N / N:M.

## 3. Indexes

> A **"lookup table"** data structure that pre-sorts the values of a specific column.

- No index: full scan — **O(n)**
- With index: **O(log n)** — for 1 million rows, that's 1 million comparisons vs. about 20

### Why B-tree is the default

Postgres's default is **B-tree** (a balanced tree). It maintains sorted keys in a tree so that search, insert, and delete are all guaranteed **O(log n)**. There are other types too, like GIN, GiST, and composite indexes, but I'll leave those as a separate topic to study.

### Indexes aren't free

- **Reads get faster, but writes get slower.** Every INSERT/UPDATE/DELETE also has to update the index
- **They also consume extra storage space**
- Conclusion: use them only where needed. Rather than adding indexes blindly from the start, the proper approach is to **add them afterward, at the points where queries are slow**

### When indexes don't help

- Adding a lot of indexes to a **write-heavy table** tanks INSERT speed
- **Low-cardinality columns** (columns with few distinct values, e.g., a boolean like `is_active`) get almost no benefit from an index

→ In the **indexes section** of the playground, you can directly compare the number of steps for a linear scan (full scan) vs. a B-tree index search.

## 4. Transactions

> A unit that bundles multiple operations into **"one thing that cannot be split,"** so they all succeed or all get undone.

The classic example: **a bank transfer.** If the system crashes between withdrawing from A and depositing into B — without a transaction, the money just evaporates. Wrapping it in a transaction means either both happen, or ROLLBACK leaves neither happening.

### ACID

| Property | Meaning |
|---|---|
| **A**tomicity | All or nothing. ROLLBACK on any mid-way failure |
| **C**onsistency | Can't commit into a state that violates constraints (FK · unique · check) |
| **I**solation | Concurrent execution looks as if each ran separately (→ section 5) |
| **D**urability | Once committed, data survives even if power is cut immediately after |

### WAL — Durability's actual implementation

**Write-Ahead Log**: **write the log first**, before modifying the data file. As long as it's in the log, the data can be reliably restored from it. Postgres / MySQL / SQLite all work on this same principle.

### The cost of transactions

> Holding a transaction open too long **blocks other work.** Row/table locks don't release until the transaction ends, hurting concurrency. The principle is "as short as necessary."

→ In the **transactions section** of the playground, you can run a transfer simulation and directly compare the outcomes with and without a transaction when a mid-way failure occurs.

## 5. Isolation Levels

> A dial that controls **how much of each other's intermediate state concurrently running transactions can see.** Stricter is safer but slower.

### 3 anomalies that need to be prevented

| Anomaly | What it is |
|---|---|
| **Dirty Read** | Reading someone else's uncommitted change |
| **Non-Repeatable Read** | Reading the same row twice but getting a different value because someone else changed it in between |
| **Phantom Read** | Querying with the same condition twice but getting different results because someone else added/deleted rows in between |

### The 4 standard levels (safer & slower as you go up)

| Isolation Level | Dirty | Non-Repeatable | Phantom |
|---|---|---|---|
| **Read Uncommitted** | Allowed | Allowed | Allowed |
| **Read Committed** (Postgres default) | Blocked | Allowed | Allowed |
| **Repeatable Read** | Blocked | Blocked | Allowed (per spec) |
| **Serializable** | Blocked | Blocked | Blocked |

### Optimistic locking vs. pessimistic locking

- **Optimistic**: Commit **if the version is the same** at read time and write time; otherwise retry. Efficient when conflicts are rare
- **Pessimistic**: **Lock the row first**, then operate. Safe when conflicts are frequent

### The trap — wrapping it in a transaction isn't the end of the story

Even if you wrap a `read-then-write` pattern in `BEGIN/COMMIT`, **it's still broken under Read Committed if you don't understand isolation levels.** The answer is an atomic `UPDATE` or an explicit lock.

```sql
-- 위험: Read Committed 에선 between read & write 사이에 변경 가능
BEGIN;
SELECT balance FROM accounts WHERE id = 1;  -- 1000원
-- 다른 트랜잭션이 여기서 출금 가능
UPDATE accounts SET balance = balance - 500 WHERE id = 1;
COMMIT;

-- 안전: 원자적 UPDATE
UPDATE accounts SET balance = balance - 500 WHERE id = 1 AND balance >= 500;
```

→ In the **isolation levels section** of the playground, you can step through the timeline of two transactions and see exactly how a dirty read occurs.

## 6. Migrations

> Recording database **structural (schema) changes** as ordered scripts, so the same state can be reproduced and rolled back in any environment.

In one line: **git for schema versions.** Each structural change gets committed to a file, so anyone applying it anywhere ends up with the same structure.

### How it works

1. Save each change as a **timestamped file** (e.g., `20260616_add_user_profile_column.sql`)
2. Keep a metadata table like `schema_migrations` in the DB to **track how far you've applied things**
3. Run only the not-yet-applied migrations, **in order**

### The risk of schema changes in production

> Changing the schema on a live service is risky.

- **Adding a column**: usually safe (defaults to NULL or a default value)
- **Deleting / renaming a column**: risky — errors out if existing code still references that column

### Expand-and-Contract pattern — zero-downtime changes

Rather than doing a big change all at once, **split it into 4 stages.**

```
1) Expand   : 새 컬럼/테이블 추가         (구 코드는 영향 없음)
2) Migrate  : 코드가 양쪽 다 쓰게 배포      (전환 기간)
3) Backfill : 데이터를 새 자리로 채워넣기
4) Contract : 옛 컬럼/테이블 제거           (모든 코드가 새 자리만 쓸 때)
```

### Other safety tips

- **`CREATE INDEX CONCURRENTLY`** — creates an index on a large table without locking (Postgres)
- **Don't touch things directly in the production console** — it's not reproducible, not rollback-able, and the next person won't know the schema state. Always go through a migration script

→ In the **migrations section** of the playground, you can visually see the 4 stages of expand-and-contract.

## Try it yourself in the playground

> 🎮 **[DB Vocabulary Playground](/playground/db-terms/)** — hands-on simulations of real data and transactions for all 6 concepts above.

- Before/after normalization comparison + update anomaly demo
- 1:N / N:M relationships and FK placement
- Comparing step counts: linear scan vs. B-tree index search
- Transfer outcome differences with and without a transaction
- Timeline of two transactions producing a dirty read
- The 4 stages of expand-and-contract migration

## Further study

### 1. FK behavior options in depth

- `ON UPDATE` also has `CASCADE` / `SET NULL` / `RESTRICT` — when to use each
- Trade-offs between soft delete (a `deleted_at` column) and hard delete + cascade

### 2. A full survey of index types

- Beyond B-tree: GIN, GiST, BRIN, Hash — which workload fits which
- Column order in **composite indexes** — the leftmost prefix rule
- Partial indexes, covering indexes, expression indexes
- Reference: [Postgres Index Types](https://www.postgresql.org/docs/current/indexes-types.html)

### 3. Isolation levels in practice

- Default isolation levels and actual behavior differences across Postgres / MySQL / SQLite
- The relationship between **Snapshot Isolation** and the standard isolation levels
- Which level fits which workload (Read Committed is fine for most cases; Serializable only when strong consistency is required)
- Reference: [Postgres Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)

### 4. Migration tools

- The Supabase migration workflow I use (`supabase migration new`, `supabase db push`)
- Other ecosystems: Prisma migrate / Alembic (Python) / Flyway / Liquibase
- Recovery patterns for failed migrations

### 5. Concurrency patterns, deeper

- **Advisory locks** (Postgres `pg_advisory_lock`) — locks acquired explicitly outside a transaction
- The difference between **SELECT ... FOR UPDATE** vs. `FOR SHARE`
- Implementation patterns for **Compare-And-Swap (CAS) / Optimistic Concurrency Control**
- Debugging race conditions — how to actually reproduce and catch them

### 6. Topics for the next post in the series

- **API vocabulary** (REST, status codes, idempotency, pagination)
- **Authentication & authorization** (already touched on once in [the Supabase OAuth post](./supabase-social-login-multiple-keys))
- **Performance optimization** (types of bottlenecks, profiling, caching)

## Retrospective

Applying the same tone I settled on for the UI post (why it's needed / a vocabulary table / good prompts / a playground) to DB content, **the series' consistency clearly held together.** Sticking with the same framework for future posts should reduce the writing burden for me, and let readers predict where to find what.

DB concepts are more abstract than UI ones, so designing the playground was harder. But framing it as **"simulations that show concepts as actual data changes"** ended up working surprisingly well. Something like dirty reads under isolation levels is genuinely hard to understand without a visual, so the playground feels like a supporting asset that pushed the post's value up a notch.