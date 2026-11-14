---
title: "Reflecting on My First Backend Assignment — I Should Have Just Built It Dirty and Refactored Later"
description: "I got an assignment to re-expose, as a REST API, a lookup that an existing screen already handled. Building Controller, Service, Mapper, and XML in order, I understood dependency injection and MyBatis for the first time — and still couldn't finish the extension even after spending a whole day on it."
pubDatetime: 2026-09-20T13:20:00Z
tags:
  - 백엔드공부
  - spring
  - mybatis
  - 회고
  - 학습
draft: false
featured: false
---

I got a backend assignment and spent a full day on it. The task was to re-expose, as a REST API, a lookup that an existing Nexacro screen already handled. Since I'd only done embedded work before, this was my first time touching this kind of structure, so I had to take it apart piece by piece.

## Table of contents

## The layers are separated

First I looked at why the files are split into so many pieces.

- **Controller**: This is like an interrupt handler. It takes requests from the outside (HTTP), just organizes the parameters, and immediately delegates. You shouldn't write logic here.
- **Service**: The actual business logic
- **Mapper**: The channel for accessing the DB
- **DTO / VO**: Defines the structs passed between layers. Lombok's `@Data` auto-generates getters/setters at compile time

Once I understood Controller as an interrupt handler, it clicked immediately. It's the same idea as not holding things up too long inside a handler.

## `@RequiredArgsConstructor` and `private final` turned out to be dependency injection

The interface and the `Impl` are separate, and when something requires the `GradeService` type, a `GradeServiceImpl` instance gets plugged in. That injection happens via `@RequiredArgsConstructor` + `private final`.

At first I didn't understand why this counted as injection. Unpacked, it looks like this.

```java
// 실제 코드는 사실 이렇게 풀린다 (Lombok 이 자동 생성)
public class GradeController {
    private final GradeService gradeService;
    private final LoginService loginService;

    // @RequiredArgsConstructor 가 자동으로 만들어주는 생성자
    public GradeController(GradeService gradeService, LoginService loginService) {
        this.gradeService = gradeService;
        this.loginService = loginService;
    }
}
```

`final` is similar to a `const` pointer in C. `@RequiredArgsConstructor` is a macro that asks for a constructor to be generated that takes the fields declared `final` as parameters. Conceptually it's just a constructor.

The comparison to a `const` pointer turned out to be pretty accurate. A `final` field in Java also just means **the reference can't be reassigned** — it doesn't lock the contents of the object the reference points to. In C terms, it's closer to `T* const`.

And Spring calls this constructor for you when the app starts. That's DI.

<img src="/assets/mermaid/19004444e65637b6.svg" alt="Spring 이 앱 시작 시 구현체를 만들어 컨테이너에 Bean 으로 보관하고, Controller 를 만들 때 생성자가 요구하는 타입을 꺼내 넣어주는 흐름" width="276" height="710" style="max-width:min(100%, 276px);height:auto;" />

When Spring starts the app, it builds the implementations one by one and stores them in a container. The objects held in this box are called **Beans**. When it's time to build `GradeController`, Spring notices "this constructor needs a `GradeService` type," pulls the already-built instance out of the box, and plugs it in automatically.

I had seen dependency injection once before [when studying Spring Boot](/en/posts/spring-boot-log-01-first-run-controller-and-di), but back then I only had a vague sense of it — I didn't understand it broken down like this.

## What does "expose it as a REST API" actually mean

It took me a while to figure out what the assignment description meant by this phrase. Broken down, the order looks like this.

<img src="/assets/mermaid/1253e7d27d9cc9ea.svg" alt="사용자가 화면에서 버튼을 누른 뒤 Controller · Service · Mapper · MyBatis · 오라클을 거쳐 JSON 응답이 돌아오는 9단계 요청 흐름" width="276" height="1166" style="max-width:min(100%, 276px);height:auto;" />

In my case, the existing Nexacro screen already had the logic for displaying data. So all I needed to do was copy which table, which columns, and which conditions it used for the lookup. **It's about pulling the same answer out through a different channel.**

