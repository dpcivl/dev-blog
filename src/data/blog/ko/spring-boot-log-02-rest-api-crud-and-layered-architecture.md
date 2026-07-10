---
title: "Spring Boot #2 — REST API 로 CRUD · 레이어드 아키텍처 · 전역 예외 처리기"
description: "Spring Boot #1 (첫 실행 · DI) 에 이어 #2 는 REST API 로 CRUD. REST 는 URL + HTTP 메서드의 조합이라는 정의부터 정리 (GET/POST/PUT/DELETE), 컨트롤러에 @GetMapping · @PostMapping · @PutMapping · @DeleteMapping 붙여서 todos CRUD 완성. curl 옵션 (-X 메서드 · -H 형식 · -d 데이터) 정리 및 5스텝 curl 흐름 검증 (생성 → 전체 조회 → 수정 → 삭제 → 최종 조회). 컨트롤러가 로직까지 다 들고 있으니 서비스로 분리 → 레이어드 아키텍처 (Controller = 요청/응답 / Service = 로직 / Repository = 저장). 예외 처리는 커스텀 예외 → 404 응답, 그리고 전역 예외 처리기 (Global Exception Handler) 를 두면 컨트롤러는 그냥 throw 만 하고 응답 매핑은 처리기가 담당 — 자바 #3 편에서 배운 \"throw 는 강제 전파\" 계약성이 실전으로 확장됨. 시행착오 2건 (참조 클래스 없이 서버 켜기 요청 · 라이브러리 추가 전 패키지 작성) 은 학습 지침에 반영해서 다음부터 재발 방지."
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

