---
title: "Spring Boot #3 — Connecting PostgreSQL with JPA · CRUD with Entities and Repositories"
description: "I replaced the in-memory List CRUD with an actual PostgreSQL setup. From build.gradle dependencies to application.properties, from record to @Entity, why JpaRepository is an empty interface but CRUD still works, and the dividend of layer separation where I didn't change a single line in the controller."
pubDatetime: 2026-07-15T02:25:00Z
tags:
  - 백엔드공부
  - spring-boot
  - jpa
  - postgresql
  - crud
  - 학습
draft: false
featured: false
---

In [Spring Boot #2 (CRUD with REST API · Layered Architecture)](/en/posts/spring-boot-log-02-rest-api-crud-and-layered-architecture), I handled CRUD with an **in-memory List**. It was a temporary store — restart the process and all the data disappears. Today I did the next step I'd noted under "things to study further" in #2: **connecting to a real DB with JPA**.

As it happens, I recently did CRUD directly with SQL in [PostgreSQL Basics](/en/posts/postgresql-sql-basics). This time, I did the same thing again, but in Java (JPA).

## Table of contents

## 1. build.gradle — Two dependencies

To use JPA, you first need to add dependencies to `build.gradle`. I needed two.

```gradle
dependencies {
    // JPA (Hibernate 포함) — 객체를 DB 테이블에 매핑
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
    // 자바가 PostgreSQL 과 실제로 말을 주고받는 통로 (JDBC 드라이버)
    runtimeOnly 'org.postgresql:postgresql'
}
```

`starter-data-jpa` is the ORM itself, and `postgresql` is the channel (driver) between Java and PostgreSQL. You can't have just one or the other — mapping would work but the connection wouldn't, or vice versa.

## 2. application.properties — Datasource + JPA settings

Next, I wrote the DB connection info and JPA behavior settings in `application.properties`.

```properties
# 어느 DB 에 붙을지
spring.datasource.url=jdbc:postgresql://localhost:5432/study
spring.datasource.username=<your_username>
spring.datasource.password=<your_password>

# JPA 동작 설정
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
```

> ⚠️ Never commit real values for `username` and `password`. Here I've left them as placeholders. In practice, it's safer to move them into environment variables or an `application-local.properties` file and add that to `.gitignore`.

## 3. Ditching record for @Entity

Up through #2, I used Java's `record` as the container for data. This time, I had to ditch that and switch to a **JPA entity class**.

```java
@Entity
public class Todo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;
    private boolean done;

    protected Todo() {}          // JPA 가 쓰는 빈 껍데기 생성자

    public Todo(String title) {
        this.title = title;
        this.done = false;
    }
    // getter / setter ...
}
```

- `@Entity` — marks this class as connected to a DB table
- `@Id` — designates the primary key
- `@GeneratedValue` — the DB auto-generates the primary key value (sequence/IDENTITY for PostgreSQL)

### Why record doesn't fit with JPA

I learned something here. **Why record doesn't work.**

When JPA builds an object from values read out of the DB, it first **creates an empty shell object**, then fills in the fields one by one. That means two things are required.

1. **A no-argument default constructor** — must be able to create an empty shell (hence `protected Todo() {}`)
2. **Fields must be changeable later** — since the object is created first and values filled in afterward

But `record` is the exact opposite. It requires all values at creation time and is **immutable** once created — you can't change the values afterward. This directly conflicts with JPA's "empty shell first, values later" approach. That's why I dropped record.

## 4. Repository — An empty interface, but CRUD works

The part I found most fascinating today. I created an interface called `Repository`:

```java
public interface TodoRepository extends JpaRepository<Todo, Long> {
    // 안이 비어 있다.
}
```

It only extends `JpaRepository<Todo, Long>` and **has nothing written inside**, yet CRUD methods like `save()`, `findAll()`, `findById()`, and `deleteById()` all become usable. It works even though I never wrote an implementation class.

I don't yet know exactly how this happens — it seems like Spring implements something for you at runtime, but I'll leave the mechanics of that for the "things to study further" section below.

## 5. Service — From ArrayList to Repository

The Service class changed drastically. Originally, it created an `ArrayList` directly inside the class to handle CRUD. Today, I replaced that with **calling the Repository** instead.

```java
// 전 (인메모리)
private final List<Todo> todos = new ArrayList<>();

// 후 (JPA)
private final TodoRepository todoRepository;
// ... todoRepository.save(todo), todoRepository.findAll() ...
```

Only the storage location moved — from an in-memory List to an actual DB. The **method names and return types** the service exposes to the outside stayed exactly the same.

## 6. I didn't change a single line in the Controller

And this is today's highlight. **I didn't touch the Controller at all.**

This was possible because, from the moment I first separated the layers, the controller only relies on the service's **return types and method names**. Even if the internals of the service get completely overhauled from a List to JPA, as long as the outer contract (method names and return types) stays the same, nothing has changed from the controller's perspective. So I just kept using it as is.

Even though this was a major change — swapping the storage from in-memory to a DB — the layer above (the controller) remained unaffected. This was the payoff of having separated the layers.

## 7. I didn't write any SQL, but SQL is running

Once I finished the setup, I found that **JPA was generating and calling SQL on its own**, even though I hadn't written a single line of SQL myself.

I recall previously handling a DB in Python by calling SQLite commands directly as strings. Comparing that experience to this one, it was pretty striking that I was only handling objects through JPA, yet the DB was actually being manipulated. (If you turn on `spring.jpa.show-sql=true`, you can see in the logs exactly what SQL JPA is actually sending.)

## Retrospective — What layer separation actually means

Working through today's example, I came to physically understand **what it means to separate layers**.

- **If the API address changes** → only change the controller
- **If the logic changes** → only change the service
- **If the storage method changes (List → DB)** → only change the inside of the service, and the controller stays the same (which is exactly what happened today)

There's a benefit for testing too. Because the layers are separated, you can **isolate just the layer you want to test** and verify it.

## Things to study further

- **How JpaRepository works without an implementation** — the magic of an empty interface still doing CRUD. I understand that Spring Data JPA generates a proxy implementation at runtime and injects it, but I want to know exactly how that works. → [Spring Data JPA Reference](https://docs.spring.io/spring-data/jpa/reference/repositories/core-concepts.html)
- **Seeing the actual SQL JPA generates** — reading through the `show-sql=true` logs and seeing how `INSERT`/`SELECT` statements get generated. Comparing this against the SQL I wrote by hand in [PostgreSQL Basics](/en/posts/postgresql-sql-basics).
- **The four `@GeneratedValue` strategies** — `IDENTITY` / `SEQUENCE` / `TABLE` / `AUTO`. Which one is right for PostgreSQL and which is better for performance. → [Baeldung: JPA @GeneratedValue](https://www.baeldung.com/hibernate-identifiers)
- **The `ddl-auto` option** — `update` / `create` / `create-drop` / `validate` / `none`. Why it's convenient during development but dangerous to use `update` in production.
- **Why the default constructor is `protected`** — why not `private` or `public`. JPA (via proxies) needs access, but my own code shouldn't be able to freely create empty objects — I want to understand this tradeoff more precisely.
- **The N+1 problem** — the famous performance trap you run into once relationships appear (e.g., user–todo). I haven't hit it yet since there's only one entity, but I want to get a feel for it before adding relationships.