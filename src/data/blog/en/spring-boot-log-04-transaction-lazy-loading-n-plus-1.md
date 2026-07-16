---
title: "Spring Boot #4 — Transactions, Relationships, N+1, and Fetch Join"
description: "I connected entities with @ManyToOne and ran a full query, and instead of 1 query, 6 came out. I fixed the N+1 problem caused by LAZY loading with fetch join, and worked through the atomicity and dirty checking of @Transactional."
pubDatetime: 2026-07-16T01:50:00Z
tags:
  - 백엔드공부
  - spring-boot
  - jpa
  - 트랜잭션
  - 학습
draft: false
featured: false
---

In [Spring Boot #3 (Connecting JPA to PostgreSQL)](/en/posts/spring-boot-log-03-jpa-postgresql-entity-repository), I attached a single entity to the DB. In this #4 post, I **grew that to two entities linked by a relationship**, and here I go over the two things I ran into along the way — **transactions** and **the N+1 problem**.

## Table of contents

## Transactions — all or nothing

First, transactions. In one sentence: **"everything succeeds, or everything fails."** There's no in-between state where only part of the work gets applied. Multiple operations are bundled into one, and if even one fails, the whole thing gets rolled back.

## Connecting two tables — @ManyToOne · @JoinColumn

I set up a **many-to-one (N:1)** relationship between entities. For example, multiple to-do items (Todo) belong to a single user (User).

```java
@Entity
public class Todo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;

    @ManyToOne(fetch = FetchType.LAZY)   // 다(Todo) : 일(User)
    @JoinColumn(name = "user_id")        // 외래키 컬럼 지정
    private User user;
}
```

- `@ManyToOne` — marks this entity (Todo) as the "many" side, with the other entity (User) as the "one" side
- `@JoinColumn` — specifies the **foreign key** column linking the two tables

Here I set `fetch = FetchType.LAZY`, i.e. **lazy loading**. When I fetch a Todo, the associated User isn't loaded right away — it's only fetched **the moment `todo.getUser()` is actually touched**. This becomes the seed of the N+1 problem later.

## Building a DTO with record (via a static factory)

I built a response DTO, and ran into something new here. **A DTO doesn't have to be a `public class` — a `public record` works too.**

```java
public record TodoResponse(Long id, String title, String userName) {
    public static TodoResponse from(Todo todo) {
        return new TodoResponse(todo.getId(), todo.getTitle(), todo.getUser().getName());
    }
}
```

I used a static factory method called `from` to handle the entity-to-DTO conversion. (In [#3](/en/posts/spring-boot-log-03-jpa-postgresql-entity-repository), I said JPA entities don't fit `record` well because their values need to change — but a DTO is the opposite. It's an immutable response object created once and never modified, so `record` fits it perfectly.)

But that line inside `from` — `todo.getUser().getName()`, which pulls out a User marked LAZY — causes a problem when it runs inside a loop.

## @Transactional — read-only by default, write access only where needed

I attached `@Transactional` to the Service to set up transactions. The strategy: **make the class default read-only, and grant write access only to the specific methods that need it.**

```java
@Service
@Transactional(readOnly = true)      // 기본: 읽기 전용
public class TodoService {

    public List<TodoResponse> findAll() { ... }   // 읽기 → 기본값 그대로

    @Transactional                    // 이 메서드만 쓰기 허용
    public void updateTitle(Long id, String title) { ... }
}
```

Making read-only the default prevents accidental writes from leaking in, and it also has performance benefits. Only where writes are needed do I explicitly attach `@Transactional` to open up write access.

## I ran a full query and got 6 queries — the N+1 problem

After writing all the code, I ran a full query. But looking at the logs, **an oddly large number of queries went out.**

Fetching 5 Todos should obviously take just 1 SELECT. But after that, **5 more SELECTs** went out. 6 in total.

### What is N+1?

This is exactly the **N+1 problem**. As the name suggests, it's a situation where **1 + N queries** are issued.

1. **1 query** — the query that fetches the Todo list (`SELECT * FROM todos`) → retrieves 5 rows
2. **N queries** — every time `todo.getUser().getName()` is called during conversion to a DTO, the User that was deferred as LAZY gets fetched right then (`SELECT * FROM users WHERE id = ?`) → 5 rows means 5 queries

In other words, it's caused by **LAZY loading**. Because the associated entity gets fetched separately each time, extra queries fire proportional to the size of the list (N). With 5 rows it's 6 queries, but with 100 rows it becomes 101. The larger the list, the worse the disaster.

## The fix — fetch join (LEFT JOIN FETCH)

Cases like this are solved with a **fetch join**. In this example, I added it directly via `@Query` inside the repository interface.

```java
public interface TodoRepository extends JpaRepository<Todo, Long> {

    @Query("SELECT t FROM Todo t LEFT JOIN FETCH t.user")
    List<Todo> findAllWithUser();
}
```

It's an ordinary JOIN, but with **`FETCH`** attached. That's the key part. `JOIN FETCH` **pulls in the associated User all at once** when fetching the Todo. So even when `getUser()` is called later, no extra query fires — it's already been loaded. The 6 queries drop down to **1**.

## I removed save, but UPDATE still happens — dirty checking

One more thing I found interesting: after I **removed** the `save()` call I'd originally used in the update logic, the update still worked correctly.

```java
@Transactional
public void updateTitle(Long id, String title) {
    Todo todo = todoRepository.findById(id).orElseThrow();
    todo.setTitle(title);      // 값만 바꾼다. save() 안 함.
}
```

An UPDATE went out to the DB even though `save()` was never called. As it turns out, this is **thanks to `@Transactional`**. JPA keeps watching entities fetched inside a transaction, and **when it detects a change in value, it automatically issues an UPDATE query when the transaction ends.** This is called **dirty checking**.

## Retrospective

Today's takeaway (TIL):

> Pulling a LAZY-associated entity out inside a loop triggers N+1 (1+N queries). Fetching it all at once with `LEFT JOIN FETCH` reduces it to 1 query. `@Transactional` guarantees all-or-nothing success, and entities fetched within it get their changes applied via dirty checking, even without calling `save`.

Things that didn't show up when there was just one entity all came pouring out the moment I tied two of them together with a relationship. Relationships, for all their convenience, were quietly multiplying queries behind the scenes. Transactions, for all their convenience, were quietly firing UPDATEs on my behalf. I learned that you have to look at the flip side of "convenient."

## Things to study further

- **The limits of fetch join** — apparently, fetch-joining a collection (one-to-many, `@OneToMany`) breaks pagination or produces duplicate rows. I didn't run into this today since it was a many-to-one (single) association, but I want to see how things change with a collection. → [Hibernate: Fetching](https://docs.jboss.org/hibernate/orm/current/userguide/html_single/Hibernate_User_Guide.html#fetching)
- **`@EntityGraph` · `@BatchSize`** — other ways to solve N+1 besides fetch join. Comparing when each is better to use.
- **The cost of dirty checking** — apparently JPA has to hold onto a snapshot to watch an entity, and I want to know whether this becomes a burden for bulk updates. How it differs from bulk operations (`@Modifying @Query`).
- **What `@Transactional(readOnly = true)` actually optimizes** — whether it's just a write-prohibition flag, or whether it has separate performance benefits like skipping the dirty-checking snapshot.
- **Transaction propagation · isolation levels** — what happens when one transactional method calls another inside a transaction, and how isolation levels differ under concurrent access. → [Spring: Transaction Management](https://docs.spring.io/spring-framework/reference/data-access/transaction.html)