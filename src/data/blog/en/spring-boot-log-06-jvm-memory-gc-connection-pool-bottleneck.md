---
title: "Spring Boot #6 — Looking Into JVM Memory and GC, and a Connection Pool Bottleneck Experiment"
description: "I watched the heap with jps and jstat, and printed out GC logs. From the heap structure split into Young/Old, to the contrast with C's manual memory management, to reproducing a bottleneck where reducing the DB connection pool to 1 turned a 2-second task into a 6-second one."
pubDatetime: 2026-07-20T02:20:00Z
tags:
  - 백엔드공부
  - spring-boot
  - jvm
  - gc
  - 성능
  - 학습
draft: false
featured: false
---

In [Spring Boot #5 (Servlets, Embedded Tomcat, Thread Pool)](/en/posts/spring-boot-log-05-servlet-embedded-tomcat-thread-pool), I talked about the balance between the thread pool and the DB connection pool. This time, #6 goes one level deeper — I used tools to directly look into **how the JVM manages memory**, and I reproduced a **connection pool bottleneck** through an experiment.

## Table of contents

## Finding the PID with jps, and viewing the heap with jstat

First, I found the running Java process with `jps`. After confirming the **PID** of the server I had launched, I ran `jstat` against that PID to look into the heap state.

```bash
jstat -gc <PID>
```

![JVM heap capacity/usage by region as seen with jstat -gc (S0C/S1C, EC/EU, OC/OU, MC/MU, YGC, etc.)](/assets/posts/spring-boot-log-06-jvm-memory-gc-connection-pool-bottleneck/01-jstat-gc.webp)

A bunch of unfamiliar abbreviations show up, but once you know what the first letters stand for, it becomes readable.

- **E** = Eden, **S** = Survivor → these two make up the **Young region**
- **O** = Old region
- **C** = Capacity, **U** = Used
- **YGC** = number of Young GCs, **FGC** = number of Full GCs, **GCT** = total GC time

So `EC`/`EU` are Eden's capacity/usage, and `OC`/`OU` are Old's capacity/usage.

## JVM memory structure — Young and Old

JVM memory consists of the **heap**, which is broadly split into the **Young region (E, S)** and the **Old region (O)**.

Why bother splitting it up like this? While a program is running, there are a huge number of **temporary objects that get created and then disappear right away**. If you mix these together with long-lived objects, cleanup becomes cumbersome. So:

- **Young** — where newly created objects are born. Most of them die here quickly.
- **Old** — where objects that survived in Young and stuck around get moved.

Memory is managed by **splitting it into two parts based on object lifespan** like this.

## When the heap fills up, GC runs — checking it via logs

When the heap fills up, **GC (garbage collection)** kicks in and clears out unused objects. To see this with my own eyes, I turned on GC logging.

```bash
JAVA_TOOL_OPTIONS="-Xlog:gc" ./gradlew bootRun
```

With this running, I fired off enough requests to trigger GC, and logs showing **how much GC had cleaned up** were printed. The whole flow — heap fills up → GC runs → usage drops sharply — was right there in the logs.

## Contrast with C's manual management

I had heard a lot about garbage collection just by word of mouth before. When I worked with **C** in embedded software, I had to allocate memory manually (`malloc`) and free it manually (`free`). I had learned that Java solves this hassle — and the risk of leaks if you forget — **by handling it with GC instead**.

Today I actually confirmed that in practice. Since the JVM automatically cleans up unused objects, developers don't have to worry about freeing memory one by one. The runtime does what used to be done by hand in C. (Of course, "not having to worry about it" doesn't mean it's "free" — there's a cost while GC is running. That's a similar point to the connection pool experiment below.)

## Reducing the connection pool to 1 turns 2 seconds into 6 seconds

In [#5](/en/posts/spring-boot-log-05-servlet-embedded-tomcat-thread-pool), I only summarized the "balance between the thread pool and the DB connection pool" in words. This time, I **actually created that bottleneck myself.**

I manipulated `application.properties` like this:

- **Thread pool** — left at the default, plenty of room
- **DB connection pool** — restricted to **exactly 1**

Then I called **three concurrent 2-second DB commands.**

Result: it took **6 seconds**. With only one connection available, the three requests couldn't run side by side — they **lined up** and were processed one at a time. 2 seconds × 3 = 6 seconds. The threads had plenty of room, but there was a **bottleneck in front of the DB**.

After that, I lifted the connection pool restriction, and the same task dropped to **2 seconds**. This is because the three requests each grabbed their own connection and were processed **simultaneously**.

This was an actual reproduction of what I said in #5: "even if you hire 200 workers (threads), if the DB only allows 1 connection, 190 of them end up standing in line."

## Retrospective

Once again, the conclusion landed in the same place as previous posts. [#4's N+1](/en/posts/spring-boot-log-04-transaction-lazy-loading-n-plus-1), [#5's thread pool](/en/posts/spring-boot-log-05-servlet-embedded-tomcat-thread-pool), and today's GC/connection pool — all of these were about **"what actually happens behind the conveniently abstracted layer."**

What I liked in particular was that I didn't just read about the connection pool bottleneck — I **built it myself and saw it in numbers (2 seconds → 6 seconds).** With `jstat`, GC logs, and deliberate bottleneck experiments, I'm gradually picking up **ways to make invisible things visible using tools.**

## Things to study further

- **GC types and Stop-The-World** — Today I only saw GC "running." I want to look into collector types like G1 and ZGC, and how long the Stop-The-World pause — where the application briefly halts during GC — actually lasts. → [Oracle: HotSpot GC Tuning Guide](https://docs.oracle.com/en/java/javase/21/gctuning/index.html)
- **Reading through all the jstat columns** — What columns like `MC`/`MU` (Metaspace), `CCSC`/`CCSU`, and `CGC`, which I didn't cover today, actually mean. Why Metaspace is kept separate from the heap.
- **The right connection pool size** — 1 was an extreme case, so what's the right number? I want to apply the HikariCP pool sizing formula I [left off with in #5](/en/posts/spring-boot-log-05-servlet-embedded-tomcat-thread-pool) on top of this experiment. → [HikariCP: About Pool Sizing](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing)
- **Connection wait timeout** — When there's only 1 connection, does a fourth request wait indefinitely, or does it eventually fail with a timeout (HikariCP's `connection-timeout`)?
- **Do memory leaks happen in Java too** — Cases where memory leaks occur even with GC in place (e.g., continuously accumulating items in a collection, unreleased listeners). Exceptions to "GC handles it automatically."