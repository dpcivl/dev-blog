---
title: "Spring Boot #5 — Servlets, Embedded Tomcat, Thread Pools, and the WAS Layer"
description: "Every time I fired off a curl request, a new thread got added. Here's a breakdown of how Tomcat pre-hires workers and assigns requests to them, the balance between thread pools and DB connection pools, and the confusing dual identity of 'Apache'."
pubDatetime: 2026-07-17T05:00:00Z
tags:
  - 백엔드공부
  - spring-boot
  - tomcat
  - 서블릿
  - was
  - 학습
draft: false
featured: false
---

Through [Spring Boot #4 (Transactions · Associations · N+1)](/en/posts/spring-boot-log-04-transaction-lazy-loading-n-plus-1), I was looking inside the code I wrote myself. This time, in #5, I went one layer down — into **Tomcat, the thing that actually runs my code.**

## Table of contents

## Servlets and Tomcat — Spec and Runner

First, I sorted out two terms.

- **Servlet** — a Java **spec for handling web requests**
- **Tomcat** — a program that **runs** those servlets

It's a spec-and-runner relationship. If a servlet is a promise that says "web requests will be handled in this shape," Tomcat is the one that actually carries out that promise.

## A New Thread for Every curl Request

I checked this myself. Every time I ran the request below, **a new thread got created.**

```bash
curl http://localhost:8080/was/thread
```

Here's how Tomcat works: **it pre-hires workers (threads) and assigns them to incoming requests.** Rather than hiring a new worker for every single request, it attaches one of the workers already waiting on standby. This is the **thread pool**.

## I Decide the Number of Threads

How many workers to keep around is decided in `application.properties`.

```properties
server.tomcat.threads.max=200          # maximum number of workers to hire
server.tomcat.threads.min-spare=10     # minimum number to keep on standby even when idle
```

- `threads.max` — the upper limit on workers
- `threads.min-spare` — the minimum headcount to always keep ready, even when idle

## Something to Think About — When Concurrent Connections Pile Up

I already knew the concept of threads, so today's material wasn't hard. But there was a point worth thinking through.

**If concurrent connections suddenly pile up, the Tomcat thread pool gets jammed.** If more customers show up than there are prepared workers, the rest **wait**.

But I can't just keep increasing the number of workers, either. **Each individual thread eats up a fair amount of memory.** If I blindly crank up `threads.max`, memory blows up instead. In the end, this isn't a "more is better" situation — it's a **matter of balance**.

## Not Just One Pool — Thread Pool vs. DB Connection Pool

I also realized the thread pool isn't the only pool. There's a separate **DB connection pool**.

| | Thread Pool | DB Connection Pool |
|---|---|---|
| What it manages | Workers (threads) that handle requests | DB connections |
| Related layer | Controller · Service | DB |
| Purpose | Handling concurrent requests | Reducing bottlenecks on the DB side |

If the thread pool is about the controller/service side, the DB connection pool is **a pool for reducing DB-related bottlenecks**. And **these two pools need to be balanced against each other properly.** (If you've hired 200 workers but only have 10 DB connections, 190 of them will be standing in line in front of the DB.)

## WAS · Web Server · and the Confusing "Apache"

What I learned about Tomcat today is that its true identity is **WAS (Web Application Server)**.

There's a naming confusion here. Tomcat's official name is **Apache Tomcat**, so the word "Apache" can point to different things depending on context.

- **Apache Tomcat** — the WAS. The thing that runs servlets. (I've seen "Apache" used to mean this in backend contexts.)
- **Apache HTTP Server** — the **web server**. When "Apache" comes up in infrastructure contexts, this is usually what's meant.

Both are Apache Foundation projects, so the names just happen to overlap — they're **entirely different things**. So whenever the word "Apache" comes up, I need to first check which layer is being discussed.

## User → Web Server → WAS → DB

Roughly speaking, the backend operates through this flow.

<img src="/assets/mermaid/f697e5047f1b729c.svg" alt="사용자에서 웹 서버, WAS, DB 로 이어지는 백엔드 요청 흐름도" style="max-width:100%;height:auto;" />

And apparently, **Nginx** is widely used as a web server these days. It's **lighter and better suited for handling concurrent connections** than Apache HTTP Server.

## Retrospective

Up until now, even while writing controllers, services, and repositories, I'd never thought about **where and how they actually run**. Opening up the layer beneath them today, I found Tomcat pre-hiring workers and assigning them to requests.

What was interesting was that everything I learned today boiled down to **"the limits of things I'd been using comfortably."** The thread pool is convenient, but it jams up under load, and increasing it eats memory. [The N+1 and dirty checking issue from #4](/en/posts/spring-boot-log-04-transaction-lazy-loading-n-plus-1) had the same flavor to it — you have to look at what's running underneath a convenient abstraction.

## Things to Study Further

- **What exactly the `slow()` method in the example was** — There was a method like `slow()` in the example code I looked at today, but I haven't confirmed exactly what it's for. (My **guess** is that it's a test method that deliberately delays a request to demonstrate a thread getting held up — need to verify.)
- **What number `threads.max` should actually be set to** — Where the default value of 200 came from, and how it should change depending on server specs and request characteristics (CPU-bound vs. I/O-bound). → [Spring Boot: Server Properties](https://docs.spring.io/spring-boot/appendix/application-properties/index.html#appendix.application-properties.server)
- **Determining DB connection pool size** — How to match the `maximum-pool-size` of HikariCP, Spring Boot's default connection pool, against the thread pool. I have a gut sense that "connections should be fewer than threads," but I want to know if there's a formula backing that up. → [HikariCP: About Pool Sizing](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing)
- **How much memory a single thread actually uses** — Turning the vague sense of "it eats a lot" into actual numbers, tied to the JVM thread stack size (`-Xss`).
- **Why Nginx is better suited for concurrent connections** — Going beyond "it's lightweight" to explain it in terms of the difference between event-driven architecture and process/thread-based architecture.
- **Ways to go beyond thread pool congestion** — I've heard there are other approaches like async/non-blocking (WebFlux), and I want to understand how that changes this "worker assignment" model.