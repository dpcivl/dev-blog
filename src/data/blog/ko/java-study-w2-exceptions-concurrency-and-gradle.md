---
title: "자바 공부 W2 (이어서) — 예외 처리 · 동시성 · record · Modern Java · Gradle"
description: "자바 W2 마무리. 예외 처리는 디버깅 편의가 아니라 백엔드 서버가 프로덕션에서 안 죽게 하기 위한 방어막이었음을 이해. print vs throw 의 차이 — print 는 호출자에게 실패를 전달하지 않지만 예외는 강제로 전파. 동시성은 ExecutorService · newFixedThreadPool 로 3초 순차 → 1초 병렬 (실측 3008ms → 1006ms). record 는 필드·생성자·접근자·toString·equals·hashCode 자동 생성 — 강우량계 데이터로거의 RainDataDTO 같은 순수 데이터 컨테이너에 딱 맞음. var/switch 화살표/텍스트 블록 같은 Modern Java 도 훑음. 마지막으로 Gradle — 파일이 수백 개 될 때 java 로 하나씩 컴파일하는 건 불가능, 외부 라이브러리도 자동으로 받아옴. build.gradle 이 핵심 설정 파일."
pubDatetime: 2026-07-07T05:00:00Z
tags:
  - java
  - backend
  - 예외처리
  - 동시성
  - gradle
  - 학습
draft: false
featured: false
---

[W2 컬렉션 · Stream 편](/posts/java-study-w2-collections-and-streams) 에 이어서 W2 마무리. 오늘 목표는 자바 문법 훑기를 얼추 끝내는 것 — **예외 처리 · 동시성 · record · Modern Java · Gradle**.

## Table of contents

## 1. 예외 처리 — "서버가 안 죽게" 위한 방어막