[Spring Boot #1 (첫 실행 · DI)](/posts/spring-boot-log-01-first-run-controller-and-di) 에 이어 **#2 는 REST API 로 CRUD**. 오늘 목표는 todos 라는 간단한 리소스에 대해 생성 · 조회 · 수정 · 삭제를 다 만들고, 컨트롤러에 몰려있는 로직을 서비스로 분리하는 것.

## Table of contents

## REST API 라는 게 뭐지 — 다시 정리

CRUD 는 "생성/조회/수정/삭제" 라는 건 알고 있었고, REST API 는 "URL 이랑 관련있다" 정도로만 알고 있었다. 정확한 정의는 이거다:

> **REST API = URL (주소) + HTTP 메서드의 조합.**

HTTP 메서드 별 역할:

| 메서드 | 역할 | Spring 어노테이션 |
|---|---|---|
| **GET** | 조회 (읽기) | `@GetMapping` |
| **POST** | 생성 (추가) | `@PostMapping` |
| **PUT** | 수정 (변경) | `@PutMapping` |
| **DELETE** | 삭제 | `@DeleteMapping` |

같은 URL `/todos` 라도 메서드에 따라 다른 동작. "무엇을 어디에 어떻게" 를 URL 과 메서드의 곱으로 표현.

## 컨트롤러에서 CRUD 시작

일단 저장소 (인메모리 List) 를 만들고, 컨트롤러에서 **전체 조회 · 하나 조회 · 생성** 을 담당하게 함:

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

- **`@RequestBody`** — POST 로 온 JSON 을 자바 객체로 자동 변환. Jackson 이 뒤에서 처리.

## curl 옵션 정리

예제에서 요청은 주로 `curl` 로 넣었다:

- **`-X`** — HTTP 메서드 지정 (`-X POST`, `-X PUT`, `-X DELETE`)
- **`-H`** — 헤더 지정 (`-H "Content-Type: application/json"`)
- **`-d`** — 바디 데이터 (`-d '{"title": "공부"}'`)

당연히 **`-d` 뒤 데이터는 `-H` 의 Content-Type 형식을 따라야 함.** JSON 이라고 헤더에 선언해놓고 XML 을 보내면 서버가 400 을 뱉는다.

## PUT · DELETE 로 CRUD 완성

수정/삭제도 컨트롤러에 붙임:

```java
@PutMapping("/{id}")
public Todo update(@PathVariable Long id, @RequestBody TodoUpdateRequest req) { /* ... */ }

@DeleteMapping("/{id}")
public void delete(@PathVariable Long id) { /* ... */ }
```

### curl 5스텝으로 흐름 검증

![curl 로 CRUD 흐름 실행 — POST 로 "공부"·"운동" 2개 생성, GET 전체 조회로 확인, PUT /todos/1 로 done=true 로 수정, DELETE /todos/2 로 삭제, 최종 GET 으로 id:1 만 done:true 로 남은 것 확인](/assets/posts/spring-boot-log-02-rest-api-crud-and-layered-architecture/01-curl-crud-flow.png)

**5스텝 CRUD** — 생성 2건 → 전체 조회 → 1번 수정 (done=true) → 2번 삭제 → 최종 조회. 각 스텝의 응답이 예상대로 맞물려서 CRUD 흐름이 뚫린 것을 확인.

### 400 에러 디버깅

중간에 400 이 뜬 경우가 있었는데 — **서버 측 콘솔의 스택트레이스로 원인을 바로 확인**. 백엔드 디버깅은 이 콘솔이 곧 지도. 프론트만 보고 있으면 400 이 왜 났는지 알 방법이 없다.

## 컨트롤러가 로직까지 다 하고 있다 — 서비스 분리

여기까지는 **컨트롤러 안에 저장소 · 로직 · 응답이 다 뒤섞여 있다.** 컨트롤러의 원래 책임은 "요청 받고 응답 뱉기" 뿐인데 지금은 비즈니스 로직 (id 발급, todo 갱신 규칙) 도 들고 있음. 분리가 필요.

## 레이어드 아키텍처 — Controller / Service / Repository

로직을 서비스로 옮기고, 저장소를 리포지토리로 뽑아냈다. 이걸 **레이어드 아키텍처 (Layered Architecture)** 라고 부른다:

| 계층 | 책임 |
|---|---|
| **Controller** | 요청 · 응답 (HTTP 접점) |
| **Service** | 비즈니스 로직 |
| **Repository** | 저장/조회 (데이터 접점) |

3개로 나누면:

- **각 계층이 단일 책임** — 어디를 고쳐야 하는지 명확
- **테스트가 쉬워짐** — Service 만 단위 테스트하고 싶으면 Repository 를 [#1 에서 배운 DI](/posts/spring-boot-log-01-first-run-controller-and-di#의존성-주입-di--서비스컨트롤러-분리) 로 mock 주입
- **수정 파급이 좁아짐** — DB 를 인메모리에서 실제 DB 로 바꿀 때 Repository 만 손봄

## Update 요청은 왜 파일 따로 뺄까

`record TodoCreateRequest(String title) {}` 처럼 요청 바디용 컨테이너를 **파일로 따로 두는 관례**. 필수는 아닌데 왜 그렇게 할까?

- **파일명으로 역할이 드러난다** — `TodoUpdateRequest.java` 를 보면 "이건 수정 요청 스키마" 임이 즉시 파악
- **컨트롤러/서비스 파일이 얇아진다** — record 정의가 안쪽에 끼어들면 본 로직이 밀림
- **재사용/버전 관리 편함** — API v2 로 스키마가 갈리면 파일 통째로 복제/버전 분기

## 예외 처리 — 커스텀 예외 + 전역 예외 처리기

이전에는 존재하지 않는 id 를 조회하면 **빈 응답** 이 오는 상태. 이건 사용자 입장에서 "왜 안 되지" 를 알 수 없음. 커스텀 예외를 만들어서 **404 Not Found** 로 응답하도록:

```java
public class TodoNotFoundException extends RuntimeException { ... }
```

컨트롤러 각 메서드에서 매번 catch 해서 응답 코드 매핑? 노가다. **전역 예외 처리기 (Global Exception Handler)** 를 두면 한 곳에서 처리:

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

이제:

- **컨트롤러는 그냥 throw** 만
- **어떻게 응답에 매핑할지는 처리기가 담당**

[자바 #3 편에서 배운 "throw 는 호출 스택 상위로 강제 전파" 계약](/posts/java-study-log-03-exceptions-concurrency-and-gradle#2-커스텀-예외--print-대신-예외를-쓰는-이유) 이 스프링에선 컨트롤러 → 전역 처리기 흐름으로 자동화된 형태. 자바 문법으로 배운 게 프레임워크에서 실전으로 얹어짐.

## 시행착오 — 학습 지침에 반영

오늘 하면서 두 번 삽질:

1. **참조 클래스가 없는 상태에서 서버 켜기** — 학습 예제 진행 지침이 자꾸 서버 실행부터 시켜서 컴파일 안 됨
2. **라이브러리 추가 전에 라이브러리 사용 코드부터 작성** — 마찬가지로 컴파일 실패

둘 다 **"코드 → 의존성 → 실행" 순서를 지키지 않은 것**. 학습 예제 지침 (내가 AI 에게 주는 프롬프트) 에 "코드 작성 전 필요한 클래스/의존성이 모두 있는지 먼저 확인" 을 추가해서 재발 방지.

실무에서도 같은 함정 — 리팩터링 중 참조가 부서진 상태로 실행하려 하면 이런 컴파일 실패에 시간을 뺏긴다.

## 회고

이번 편에서 잡은 감각 3가지:

1. **REST API 는 URL × HTTP 메서드의 곱** — 정의가 정리되니까 CRUD 작성 자체는 오히려 빠름. 정의를 몰라서 미뤄뒀던 것.
2. **레이어드 아키텍처는 [#1 인터페이스/DI 감각](/posts/spring-boot-log-01-first-run-controller-and-di#인터페이스-감각의-자동화) 의 자연스러운 확장** — Controller 는 Service 인터페이스만 알면 되고, Service 는 Repository 인터페이스만 알면 됨. 각 계층이 다음 계층의 구현체를 모른다는 게 테스트/수정 용이성의 뿌리.
3. **전역 예외 처리기 = 자바 #3 "throw 강제 전파" 의 실전 활용** — 컨트롤러가 그냥 던지면 위에서 처리하는 구조. 자바 #3 에서 배운 게 여기서 왜 필요한지 조립됨.

## 더 공부해볼 것

### 1. DTO 파일 분리 관례

- Request DTO · Response DTO · Domain 모델 3계층을 어떻게 나누는가
- 스키마 진화 (v1 → v2) 를 어떻게 관리하는가
- 참고: [Baeldung — DTO 패턴](https://www.baeldung.com/java-dto-pattern)

### 2. HTTP 상태 코드 표준

- 2xx (200 OK · 201 Created · 204 No Content) — 각각 언제
- 4xx (400 Bad Request · 401 · 403 · 404 · 409 Conflict) — 각각 언제
- 5xx (500 Internal · 502 · 503) — 서버 측 원인 구분
- 표준을 잘 지키면 프론트가 에러 UX 를 자동화하기 좋음

### 3. `@Valid` + Bean Validation

- 요청 바디 필드 검증 (`@NotNull`, `@Size(min=1)`, `@Email` 등)
- 검증 실패 시 자동으로 400 응답
- Bean Validation 실패를 전역 예외 처리기에 어떻게 태우는가

### 4. Repository 계층의 다양한 구현

- 오늘은 인메모리 (List) — 프로세스 재시작하면 날아감
- **JPA / Hibernate** — 자바 표준 ORM
- **Spring Data JPA** — 인터페이스만 정의하면 CRUD 메서드 자동 생성

### 5. DB · SQL 기초 — 다음 학습 축

- 관계형 DB 개념 · 정규화
- PostgreSQL 을 시작점으로
- JPA 로 넘어가기 전 SQL 자체 감각 확보