The structure I saw [when studying layered architecture](/en/posts/spring-boot-log-02-rest-api-crud-and-layered-architecture) looked exactly like this in actual code.

## Apparently backend developers don't spin things up to check the result

I asked a backend developer, and they said **it's rare to spin something up just to check the result**. They said you usually develop by picturing the logic in your head.

In embedded work, I always compiled and built to verify behavior before implementing the next feature. The habits are quite different.

According to an AI I asked, a backend developer's typical workflow looks like this.

1. Nail down the spec first — the URL, parameters, and the shape of the response JSON. You picture this in your head.
2. Look at an existing similar feature and build the skeleton layer by layer — DTO → Mapper → XML → Service → Controller.
3. Try the SQL in a DB tool first.
4. Verify with Service-level unit tests or by running locally and checking with curl.
5. Open a PR and get it reviewed.

## I read code for a similar feature

I had an AI analyze the code, but just a list of natural-language explanations didn't give me full understanding. So I decided to read the code for a "grade lookup" feature myself, since it was similar to the "syllabus lookup" I needed to implement.

After reading it, here's what I summarized it as in one line.

> The Controller calls the Service, and the Service's implementation lives in `ServiceImpl`. `ServiceImpl` calls the Mapper, and the Mapper's name is used as a key to find the SQL in the XML. The values returned from the SQL go into a DTO, `ServiceImpl` packs these DTOs into a Response object, and the Controller returns that Response. Spring converts the Response into JSON for the response.

## No time, so I started with the student path first

Syllabus lookup needed to support student, faculty, and staff paths. Since I wasn't used to backend work and writing everything at once would make debugging hard, I set the goal of **getting at least one path properly working first**.

I did as-is analysis on the existing working Nexacro code to check the output format, the existing lookup logic, and the input parameters. Then I decided to implement in the order DTO → Mapper → XML → Service → Controller.

### DTO

I looked at the existing DTO source code and followed the format. Nothing major was wrong. I learned that **the field names used in the DTO need to match exactly in the XML**.

### Mapper — I couldn't write the comment

I also followed the format of the existing Mapper source. I wrote it, but I didn't understand how this Mapper used SQL to fetch values from the DB.

Things clicked once I understood that **the method name and the XML's `id` need to match for them to be linked**. Implementing the SQL in the XML comes after the Mapper, so at this stage I only needed to decide the Mapper method names.

What actually stumped me was something else. The convention was to write a one-line comment above each method describing which SQL it was, but I didn't understand how I was supposed to satisfy that. I needed to find the actual existing table and reference it correctly, but **I couldn't find that table**, so I couldn't write the comment properly.

The reason for writing the table comment is so you can tell which table is being read and what from it, without having to open the XML.

### XML — the SQL was lacking

I created an XML file with the same name as the Mapper interface in the `sql.oracle` directory. This was genuinely my first time writing XML like this, so it was confusing.

I didn't know what to use for the `resultMap`'s `id`, but it turned out **I just get to decide that myself**. For the rest, I copied over the names exactly as decided in the Mapper, matching the format carefully.

But just matching the format correctly wasn't enough. To do the syllabus lookup properly, I needed to replicate the exact behavior of the original existing file, but **my SQL understanding wasn't enough to translate the existing logic over.** I realized I need a lot more SQL study.

I also learned that the column names used in `resultMap` need to line up carefully with the column names used in the `select`.

### Service — cannot find symbol

For Service, I needed to create both an interface and a `ServiceImpl` class. I built the constructor using `@RequiredArgsConstructor` and `private final`.

I got a lot of `cannot find symbol` errors. I kept missing something in the imports. Often it was because of typos it couldn't find, or because compilation failed when I forgot to import a class from a different package.

I figured the problem was that the vo didn't have a Response defined, so the `Impl` class couldn't use Response — so I created a Response file where the DTO used to sit.

## I couldn't do unit testing

I felt like I should write test code to verify each feature as I implemented it, but **there wasn't even a `src/test` folder** in the existing setup.