코드: [`ExceptionDemo.java`](https://github.com/dpcivl/be-study/blob/main/week2-collections/ExceptionDemo.java)

예외 처리는 **디버깅할 때 편하려고 하는 것** 정도로 알고 있었다. 이번에 새로 잡은 감각은 이거다:

> **프로덕션에서 예외가 안 잡히면 백엔드 서버 자체가 죽는다.** 예외 처리는 서비스를 계속 살려두기 위한 방어막.

로컬 실행이면 "에러 로그 확인 → 고치기" 로 끝이지만, 실서비스는 요청 하나가 예외로 죽으면 **그 요청을 보낸 사용자만이 아니라 스레드 자체가 종료** 될 수 있다. `try / catch` 는 그 사이 벽.

## 2. 커스텀 예외 — print 대신 예외를 쓰는 이유

코드: [`CustomExceptionDemo.java`](https://github.com/dpcivl/be-study/blob/main/week2-collections/CustomExceptionDemo.java)

**커스텀 예외** = 특정 예외 상황을 하나의 클래스로 만들어서 재사용. `throw new InvalidAgeException(...)` 같이 던지고, 위에서 `catch (InvalidAgeException e)` 로 잡음.

왜 그냥 `System.out.println("에러!")` 로 안 하고 예외를 던지는가 — 이번에 잡힌 감각:

- **`print` 는 호출한 쪽에 "실패했다" 는 사실을 전달하지 않는다.** 함수는 그냥 조용히 지나가고, 호출자는 성공한 줄 안다.
- **`throw` 는 호출 스택 상위로 강제 전파된다.** 처리하지 않으면 스레드가 죽거나 (unchecked) 컴파일이 안 되거나 (checked). "실패했다" 를 무시할 수 없게 만드는 계약.

파이썬의 raise / try / except 랑 개념적으론 같은데, **자바는 checked exception 이라는 별개 카테고리** 가 있어서 "이 메서드는 이런 예외를 던질 수 있다" 를 **메서드 시그니처에 명시** 해야 한다. 이건 파이썬/JS 에는 없는 강제성.

## 3. 동시성 — 순차 3초 → 병렬 1초

코드: [`ThreadDemo.java`](https://github.com/dpcivl/be-study/blob/main/week2-collections/ThreadDemo.java)

순차적으로 처리하던 작업을 **`ExecutorService` + `newFixedThreadPool`** 로 병렬화. 각 작업이 1초 걸리는 3개 작업이면:

- **순차**: 1초 × 3 = 3초
- **동시 (스레드풀 3)**: 3개 스레드에 하나씩 던지면 → 1초 완료

실제 실행 결과:

![ThreadDemo 실행 — 순차 3008ms vs 동시 (pool-1-thread-1/2/3) 1006ms](/assets/posts/java-study-w2-exceptions-concurrency-and-gradle/01-thread-demo-output.png)

**3008ms → 1006ms** — 이론값과 거의 일치. 스레드가 로그에 `pool-1-thread-1`, `pool-1-thread-2`, `pool-1-thread-3` 로 찍혀서 병렬 실행이 눈에 보인다.

이게 백엔드 서버가 여러 요청을 동시에 처리하는 원리. Spring Boot 같은 프레임워크도 내부적으로 이 스레드풀을 굴린다.

## 4. record — 데이터를 나르는 개체

코드: [`RecordDemo.java`](https://github.com/dpcivl/be-study/blob/main/week2-collections/RecordDemo.java)

**`record`** = `class` 대신 쓰는 데이터 컨테이너. 동작 없이 **데이터만 나르는** 게 목적.

```java
record Person(String name, int age) {}
```

이 한 줄이면 **필드 · 생성자 · 접근자 · `toString` · `equals` · `hashCode`** 를 자바가 다 만들어준다. 클래스로 같은 걸 만들면 boilerplate 가 수십 줄이다.

예전에 강우량계 데이터로거 소스코드를 볼 때 `RainDataDTO` 라는 파일이 있었는데 — 필드 몇 개와 getter/setter 만 잔뜩 있는 클래스. 그런 **"데이터의 집합" 타입** 이 record 로 딱 대체된다는 감각.

## 5. Modern Java — var · switch 화살표 · 텍스트 블록

코드: [`ModernDemo.java`](https://github.com/dpcivl/be-study/blob/main/week2-collections/ModernDemo.java)

요즘 자바 감각 3종 — 파이썬을 쓰다 오면 익숙한 것들:

- **`var`** — 타입 추론. `var name = "hyoin";` 처럼 우변으로 타입 추론
- **`switch` 화살표** — [W1 에서 이미 훑었던](/posts/java-study-w1-first-syntax-and-oop-basics#switch--화살표-방식) `case ... ->` 문법
- **텍스트 블록** — `"""..."""` 로 여러 줄 문자열 (Python triple-quoted string 이랑 같은 결)

자바 = 옛날 스타일 boilerplate 가 많다 는 인식이 있는데, 이런 최근 문법들을 쓰면 **파이썬만큼 간결** 해진다.

## 6. Gradle — 왜 필요한가

여기까지는 예제 파일을 `java ExceptionDemo.java` 로 하나씩 실행했다. 그런데 **파일이 수십·수백 개 되는 순간** — 하나씩 컴파일하는 건 불가능. 그리고 **외부 라이브러리** (예: Jackson, Guava, Spring Boot) 를 쓰려면 직접 다운로드해서 classpath 에 넣는 건 현실적으로 불가능.

**Gradle 이 하는 일:**

1. **의존성 관리** — `dependencies` 에 라이브러리를 적으면 자동으로 받아옴
2. **컴파일 & 빌드** — 프로젝트 전체를 한 번에
3. **패키징** — `.jar` 로 묶어서 서버에 배포 가능한 형태로

Spring Boot 프로젝트도 기본이 Gradle 기반이라, 어차피 만나야 하는 도구.

### Gradle 프로젝트 구조

![gradle-demo 프로젝트 구조 — app/build.gradle, gradle/wrapper, gradle.properties, gradlew, settings.gradle](/assets/posts/java-study-w2-exceptions-concurrency-and-gradle/02-gradle-project-structure.png)

- **`build.gradle`** — 핵심 설정 파일. `dependencies` 에 라이브러리 명시
- **`gradlew` / `gradlew.bat`** — 프로젝트별 Gradle 실행 래퍼 (팀원마다 Gradle 버전 안 맞을 걱정 없앰)
- **`settings.gradle`** — 프로젝트 이름, 서브모듈 구성

### 명령어

```bash
gradle run       # 실행
gradle build     # 빌드 → app/build/libs/app.jar 생성
```

`app.jar` 를 서버에 올려서 `java -jar app.jar` 로 실행하면 배포 완료.

## 회고

W2 마무리에서 잡은 감각 3가지:

1. **예외 처리는 디버깅용이 아니라 서비스 가용성 도구** — 프로덕션에서 서버를 계속 살려두기 위한 계약. print 로 대체 불가능한 이유가 여기 있다 (호출자에게 실패를 강제로 전달).
2. **동시성 = "10초 문제를 1초로 만드는" 도구** — 스레드풀에 던지면 이론값 대로 병렬화된다. 다만 이건 "작업이 서로 독립적일 때" 얘기고, 공유 상태가 있으면 race condition · 데드락 등 새 문제가 열림 (심화 주제).
3. **Gradle 은 "지금까지 몰라서 미뤄뒀던 것"** — 예제 단일 파일 실행은 학습 목적으론 충분하지만, 실제 프로젝트로 넘어가는 순간 필수. Spring Boot 로 가려면 이걸 먼저 손에 익혀야 한다.

W2 를 통해 [W1 에서 얻었던 인터페이스 감각](/posts/java-study-w1-first-syntax-and-oop-basics#인터페이스--규격만-정하고-구현은-상속받는-쪽) 이 컬렉션 (List/ArrayList 등) 에서 재활용됐고, 오늘은 **예외의 계약성** — 어떤 예외를 던질 수 있는지 시그니처에 박아두는 자바의 강제성 — 도 같은 결의 사고라는 걸 느꼈다.

## 더 공부해볼 것

### 1. 예외 처리 심화

- **Checked vs Unchecked** — 각각 언제 어느 쪽을 쓰는가
- **`try-with-resources`** — `AutoCloseable` 리소스 자동 해제 (파일 · DB 커넥션)
- **예외 체이닝** — `throw new BusinessException("설명", originalException)` 으로 원인 보존
- **`finally` vs try-with-resources** — 언제 어느 쪽?

### 2. 동시성 심화 — 공유 상태의 함정

- **`synchronized` / `volatile`** — 언제 어느 쪽?
- **Java Memory Model** — 왜 volatile 없으면 다른 스레드에서 안 보이는가
- **Race condition · 데드락** — 어떻게 감지하고 방지하는가
- **`java.util.concurrent`** — `ConcurrentHashMap`, `AtomicInteger`, `CountDownLatch` 등

### 3. record 실전 활용

- **JPA Entity 로 record 를 쓸 수 있는가** — 왜 어려운가
- **DTO 로 record 사용** — API 응답/요청 스키마
- **sealed class 와 조합** — 대수적 데이터 타입 스타일 (Kotlin/Scala 같은 감각)

### 4. Gradle 심화

- **`build.gradle` vs `build.gradle.kts`** — Kotlin DSL 로 쓰는 게 요즘 표준
- **Gradle vs Maven** — 왜 Spring 진영이 Gradle 로 갔는가
- **멀티 모듈 프로젝트** — 큰 서비스는 하나의 프로젝트에 여러 모듈

### 5. Spring Boot 로 이어지기

- **DI · IoC** — Spring 의 핵심 개념
- **`@RestController` / `@Service` / `@Repository`** — 계층별 어노테이션
- **`application.yml`** — 설정 관리
- **REST API 만들어서 실제 백엔드 감각 익히기**
