---
title: "Spring Boot W3D2 — CRUD with REST API · Layered Architecture · Global Exception Handler"
description: "W3D1 (first run · DI) 이어 W3D2 는 REST API 로 CRUD. REST 는 URL + HTTP 메서드의 조합이라는 정의부터 정리 (GET/POST/PUT/DELETE), 컨트롤러에 @GetMapping · @PostMapping · @PutMapping · @DeleteMapping 붙여서 todos CRUD 완성. curl 옵션 (-X 메서드 · -H 형식 · -d 데이터) 정리 및 5스텝 curl 흐름 검증 (생성 → 전체 조회 → 수정 → 삭제 → 최종 조회). 컨트롤러가 로직까지 다 들고 있으니 서비스로 분리 → 레이어드 아키텍처 (Controller = 요청/응답 / Service = 로직 / Repository = 저장). 예외 처리는 커스텀 예외 → 404 응답, 그리고 전역 예외 처리기 (Global Exception Handler) 를 두면 컨트롤러는 그냥 throw 만 하고 응답 매핑은 처리기가 담당 — W2 편에서 배운 \"throw 는 강제 전파\" 계약성이 실전으로 확장됨. 시행착오 2건 (참조 클래스 없이 서버 켜기 요청 · 라이브러리 추가 전 패키지 작성) 은 학습 지침에 반영해서 다음부터 재발 방지."
pubDatetime: 2026-07-10T02:30:00Z
tags:
  - 백엔드공부
  - spring-boot
  - rest-api
  - crud
  - 예외처리
  - 학습
draft: false
featured: false
---

Following [Spring Boot W3D1 (first run · DI)](/en/posts/spring-boot-w3d1-first-run-controller-and-di), **W3D2 is about CRUD with REST API**. Today's goal was to build create/read/update/delete for a simple resource called todos, and to separate the logic that had been piling up in the controller into a service.

## Table of contents

## What exactly is a REST API — sorting it out again

I already knew CRUD meant "create/read/update/delete," and I only vaguely knew that a REST API had "something to do with URLs." The precise definition is this:

> **REST API = a combination of URL (address) + HTTP method.**

Role of each HTTP method:

| Method | Role | Spring annotation |
|---|---|---|
| **GET** | Read (retrieve) | `@GetMapping` |
| **POST** | Create (add) | `@PostMapping` |
| **PUT** | Update (change) | `@PutMapping` |
| **DELETE** | Delete | `@DeleteMapping` |

Even the same URL `/todos` behaves differently depending on the method. "What, where, and how" gets expressed as the product of the URL and the method.

## Starting CRUD in the controller

First I built a store (an in-memory List), then had the controller handle **listing all · getting one · creating**:

```java
@RestController
@RequestMapping("/todos")
public class TodoController {

    private final List<Todo> store = new ArrayList<>();
    private final AtomicLong seq = new AtomicLong();

    @GetMapping
    public List<Todo> all() { return store; }

    @GetMapping("/{id}")
    public Todo one(@PathVariable Long id) { /* ... */ }

    @PostMapping
    public Todo create(@RequestBody TodoCreateRequest req) {
        Todo t = new Todo(seq.incrementAndGet(), req.title(), false);
        store.add(t);
        return t;
    }
}
```

- **`@RequestBody`** — automatically converts the JSON coming in via POST into a Java object. Jackson handles this behind the scenes.

## curl options, sorted out

For the examples I mostly sent requests with `curl`:

- **`-X`** — specifies the HTTP method (`-X POST`, `-X PUT`, `-X DELETE`)
- **`-H`** — specifies a header (`-H "Content-Type: application/json"`)
- **`-d`** — the body data (`-d '{"title": "study"}'`)

Naturally, **the data after `-d` must match the format declared in the `-H` Content-Type.** If you declare JSON in the header but send XML, the server throws a 400.

## Finishing CRUD with PUT · DELETE

I added update/delete to the controller as well:

```java
@PutMapping("/{id}")
public Todo update(@PathVariable Long id, @RequestBody TodoUpdateRequest req) { /* ... */ }

@DeleteMapping("/{id}")
public void delete(@PathVariable Long id) { /* ... */ }
```

### Verifying the flow with 5 curl steps

![Running the CRUD flow with curl — creating 2 items ("study"·"exercise") via POST, checking with GET for all, updating /todos/1 to done=true via PUT, deleting /todos/2 via DELETE, and confirming with a final GET that only id:1 remains with done:true](/assets/posts/spring-boot-w3d2-rest-api-crud-and-layered-architecture/01-curl-crud-flow.png)

**5-step CRUD** — create 2 items → list all → update item 1 (done=true) → delete item 2 → final read. Each step's response lined up as expected, confirming the CRUD flow works end to end.

### Debugging a 400 error

At one point I hit a 400 — **I could immediately check the cause from the stack trace in the server-side console**. For backend debugging, this console is the map. If you only look at the frontend, there's no way to know why you got a 400.

## The controller is doing all the logic too — separating out the service

