---
title: "Java Study #3 — Exception Handling · Concurrency · record · Modern Java · Gradle"
description: "Wrapping up the Java syntax sweep. Understood that exception handling isn't about debugging convenience — it's a safeguard so backend servers don't die in production. The difference between print vs throw — print doesn't convey failure to the caller, but exceptions force propagation. Concurrency with ExecutorService · newFixedThreadPool — 3 seconds sequential → 1 second parallel (measured 3008ms → 1006ms). record auto-generates fields, constructor, accessors, toString, equals, hashCode — a perfect fit for pure data containers like RainDataDTO from a rain gauge data logger. Also covered Modern Java features like var/switch arrows/text blocks. Finally, Gradle — once you have hundreds of files, compiling one by one with java is impossible, and it also auto-fetches external libraries. build.gradle is the core config file."
pubDatetime: 2026-07-07T05:00:00Z
tags:
  - 백엔드공부
  - java
  - backend
  - 예외처리
  - 동시성
  - gradle
  - 학습
draft: false
featured: false
---

Continuing from [Java #2 Collections · Stream part](/en/posts/java-study-log-02-collections-and-streams), wrapping up the Java syntax sweep in this post. Today's goal is to roughly finish sweeping through Java syntax — **exception handling · concurrency · record · Modern Java · Gradle**.

## Table of contents

## 1. Exception Handling — A Safeguard So "The Server Doesn't Die"

Code: [`ExceptionDemo.java`](https://github.com/dpcivl/be-study/blob/main/week2-collections/ExceptionDemo.java)

I used to think exception handling was mostly for **debugging convenience**. What clicked this time was this:

> **If an exception isn't caught in production, the backend server itself can die.** Exception handling is the safeguard that keeps the service alive.

Running locally, it's just "check the error log → fix it." But in a real service, if a single request dies from an exception, **not just the user who sent that request, but the thread itself can terminate**. `try / catch` is the wall in between.

## 2. Custom Exceptions — Why Use Exceptions Instead of print

Code: [`CustomExceptionDemo.java`](https://github.com/dpcivl/be-study/blob/main/week2-collections/CustomExceptionDemo.java)

**Custom exception** = turning a specific exceptional situation into a reusable class. You throw it like `throw new InvalidAgeException(...)`, and catch it above with `catch (InvalidAgeException e)`.

Why throw an exception instead of just doing `System.out.println("Error!")` — here's the intuition I got this time:

- **`print` doesn't convey the fact that "it failed" to the caller.** The function just passes through quietly, and the caller thinks it succeeded.
- **`throw` is forcibly propagated up the call stack.** If it's not handled, the thread dies (unchecked) or the code doesn't compile (checked). It's a contract that makes it impossible to ignore the fact that something failed.

Conceptually this is the same as Python's raise / try / except, but **Java has a separate category called checked exceptions**, which requires you to **declare in the method signature** that "this method can throw this exception." This is a level of enforcement that doesn't exist in Python/JS.

## 3. Concurrency — 3 Seconds Sequential → 1 Second Parallel

Code: [`ThreadDemo.java`](https://github.com/dpcivl/be-study/blob/main/week2-collections/ThreadDemo.java)

Parallelized a task that was previously processed sequentially, using **`ExecutorService` + `newFixedThreadPool`**. With 3 tasks that each take 1 second:

- **Sequential**: 1 second × 3 = 3 seconds
- **Concurrent (thread pool of 3)**: throw one to each of 3 threads → done in 1 second

Actual run result:

![ThreadDemo execution — sequential 3008ms vs concurrent (pool-1-thread-1/2/3) 1006ms](/assets/posts/java-study-log-03-exceptions-concurrency-and-gradle/01-thread-demo-output.png)

**3008ms → 1006ms** — almost matches the theoretical value. The threads show up in the log as `pool-1-thread-1`, `pool-1-thread-2`, `pool-1-thread-3`, so parallel execution is visible.

This is the principle behind how backend servers handle multiple requests concurrently. Frameworks like Spring Boot also run this kind of thread pool internally.

## 4. record — An Object That Carries Data

Code: [`RecordDemo.java`](https://github.com/dpcivl/be-study/blob/main/week2-collections/RecordDemo.java)

**`record`** = a data container you use instead of `class`. Its purpose is to **carry data only**, with no behavior.

```java
record Person(String name, int age) {}
```

With just this one line, Java generates **fields · constructor · accessors · `toString` · `equals` · `hashCode`** all for you. Making the same thing with a class would take dozens of lines of boilerplate.

Back when I was looking at the source code for a rain gauge data logger, there was a file called `RainDataDTO` — a class packed with a few fields and nothing but getters/setters. I got the sense that this kind of **"a set of data" type** is exactly what record replaces.

## 5. Modern Java — var · switch Arrow · Text Blocks

Code: [`ModernDemo.java`](https://github.com/dpcivl/be-study/blob/main/week2-collections/ModernDemo.java)

Three modern Java features — things that feel familiar if you're coming from Python:

- **`var`** — type inference. Like `var name = "hyoin";`, the type is inferred from the right-hand side
- **`switch` arrow** — the `case ... ->` syntax [I already covered in #1](/en/posts/java-study-log-01-first-syntax-and-oop-basics#switch--the-arrow-style)
- **Text blocks** — multi-line strings with `"""..."""` (similar to Python triple-quoted strings)

There's a perception that Java = lots of old-style boilerplate, but using these recent syntax features makes it **as concise as Python**.

## 6. Gradle — Why Is It Needed

Up to this point, I ran the example files one by one with `java ExceptionDemo.java`. But **once you have dozens or hundreds of files** — compiling them one by one becomes impossible. And to use **external libraries** (e.g., Jackson, Guava, Spring Boot), manually downloading them and adding them to the classpath isn't realistically feasible.

**What Gradle does:**

1. **Dependency management** — write a library in `dependencies` and it gets fetched automatically
2. **Compile & build** — the whole project at once
3. **Packaging** — bundles into a `.jar` that can be deployed to a server

Spring Boot projects are Gradle-based by default too, so it's a tool you have to meet eventually anyway.

### Gradle Project Structure

![gradle-demo project structure — app/build.gradle, gradle/wrapper, gradle.properties, gradlew, settings.gradle](/assets/posts/java-study-log-03-exceptions-concurrency-and-gradle/02-gradle-project-structure.png)

- **`build.gradle`** — the core config file. Libraries are declared in `dependencies`
- **`gradlew` / `gradlew.bat`** — per-project Gradle execution wrapper (eliminates worries about Gradle version mismatches between teammates)
- **`settings.gradle`** — project name, submodule configuration

### Commands

```bash
gradle run       # run
gradle build     # build → generates app/build/libs/app.jar
```

Upload `app.jar` to a server and run it with `java -jar app.jar`, and deployment is done.

## Retrospective

Three things that clicked in this post:

1. **Exception handling isn't for debugging, it's a tool for service availability** — a contract to keep the server alive in production. This is why print can't be a substitute (it forces failure to be conveyed to the caller).
2. **Concurrency is a tool that "turns a 10-second problem into a 1-second problem"** — throw it at a thread pool and it parallelizes exactly as the theory predicts. But this only holds when "tasks are independent of each other." When there's shared state, new problems like race conditions and deadlocks open up (an advanced topic).
3. **Gradle is "the thing I'd been putting off because I didn't know it"** — running single example files is fine for learning purposes, but the moment you move to a real project, it's essential. To move on to Spring Boot, you need to get comfortable with this first.

Through this post, [the sense of interfaces I got in #1](/en/posts/java-study-log-01-first-syntax-and-oop-basics#interfaces--only-the-spec-is-defined-implementation-belongs-to-the-inheriting-side) got reused in collections (List/ArrayList, etc.), and today I felt that **the contractual nature of exceptions** — Java's enforcement of pinning down in the signature which exceptions a method can throw — is the same kind of thinking.

## Further Study

### 1. Exception Handling in Depth

- **Checked vs Unchecked** — when to use which
- **`try-with-resources`** — automatic release of `AutoCloseable` resources (files · DB connections)
- **Exception chaining** — preserving the cause with `throw new BusinessException("description", originalException)`
- **`finally` vs try-with-resources** — when to use which

### 2. Concurrency in Depth — The Pitfalls of Shared State

- **`synchronized` / `volatile`** — when to use which
- **Java Memory Model** — why other threads can't see changes without volatile
- **Race conditions · deadlocks** — how to detect and prevent them
- **`java.util.concurrent`** — `ConcurrentHashMap`, `AtomicInteger`, `CountDownLatch`, etc.

### 3. record in Practice

- **Can record be used as a JPA Entity** — why it's difficult
- **Using record as DTOs** — API response/request schemas
- **Combining with sealed classes** — algebraic data type style (the same feel as Kotlin/Scala)

### 4. Gradle in Depth

- **`build.gradle` vs `build.gradle.kts`** — using the Kotlin DSL is the modern standard these days
- **Gradle vs Maven** — why the Spring ecosystem moved to Gradle
- **Multi-module projects** — large services split a single project into multiple modules

### 5. Moving on to Spring Boot

- **DI · IoC** — core concepts of Spring
- **`@RestController` / `@Service` / `@Repository`** — layer-specific annotations
- **`application.yml`** — configuration management
- **Building a REST API to get a real feel for backend work**