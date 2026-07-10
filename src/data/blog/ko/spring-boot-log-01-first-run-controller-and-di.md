---
title: "Spring Boot #1 — 첫 실행 (bootRun · Tomcat 내장) · @RestController · 의존성 주입 감 잡기"
description: "자바 #3 (예외 · 동시성 · Gradle) 을 매듭짓고 오늘부터 Spring Boot. Spring Initializr 로 hello-spring 프로젝트를 뽑고 ./gradlew bootRun 으로 실행 — 터미널이 \"80% EXECUTING\" 에서 멈춘 것처럼 보이는데 사실은 이미 서버가 8080 에 뜬 상태 (Gradle daemon 이 프로세스를 붙잡고 있어서 진행률이 그렇게 표시됨). Spring Boot 는 Tomcat 을 내장하고 있어서 별도 WAS 설치 없이 8080 이 뜨는 것. 엔드포인트가 없으면 8080 에 접속해도 에러 페이지가 나오고, @RestController + @GetMapping 으로 경로를 지정해야 응답이 붙는다. 이후 의존성 주입 (DI) 감 잡기 — 컨트롤러가 서비스 인스턴스를 new 로 만들지 않는데도 서비스가 주입되는 이유는 스프링이 시작 시 @Service 클래스의 인스턴스를 하나 만들어 빈 (Bean) 으로 보관하고 있다가 컨트롤러 생성자에 자동으로 꽂아주기 때문. 자바 #1 부터 이어진 인터페이스 감각 — 구현체를 모르고 넘겨받아서 쓰는 계약성 — 이 스프링에서 자동화된 형태. 결합도가 낮아지고 테스트가 쉬워지는 이유가 여기 있다."
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

