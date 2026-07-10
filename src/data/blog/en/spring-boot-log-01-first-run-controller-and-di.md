---
title: "Spring Boot #1 — First Run (bootRun · Embedded Tomcat) · @RestController · Getting a Feel for Dependency Injection"
description: "Wrapping up Java #3 (Exceptions · Concurrency · Gradle), I'm starting Spring Boot today. I pulled a hello-spring project from Spring Initializr and ran it with ./gradlew bootRun — the terminal looks stuck at \"80% EXECUTING\" but the server is actually already up on port 8080 (the Gradle daemon is holding onto the process, which is why the progress bar shows that way). Spring Boot has Tomcat embedded, so port 8080 comes up without installing a separate WAS. With no endpoint defined, hitting 8080 gives an error page — you need @RestController + @GetMapping to specify a path before a response is attached. Then, getting a feel for dependency injection (DI) — the reason a service gets injected into a controller without the controller ever calling new on it is that Spring creates one instance of the @Service class at startup, keeps it as a bean, and automatically plugs it into the controller's constructor. The interface sense I've been building since Java #1 — the contractual nature of using something handed to you without knowing its implementation — shows up here in an automated form within Spring. This is exactly why coupling goes down and testing gets easier."
pubDatetime: 2026-07-09T07:00:00Z
tags:
  - 백엔드공부
  - spring-boot
  - java
  - backend
  - di
  - 학습
draft: false
featured: false
---