If I were to hand test-writing over to AI, I think I'd need to thoroughly confirm exactly what behavior is being verified before writing the tests — otherwise the tests wouldn't be reliable when the code changes later.

## Controller — just got it to compile with a stub

Compilation was failing because the `core` submodule was missing. But I got it to compile using a stub.

Getting it to compile with a stub meant **temporarily creating an empty shell class** with the same name as the `core` submodule, just to get the compiler to pass. So **I have no way to confirm whether the code actually works.**

I got a bit more used to it — whenever I needed to import something while writing code, I'd scroll up, write the import, then scroll back down to continue writing. After debugging repeatedly, I got used to finding and fixing which module I had left out.

But **I did introduce a bug the compiler couldn't catch.** I typed `apiBaseurl` instead of `apiBaseUrl`. I think just copy-pasting would help code stability more than typing it out by hand.

Since I went through this assignment without being able to find the requirements spec or the screen design document, I think I fell short in areas like deciding variable names and other conventions.

## Once I added faculty, I had to actually understand the conditions

I needed to make it so faculty and staff, not just students, could look up syllabi. I added the faculty path first into the file I'd already built for students. I modified Mapper, XML, Service (+Impl), and Controller.

When writing XML, you don't just write the `SELECT` — you also need to take care of the `resultMap`.

With just the student case, it felt like I could get it working just by following along. But once I tried to extend it to faculty, it felt like **I actually had to understand the conditions to be able to write it.** Once again, I felt like I needed more SQL study.

### `NVL`

`NVL` is an Oracle function. It's used inside SQL, not in Java, and it substitutes another value when a value is `NULL`.

```sql
NVL(값, 대체값)
```

## Reflection

I didn't finish the assignment, and the whole day was gone. I was originally supposed to extend it to faculty-staff and admin as well, but I think it was hard to implement because **I didn't know how to distinguish between faculty-staff, admin, and students.**

I'd like to implement a bit more and ask about it, but if I keep putting it off it'll never end, so tomorrow I think I'll just need to show what I've done so far.

Handling a single case wasn't complicated, but once I tried to handle multiple cases, I had to think about whether it was right to add more classes or methods, and how to branch things out and make the necessary calls. It felt both difficult and kind of fun.

**But looking back on it now, I think I should have just built it dirty first and refactored afterward.** I tried to get the structure right up front, and that's why I didn't make progress.

I worked without using any tools, just thinking things through in my head and writing code while only checking whether it compiled when I ran it. I think it would have been easier if I'd taken notes with pen and paper or sketched out the structure as I went.

## Things to study further

- **SQL — conditional clauses and JOINs** — I hit the same wall three times in one day. I couldn't port the existing logic over in the XML, and I got stuck again when extending to the faculty path. I need to fill this gap before the next assignment → [Oracle: SQL Queries and Subqueries](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/SQL-Queries-and-Subqueries.html)
- **How to distinguish between students, faculty, and staff** — not knowing this is why I couldn't finish the extension. I need to dig into the existing code to find where the logged-in user's role gets determined, and whether that branching happens in the Controller or the Service
- **Why didn't the compiler catch `apiBaseurl`** — if it had been a Java identifier, it would have thrown `cannot find symbol`, but it slipped through. I suspect it was a name used as a config key or a string, but I should confirm exactly where that name was used, since that changes how I'd prevent the same mistake next time
- **How do you add tests to a project with no test folder** — there was no `src/test` at all. I want to check whether I can attach Service-level unit tests first without touching the existing structure → [Spring Boot: Testing](https://docs.spring.io/spring-boot/reference/testing/index.html)
- **A way to actually run it instead of using a stub** — if I pull down the `core` submodule and get it running locally, I could move past the "it compiles but I don't know if it actually runs" state
- **Seeing the code Lombok actually generates** — if I see the constructor that `@RequiredArgsConstructor` produces with my own eyes, I think DI would feel more concrete. I heard there's something called delombok → [Lombok: Delombok](https://projectlombok.org/features/delombok)