[자바 #3 (예외 · 동시성 · Gradle)](/posts/java-study-log-03-exceptions-concurrency-and-gradle) 를 매듭짓고 오늘부터 **Spring Boot**. 첫 회차는 프로젝트 스캐폴딩 · 첫 실행 · 컨트롤러 · 의존성 주입 감 잡기.

## Table of contents

## Spring Initializr — 프로젝트 스캐폴딩

스프링 프로젝트는 [Spring Initializr](https://start.spring.io/) 라는 도구로 만든다. 웹에서 필요한 옵션 (Gradle · Java · Spring Boot 버전 · 의존성) 을 고르고 zip 을 받는 방식. `hello-spring` 프로젝트를 하나 뽑음.

## `./gradlew bootRun` — 서버 실행

```bash
./gradlew bootRun
```

`gradlew` = **Gradle Wrapper**. [자바 #3 편에서 잠깐 언급](/posts/java-study-log-03-exceptions-concurrency-and-gradle#6-gradle--왜-필요한가) 했던 그 wrapper 가 여기서 실제로 쓰인다 — 팀원마다 Gradle 버전 안 맞는 문제를 프로젝트 자체가 해결.

`bootRun` 은 Spring Boot 애플리케이션을 실행하는 표준 Gradle 태스크.

## 함정 — 터미널이 "80% EXECUTING" 에서 멈춰있다

![Spring Boot 실행 로그 — Tomcat initialized with port 8080, Starting service [Tomcat], Started HelloSpringApplication in 1.246 seconds, 하단에 "80% EXECUTING [14m 55s]" 진행바가 계속 유지](/assets/posts/spring-boot-log-01-first-run-controller-and-di/01-spring-boot-startup-80-executing.png)

명령을 넣고 봤더니 진행바가 **`80% EXECUTING [14m 55s]`** 에서 안 움직인다. 처음엔 뭔가 걸린 줄 알고 계속 기다렸다.

실제로는 **이미 서버가 8080 에 떠 있는 상태**. 로그를 보면 `Started HelloSpringApplication in 1.246 seconds` 로 이미 완료 표시. Gradle daemon 이 서버 프로세스를 계속 붙잡고 있어야 하니 태스크 자체는 종료되지 않아서 진행률이 저 상태로 유지되는 것.

## 왜 그냥 8080 이 뜨는가 — Tomcat 내장

간단한 명령어만 넣었는데 **WAS 가 알아서 8080 포트에 뜬다.** Spring Boot 는 **Tomcat 을 내장** (embedded) 하고 있어서 가능한 것. Tomcat 을 별도로 설치·설정하지 않아도 애플리케이션이 자기 WAS 를 하나 들고 다니는 셈.

이게 예전 스프링 (spring MVC 등) 에서는 톰캣을 따로 설치하고 .war 를 그 위에 올려야 했던 흐름을 대체하는 부분.

## 엔드포인트가 없으면 에러 페이지

서버가 뜨긴 했지만 아무 경로도 만들지 않은 상태 → 브라우저로 `http://localhost:8080` 에 접속하면 에러 페이지가 나온다.

응답을 붙이려면 **컨트롤러** 를 만들고 경로를 지정해줘야 함:

```java
@RestController
public class HelloController {

    @GetMapping("/hello")
    public String hello() {
        return "Hello, Spring Boot";
    }
}
```

- **`@RestController`** — 이 클래스가 REST 응답을 뱉는 컨트롤러라고 스프링에 알림
- **`@GetMapping("/hello")`** — HTTP GET `/hello` 로 오는 요청을 이 메서드가 받음

이제 `http://localhost:8080/hello` 로 가면 "Hello, Spring Boot" 가 뜬다.

## 의존성 주입 (DI) — 서비스/컨트롤러 분리

방금 예제에서는 컨트롤러가 직접 문자열을 return 했다. 실제 서비스에서는 **컨트롤러는 요청만 받고 로직은 서비스에서 처리**. 이게 계층 분리의 기본형.

서비스와 컨트롤러를 나눠서 만들어봄:

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

    public HelloController(GreetingService service) {  // 생성자로 서비스 요구
        this.service = service;
    }

    @GetMapping("/hello")
    public String hello() {
        return service.greet("Spring");
    }
}
```

여기서 **이상한 점** — `HelloController` 를 만든 적이 없는데 어떻게 서비스가 들어와있는가? `new GreetingService()` 를 어디에서도 한 적이 없는데?

답: **스프링이 넣어준 것.** 이걸 **의존성 주입 (Dependency Injection)** 이라고 부른다.

## 빈 (Bean) — 스프링이 관리하는 인스턴스

동작 흐름:

1. **시작 시**: 스프링이 `@Service` 가 붙은 클래스를 찾아서 **인스턴스를 하나 만들어 보관**. 이 인스턴스를 **빈 (Bean)** 이라고 부름
2. **컨트롤러 요청 시**: 컨트롤러 생성자가 `GreetingService` 를 요구하면 **스프링이 빈을 알아서 꽂아줌**

즉 개발자는 "이 클래스가 필요하다" 만 선언하고, **누가 만드는지 · 언제 만드는지 · 어떻게 재사용되는지** 는 스프링이 관리.

## 인터페이스 감각의 자동화

이 그림에서 익숙한 감각이 떠올랐다 — [자바 #1 에서 배운 인터페이스](/posts/java-study-log-01-first-syntax-and-oop-basics#인터페이스--규격만-정하고-구현은-상속받는-쪽). 인터페이스 = **구현체를 모르고 넘겨받아서 쓰는 계약성**.

DI 는 이 계약성을 **스프링이 빈을 통해 자동으로 처리** 하는 것.

```java
// 인터페이스로 받으면
private final GreetingService service;  // 실제 구현체가 뭔지 컨트롤러는 모름

// 스프링이 빈을 꽂아줄 때 어떤 구현체든 교체 가능
```

이 구조가 갖는 실질적 이득 2가지:

1. **결합도가 낮아진다** — 컨트롤러는 서비스 인터페이스만 알면 됨. 구현체가 바뀌어도 컨트롤러는 그대로
2. **테스트가 쉬워진다** — 테스트 시 진짜 서비스 대신 **mock 서비스** 를 빈으로 꽂아 넣을 수 있음. DB 없이도 컨트롤러 테스트 가능

## 회고

첫 회차에 잡은 감각 3가지:

1. **자바 편에서 예감했던 것들이 실제로 조립되기 시작** — 스레드풀 (Tomcat 이 내부적으로 굴린다) · 예외 처리 (컨트롤러에서 실제 예외 흐름) 등이 조각으로만 있던 게 스프링에서 하나로 얹어지기 시작.
2. **`gradlew bootRun` = "Gradle 배웠던 게 여기서 쓰이는구나"** — 자바 #3 편에서 wrapper 개념을 손에 익혔는데 첫 실전 활용 지점이 됨. 학습이 순서에 맞게 쌓인 것.
3. **DI 는 인터페이스 감각의 자동화** — 자바 #1 부터 이어진 "구현체 몰라도 규격만 지키면 됨" 이라는 자바의 계약성이 스프링에선 프레임워크가 자동으로 이어주는 형태. 자바 문법 훑기가 헛되지 않았다는 감각.

## 더 공부해볼 것

### 1. MVC 패턴 vs 서비스 계층 (헷갈렸음)

- **MVC** 는 Model-View-Controller — 표현 계층 (요청 처리) 의 패턴
- **서비스 계층** 은 비즈니스 로직 계층 — MVC 의 C 뒤에 붙는 별도 축
- 이 둘의 관계 · 스프링에서 어떻게 조합되는지 정확히 정리 필요
- 참고: [Spring 공식 문서 — Web MVC](https://docs.spring.io/spring-framework/reference/web/webmvc.html)

### 2. `@Component` vs `@Service` vs `@Repository` vs `@Controller`

- 모두 스프링이 관리하는 빈으로 등록하는 어노테이션
- **역할별로 나뉜 이유** (레이어 표시 · AOP 대상 특화 · 예외 변환 등)
- 그냥 `@Component` 로 다 해도 동작은 하지만 왜 나눠 쓰는가

### 3. REST API 설계 — CRUD

- `@GetMapping` · `@PostMapping` · `@PutMapping` · `@DeleteMapping`
- 요청 바디 · 경로 변수 · 쿼리 파라미터 각각 어떻게 받는가
- 응답 상태 코드 표준 (200 · 201 · 400 · 404 · 500)
- 실제 CRUD 하나 만들어보면서 감 잡기

### 4. 의존성 주입의 3가지 방식

- **생성자 주입** (오늘 예제) — 왜 이게 권장인가
- **Setter 주입** — 언제 쓰는가
- **필드 주입** (`@Autowired`) — 왜 안티패턴으로 취급되는가

### 5. Spring Boot 의 auto-configuration

- 왜 `application.properties` 몇 줄만 넣어도 Tomcat/DB 설정이 알아서 되는가
- `@EnableAutoConfiguration` · `spring.factories` 흐름
- 자동 설정을 override 하고 싶을 때 접근법
