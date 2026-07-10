---
title: "Java Study #1 — First Java Run · Syntax Overview · OOP Basics (Classes · Encapsulation · Inheritance · Interfaces)"
description: "Starting Java study to fill in my lacking backend and production experience. In one day, I went from installing Java to covering the switch statement's -> arrow syntax, for-each, the need for double casting in integer division, the public class file rule, encapsulation with private + getter, the difference with and without static, the @Override annotation, and connecting interfaces with implements. Having Python / C++ experience, many concepts were already familiar."
pubDatetime: 2026-07-03T08:30:00Z
tags:
  - 백엔드공부
  - java
  - backend
  - oop
  - 학습
draft: false
featured: false
---

Starting today, I'm also studying **the backend concepts and production experience I'm lacking**, in parallel. This is the start of the "understanding WAS" track I briefly mentioned in [the retrospective for Eval Study #2](/en/posts/eval-study-log-02-similarity-and-testset-design#what-to-study-further).

Since **Java wasn't installed** on my machine, I started by installing it, then spent the first session typing along with easy examples to experience the syntax.

## Table of contents

## Syntax Overview — Familiar Things and New Things

### switch — the Arrow Style

The switch I knew before had a `case ... : break;` structure. From Java 14+, you can use **arrow syntax**:

```java
String result = switch (day) {
    case "MON", "TUE" -> "weekday start";
    case "SAT", "SUN" -> "weekend";
    default -> "midweek";
};
```

**No fall-through even without break**. Much cleaner.

### for-each

Syntax you can use with the same feel as Python's `for x in list:`:

```java
int[] nums = {1, 2, 3};
for (int num : nums) {
    System.out.println(num);
}
```

`for (int num : nums)` — element type on the left of the colon, iterable on the right. Same vein as Python or C++'s range-based for.

### Integer Division — double Casting

Something that just worked in Python needs to be explicit in Java:

```java
int a = 10, b = 3;
double result = (double) a / b;  // 3.333...
// double result = a / b;         // → 3.0 (integer division, then promoted to double)
```

**Integer / integer** always results in integer division. To keep the decimal part, you must **cast to double first**. Also, the variable receiving the return value must be of type double, or it won't compile. This is a spot that trips up people coming from Python.

## Classes and Objects — Python / C++ Experience Carries Over Directly

The concept of Python's `__init__` constructor and methods carries over directly. C++ is also called an object-oriented language, but **Java is object-orientation itself** — the syntax feels more enforced. I have a feeling this will be fun.

### The `public class` File Rule

- **Only one `public class`** is allowed per file, and it must match the file name
- **Classes without `public` can have multiple in the same file**
- However, **in practice, classes are usually split into separate files** — for ease of management

## Encapsulation — `private` + getter

Use **`private`** to protect values inside a class. It can't be modified directly from outside — it can only be changed **through methods**. This is called **encapsulation**.

```java
public class User {
    private String name;    // Cannot be accessed directly from outside

    public String getName() {  // getter
        return name;
    }

    public void setName(String name) {  // setter
        this.name = name;
    }
}
```

A **getter** = a method that only allows **reading** a variable inside a class.

## `static` — the Difference With and Without It

- **With `static`** — can be called without creating an object (`ClassName.method()`)
- **Without `static`** — must be called through an object (`obj.method()`)

This has a similar feel to Python's `@classmethod` / `@staticmethod`.

## Inheritance and Polymorphism — `@Override`

It was new to me that when overriding a parent method during inheritance, you attach the **`@Override` annotation**:

```java
class Animal {
    void speak() { System.out.println("..."); }
}

class Dog extends Animal {
    @Override
    void speak() { System.out.println("멍멍"); }
}
```

`@Override` tells the compiler "this is an override" — if you make a mistake with a method name that doesn't exist in the parent, you get a compile error. This blocks at the source the kind of mistake in Python where a new method silently gets created.

## Interfaces — Only the Spec Is Defined, Implementation Belongs to the Inheriting Side

An interface only defines **what needs to be done** as a spec, and **how to do it** is defined by the class that inherits the interface:

```java
interface Flyable {
    void fly();  // signature only, no body
}

class Bird implements Flyable {
    @Override
    public void fly() {
        System.out.println("날개짓");
    }
}
```

You connect using **`implements`, not `extends`**. The purpose is similar to Python's abstract class + `@abstractmethod`, but Java separates it into a distinct concept called an interface.

## Retrospective

Today was just an overview of basic syntax, so this is short. Three things I got out of it:

1. **Java is more explicit than Python** — division casting, encapsulation, override annotations all need to be explicit. In exchange, the compiler catches that many more mistakes.
2. **Most OOP concepts carry over from what I learned in Python / C++** — it feels less like learning a new language and more like **being forced to practice OOP through one specific language**.
3. **I need a feel for Java to move into backend work** — production SI and large-company backends are still Java-centric. Fortunately, the early part of the learning curve is fairly shallow.

## What to Study Further

### 1. Collections (Collection Framework)

- `List` / `Set` / `Map` families — the counterparts to Python's list / set / dict
- `ArrayList` vs `LinkedList` — when to use which?
- `HashMap` vs `TreeMap` — order vs performance

### 2. Generics

- Parameterized types for type safety — `List<String>`, `Map<K,V>`
- Wildcards `<? extends T>` / `<? super T>` — covariance and contravariance
- Comparing the concept with Python's type hints or TypeScript's generics

### 3. Exception Handling (`try / catch / finally`)

- **Checked exception vs unchecked exception** — a concept unique to Java
- `throws` declaration — specifying exceptions at the method signature level
- This concept doesn't exist in Python or JS, so it will probably feel awkward at first

### 4. Threads and Concurrency

- `Thread` / `Runnable` / `ExecutorService`
- The `synchronized` keyword, volatile
- Java Memory Model basics — an essential point for Java backend work

### 5. Build Tools & Project Structure

- **Maven vs Gradle** — which is the standard?
- Getting a feel for `pom.xml` / `build.gradle`
- Real-world Java project folder structure (`src/main/java`, `src/test/java`)

### 6. Moving on to Spring Boot

- Once Java syntax feels familiar, move on to the framework
- Dependency injection (DI), IoC, `@Component` / `@Service` / `@Repository`
- Building REST APIs (`@RestController`)
- Actual production backend services ultimately start from here