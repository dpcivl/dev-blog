---
title: "Java Study #2 — Collections (List / Map / Set) · Stream Pipelines · Null-Safe Handling with Optional"
description: "Week 2 of studying Java. I go through the core of the Collection Framework — List (ArrayList), Map (HashMap), Set — and notice the 'interface and implementation' pattern in each of them (List<String> books = new ArrayList<>()). Then I move on to Stream, building filter → map → collect pipelines without for loops, method references (System.out::println), and combining groupingBy + counting. Finally, Optional — I learn to always handle the absence-of-value case with ifPresent / orElse / map instead of calling get() right away."
pubDatetime: 2026-07-06T05:00:00Z
tags:
  - 백엔드공부
  - java
  - collection
  - stream
  - oop
  - 학습
draft: false
featured: false
---

Following up on [Java Study #1](/en/posts/java-study-log-01-first-syntax-and-oop-basics). Today's topics are **Collections, Stream, and Optional** — three things you touch every day in Java backend work.

## Table of contents

## List — a pattern of separated interface and implementation

Code: [`ListDemo.java`](https://github.com/dpcivl/be-study/blob/main/week2-collections/ListDemo.java)

**List** = a list with no fixed size. You grow it with `.add()` and shrink it with `.remove()`.

You can specify what goes inside the list using `<String>`, `<Integer>`, and so on — this is the same flavor as **C++ generic programming**, which I learned before.

```java
List<String> books = new ArrayList<>();
```

Breaking this expression down:

- **`List` is the interface** — it only specifies what needs to be done
- **`ArrayList` is the implementation** — the actual code for how it's done

This is exactly the [interface concept I learned in #1](/en/posts/java-study-log-01-first-syntax-and-oop-basics#interfaces--only-the-spec-is-defined-implementation-belongs-to-the-inheriting-side) applied here. The reason you don't need to write `String` again in `ArrayList<>` on the right side is that it's already determined on the left — type inference happens automatically.

## Map — the dictionary feel

Code: [`MapDemo.java`](https://github.com/dpcivl/be-study/blob/main/week2-collections/MapDemo.java)

```java
Map<String, Integer> scores = new HashMap<>();
```

Map follows the same **interface (Map) / implementation (HashMap)** separation pattern. It's used just like a Python dictionary:

- `put(key, value)` to insert
- `get(key)` to retrieve

### Iteration — using `entrySet()` for key-value pairs together

```java
for (Map.Entry<String, Integer> entry : scores.entrySet()) {
    System.out.println(entry.getKey() + ": " + entry.getValue());
}
```

Using **`.entrySet()`**, you create a set of entries and iterate over each one with `getKey()` / `getValue()`. It's a similar picture to Python's `for k, v in d.items():`, but Java is a bit more explicit.

## Set — the only difference is no duplicates

Code: [`SetDemo.java`](https://github.com/dpcivl/be-study/blob/main/week2-collections/SetDemo.java)

Using Set instead of List means **duplicates are not allowed**. Everything else about usage is nearly identical to List. Which one to use depends on the nature of your data — use List when you need order and duplicates, use Set when you need a "set of unique values."

## Stream — pipelines without for loops

Code: [`StreamDemo.java`](https://github.com/dpcivl/be-study/blob/main/week2-collections/StreamDemo.java)

This is where things get interesting in Java 8+. With **Stream**, you can turn what used to be complex for-loop logic into a **pipeline style**:

```java
List.of(1, 2, 3, 4, 5)
    .stream()
    .filter(n -> n % 2 == 0)      // even numbers only
    .map(n -> n * n)              // square them
    .forEach(System.out::println); // 4, 16
```

**filter → map → forEach** — each step is expressed in a single line, so **you can see what's happening at a glance**. It has a similar feel to combining a Python list comprehension with functools.reduce, but the pipeline here is explicit, making it more declarative.

### Method reference — `System.out::println`

```java
.forEach(System.out::println);
```

`System.out::println` — a **method reference**. It's used when passing what comes out of the end of a Stream into println. It's shorthand for `n -> System.out.println(n)`.

### `List.of` is read-only

```java
List<Integer> nums = List.of(1, 2, 3);
nums.add(4);  // ❌ UnsupportedOperationException
```

**The `List.of` you often see in examples is an immutable list** — it can't be modified later. If you need a mutable list, you have to wrap it like `new ArrayList<>(List.of(1, 2, 3))`. This is a spot where mistakes tend to happen.

## `groupingBy` + `counting` — grouping and counting

Code: [`GroupDemo.java`](https://github.com/dpcivl/be-study/blob/main/week2-collections/GroupDemo.java)

**`groupingBy`** — decides what criterion to group by. It converts an existing List into a collection (Map) based on that criterion.

```java
Map<String, Long> countByCategory = books.stream()
    .collect(Collectors.groupingBy(Book::getCategory, Collectors.counting()));
// {소설=3, 기술=5, 에세이=2}
```

Combining `groupingBy` with `counting` gets you **counts per category** in one shot. It's exactly the same picture as SQL's `GROUP BY category, COUNT(*)`.

## Optional — handling null safely

Code: [`OptionalDemo.java`](https://github.com/dpcivl/be-study/blob/main/week2-collections/OptionalDemo.java)

**Optional** = a container that explicitly states "a value may or may not be present." It's a null-safety tool introduced in Java 8+.

Something interesting — **it looks as if there's a value called `isPresent` inside the instance**. It's actually a method, but it feels that way intuitively.

```java
Optional<User> user = findUser("alice");
if (user.isPresent()) {
    System.out.println(user.get().getName());
}
```

### A bad habit — calling `get()` right away

```java
user.get().getName();  // ❌ NoSuchElementException if there's no value
```

**Just because a value might be present doesn't mean you should always call `get()`.** You need to **always handle the case where there's no value** using `ifPresent` / `orElse` / `map`:

```java
// run if present, ignore if not
user.ifPresent(u -> System.out.println(u.getName()));

// default value if not present
String name = user.map(User::getName).orElse("Anonymous");

// transform into a new Optional if present
Optional<String> upperName = user.map(u -> u.getName().toUpperCase());
```

**The sense of expressing "A if present, B if not" in one line** — it's similar in flavor to Python's `x if x else default`, but Java enforces this through a distinct type called Optional.

## Retrospective

Three things I got out of this post:

1. **The interface/implementation separation pattern repeats throughout collections** — `List / ArrayList`, `Map / HashMap`, `Set / HashSet`. The concept I learned in #1 keeps getting reused in practice.
2. **Stream feels like SQL** — combining filter/map/collect lets you express data transformations declaratively without for loops. `groupingBy` is exactly like SQL's `GROUP BY`.
3. **Optional is a way of making "absence" explicit** — it enforces at the type level that a value may not exist. It's much stricter than Python's None handling, leaving less room for mistakes.

## What to study next

### 1. Exception handling — Java's checked exceptions

- Basics of `try / catch / finally`
- **Checked vs Unchecked exceptions** — a concept unique to Java
- `throws` declarations — specifying exceptions at the method signature level
- This doesn't exist in Python / JS, so it'll probably feel unfamiliar at first

### 2. Concurrency basics

- `Thread` / `Runnable` / `ExecutorService`
- the `synchronized` keyword · volatile
- Java Memory Model basics
- Something you're bound to encounter in real Java backend work

### 3. Digging deeper into functional interfaces

- `Function<T, R>` / `Predicate<T>` / `Consumer<T>` / `Supplier<T>`
- How the Stream API uses these internally
- Creating custom functional interfaces (`@FunctionalInterface`)

### 4. Collection performance characteristics

- `ArrayList` vs `LinkedList` — when to use which?
- `HashMap` vs `TreeMap` vs `LinkedHashMap` — ordering, performance, sorting
- Developing a sense for choosing based on Big O

### 5. Build tools (Maven / Gradle)

- Right now I'm studying with single files, but real work happens at the project level
- **Maven vs Gradle** — which is the standard choice?
- Real-world project folder structure (`src/main/java`, `src/test/java`)

### 6. Moving on to Spring Boot

- Once the syntax feels familiar, move on to the framework
- **Dependency Injection (DI)** — the core of Spring
- `@Component` / `@Service` / `@Repository` / `@RestController`
- Building a REST API to get a real feel for backend development