Having wrapped up [Java #3 (Exceptions · Concurrency · Gradle)](/en/posts/java-study-log-03-exceptions-concurrency-and-gradle), I'm starting **Spring Boot** today. First session: project scaffolding, first run, controllers, getting a feel for dependency injection.

## Table of contents

## Spring Initializr — Project Scaffolding

Spring projects are created with a tool called [Spring Initializr](https://start.spring.io/). You pick the options you need on the web (Gradle · Java · Spring Boot version · dependencies) and download a zip. I pulled a `hello-spring` project this way.

## `./gradlew bootRun` — Running the Server

```bash
./gradlew bootRun
```

`gradlew` is the **Gradle Wrapper**. This is the same wrapper I [briefly mentioned in the Java #3 post](/en/posts/java-study-log-03-exceptions-concurrency-and-gradle#6-gradle--why-is-it-needed), and here it's actually put to use — the project itself solves the problem of team members having mismatched Gradle versions.

`bootRun` is the standard Gradle task for running a Spring Boot application.

## The Trap — the Terminal Looks Stuck at "80% EXECUTING"

![Spring Boot startup log — Tomcat initialized with port 8080, Starting service [Tomcat], Started HelloSpringApplication in 1.246 seconds, with a "80% EXECUTING [14m 55s]" progress bar staying at the bottom](/assets/posts/spring-boot-log-01-first-run-controller-and-di/01-spring-boot-startup-80-executing.png)

After running the command, the progress bar sits at **`80% EXECUTING [14m 55s]`** and doesn't move. At first I thought something was hanging, so I kept waiting.

In reality, **the server is already up on port 8080**. Looking at the log, `Started HelloSpringApplication in 1.246 seconds` already shows completion. The Gradle daemon has to keep holding onto the server process, so the task itself never finishes, and the progress stays stuck at that state.

## Why Port 8080 Just Comes Up — Embedded Tomcat

I ran a single simple command, and **the WAS came up on port 8080 by itself.** This is possible because Spring Boot has **Tomcat embedded**. The application essentially carries its own WAS around, so you don't need to install or configure Tomcat separately.

This replaces the older Spring flow (Spring MVC, etc.), where you had to install Tomcat separately and deploy a `.war` on top of it.

## No Endpoint Means an Error Page

The server is up, but no path has been created yet → visiting `http://localhost:8080` in a browser gives an error page.

To attach a response, you need to create a **controller** and specify a path:

```java
@RestController
public class HelloController {

    @GetMapping("/hello")
    public String hello() {
        return "Hello, Spring Boot";
    }
}
```

- **`@RestController`** — tells Spring this class is a controller that returns REST responses
- **`@GetMapping("/hello")`** — this method handles HTTP GET requests to `/hello`

Now visiting `http://localhost:8080/hello` shows "Hello, Spring Boot".

## Dependency Injection (DI) — Separating Service and Controller

In the example above, the controller directly returned a string. In real applications, **the controller only receives the request, and the logic is handled by a service**. This is the basic form of layer separation.

Let me split this into a service and a controller:

```java
@Service
public class GreetingService {
    public String greet(String name) {
        return "Hello, " + name;
    }
}

@RestController
public class HelloController {

    private final GreetingService service;

    public HelloController(GreetingService service) {  // require the service through the constructor
        this.service = service;
    }

    @GetMapping("/hello")
    public String hello() {
        return service.greet("Spring");
    }
}
```

Here's the **strange part** — I never created `HelloController`, so how does the service end up inside it? I never called `new GreetingService()` anywhere.

The answer: **Spring put it there.** This is called **Dependency Injection**.

## Bean — Instances Managed by Spring

The flow works like this:

1. **At startup**: Spring finds classes annotated with `@Service` and **creates a single instance to hold onto**. This instance is called a **Bean**.
2. **When a controller request comes in**: if the controller's constructor requires `GreetingService`, **Spring automatically plugs the bean in**.

In other words, the developer only declares "this class is needed", and Spring manages **who creates it, when it's created, and how it's reused**.

## The Automation of Interface Sense

This picture reminded me of a familiar feeling — [the interfaces I learned in Java #1](/en/posts/java-study-log-01-first-syntax-and-oop-basics#interfaces--only-the-spec-is-defined-implementation-belongs-to-the-inheriting-side). An interface is **a contract for using something handed to you without knowing its implementation**.

DI is **Spring automatically handling this contract through beans**.

```java
// When you receive it as an interface
private final GreetingService service;  // the controller doesn't know what the actual implementation is

// When Spring plugs in the bean, any implementation can be swapped in
```

This structure gives two concrete benefits:

1. **Coupling goes down** — the controller only needs to know the service interface. Even if the implementation changes, the controller stays the same.
2. **Testing gets easier** — during testing, you can plug in a **mock service** as the bean instead of the real one. You can test the controller without a DB.

## Reflection

Three things I picked up in the first session:

1. **What I sensed coming in the Java posts is now actually being assembled** — thread pools (which Tomcat runs internally), exception handling (real exception flow in controllers), and other pieces that only existed in isolation are starting to come together in Spring.
2. **`gradlew bootRun` = "so this is where what I learned about Gradle gets used"** — I got the wrapper concept under my fingers in the Java #3 post, and this became the first real point of application. The learning is building up in the right order.
3. **DI is the automation of interface sense** — the contractual nature of Java, "you don't need to know the implementation as long as the spec is followed," which I've been building since Java #1, shows up here as something the framework handles automatically. It feels like going through Java syntax wasn't wasted effort.

## Things to Study Further

### 1. MVC Pattern vs. Service Layer (I got confused here)

- **MVC** stands for Model-View-Controller — a pattern for the presentation layer (handling requests)
- The **service layer** is the business logic layer — a separate axis that sits behind the C in MVC
- I need to pin down exactly how these two relate and how they combine in Spring
- Reference: [Spring official docs — Web MVC](https://docs.spring.io/spring-framework/reference/web/webmvc.html)

### 2. `@Component` vs `@Service` vs `@Repository` vs `@Controller`

- All of these register a class as a bean managed by Spring
- **Why they're split by role** (marking layers · specializing AOP targets · exception translation, etc.)
- Everything technically works with plain `@Component`, so why are they split up

### 3. REST API Design — CRUD

- `@GetMapping` · `@PostMapping` · `@PutMapping` · `@DeleteMapping`
- How each of request body · path variables · query parameters is received
- Standard response status codes (200 · 201 · 400 · 404 · 500)
- Getting a feel for this by actually building a CRUD example

### 4. Three Ways to Do Dependency Injection

- **Constructor injection** (today's example) — why this is recommended
- **Setter injection** — when to use it
- **Field injection** (`@Autowired`) — why it's treated as an anti-pattern

### 5. Spring Boot's Auto-Configuration

- Why adding just a few lines to `application.properties` gets Tomcat/DB configuration set up automatically
- The `@EnableAutoConfiguration` · `spring.factories` flow
- How to approach overriding auto-configuration when needed