Up to this point, **the store, the logic, and the response were all tangled together inside the controller.** The controller's original responsibility is just "receive a request and send a response," but right now it also holds business logic (issuing ids, todo update rules). This needs to be separated.

## Layered Architecture — Controller / Service / Repository

I moved the logic into a service and pulled the store out into a repository. This is called **Layered Architecture**:

| Layer | Responsibility |
|---|---|
| **Controller** | Request · response (HTTP touchpoint) |
| **Service** | Business logic |
| **Repository** | Storage/retrieval (data touchpoint) |

Splitting into these 3 gives you:

- **Single responsibility per layer** — it's clear which part needs fixing
- **Easier testing** — if you only want to unit-test the Service, you can inject a mock Repository using the [DI I learned in W3D1](/en/posts/spring-boot-w3d1-first-run-controller-and-di#dependency-injection-di--separating-service-and-controller)
- **Narrower ripple effect from changes** — when swapping the DB from in-memory to a real database, only the Repository needs touching

## Why put the update request in its own file

There's a **convention of keeping request-body containers, like `record TodoCreateRequest(String title) {}`, in their own separate files**. It's not mandatory, so why do it this way?

- **The filename reveals the role** — seeing `TodoUpdateRequest.java` immediately tells you "this is the update request schema"
- **Keeps controller/service files thin** — if record definitions are squeezed in, the actual logic gets pushed aside
- **Easier reuse/version management** — when the schema diverges for API v2, you can just duplicate/branch the whole file

## Exception handling — custom exceptions + global exception handler

Previously, querying a nonexistent id returned an **empty response**. From the user's perspective there's no way to know "why isn't this working." I created a custom exception so it responds with **404 Not Found** instead:

```java
public class TodoNotFoundException extends RuntimeException { ... }
```

Should every controller method catch this and map it to a response code each time? That's tedious. With a **Global Exception Handler**, you handle it in one place:

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(TodoNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse handle(TodoNotFoundException e) {
        return new ErrorResponse(e.getMessage());
    }
}
```

Now:

- **The controller just throws**
- **How that maps to a response is the handler's job**

The [contract from Java W2 that "throw forcibly propagates up the call stack"](/en/posts/java-study-w2-exceptions-concurrency-and-gradle#2-custom-exceptions--why-use-exceptions-instead-of-print) becomes, in Spring, an automated flow from controller → global handler. What I learned as Java syntax gets layered onto real framework practice.

## Trial and error — folded back into my learning guidelines

I stumbled twice today:

1. **Trying to start the server while a referenced class doesn't exist yet** — the learning-exercise instructions kept telling me to run the server first, so compilation failed
2. **Writing code that uses a library before adding the library** — same story, compilation failed

Both cases were **failing to follow the "code → dependency → run" order**. I added "before writing code, first confirm all necessary classes/dependencies exist" to my learning-exercise instructions (the prompt I give the AI), to prevent this from happening again.

The same trap shows up in real work too — trying to run code while references are broken mid-refactor wastes time on exactly this kind of compile failure.

## Retrospective

Three things that clicked for me in W3D2:

1. **A REST API is the product of URL × HTTP method** — once the definition was clear, writing the actual CRUD went quickly. I'd been putting it off simply because I didn't know the definition.
2. **Layered architecture is a natural extension of the [interface/DI sense from W3D1](/en/posts/spring-boot-w3d1-first-run-controller-and-di#the-automation-of-interface-sense)** — the Controller only needs to know the Service interface, and the Service only needs to know the Repository interface. Each layer not knowing the implementation of the next layer is the root of both testability and ease of modification.
3. **The global exception handler is the practical application of W2's "throw forcibly propagates"** — the controller just throws, and something above handles it. What I learned in Java W2 clicked into place here, showing why it was needed.

## What to study further

### 1. The convention of separating DTO files

- How to split Request DTO · Response DTO · Domain model into three layers
- How to manage schema evolution (v1 → v2)
- Reference: [Baeldung — DTO pattern](https://www.baeldung.com/java-dto-pattern)

### 2. HTTP status code standards

- 2xx (200 OK · 201 Created · 204 No Content) — when to use each
- 4xx (400 Bad Request · 401 · 403 · 404 · 409 Conflict) — when to use each
- 5xx (500 Internal · 502 · 503) — distinguishing server-side causes
- Following the standard well makes it easier for the frontend to automate error UX

### 3. `@Valid` + Bean Validation

- Validating request body fields (`@NotNull`, `@Size(min=1)`, `@Email`, etc.)
- Automatic 400 response on validation failure
- How to route Bean Validation failures into the global exception handler

### 4. Different implementations of the Repository layer

- Today it was in-memory (a List) — gone if the process restarts
- **JPA / Hibernate** — the standard Java ORM
- **Spring Data JPA** — just define the interface and CRUD methods are generated automatically

### 5. DB · SQL basics — the next axis of study

- Relational DB concepts · normalization
- Starting with PostgreSQL
- Building a feel for SQL itself before moving on to JPA