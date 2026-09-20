---
title: "백엔드 첫 과제 회고 — 더럽게라도 구현하고 리팩토링할 걸 그랬다"
description: "기존 화면이 하던 조회를 REST API 로 다시 꺼내오는 과제를 받았다. Controller · Service · Mapper · XML 을 순서대로 만들면서 의존성 주입과 MyBatis 를 처음 이해했고, 하루를 다 쓰고도 확장을 못 끝냈다."
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

백엔드 과제를 받아서 하루를 꼬박 썼다. 기존 넥사크로 화면이 하던 조회를 REST API 로 다시 꺼내오는 일이었다. 임베디드만 하다가 처음 만지는 구조라 하나씩 뜯어봐야 했다.

## Table of contents

## 층이 나뉘어 있다

먼저 파일들이 왜 이렇게 여러 개로 갈라져 있는지부터 봤다.

- **Controller**: 인터럽트 핸들러다. 외부(HTTP)에서 들어온 요청을 받아 파라미터만 정리하고 바로 위임한다. 여기에 로직을 쓰면 안 된다
- **Service**: 실제 업무 로직
- **Mapper**: DB 에 접근하는 통로
- **DTO / VO**: 계층 간에 주고받는 구조체를 정의한다. Lombok 이 `@Data` 로 getter / setter 를 컴파일 타임에 자동 생성한다

Controller 를 인터럽트 핸들러로 이해하니까 바로 납득이 됐다. 핸들러 안에서 오래 붙잡고 있으면 안 되는 것과 같은 이야기다.

## `@RequiredArgsConstructor` 와 `private final` 이 의존성 주입이었다

인터페이스와 `Impl` 이 나뉘어 있고, `GradeService` 타입을 요구하면 `GradeServiceImpl` 인스턴스를 꽂아주는 식이다. 그 주입이 `@RequiredArgsConstructor` + `private final` 로 이뤄진다.

처음엔 이게 왜 주입인지 몰랐다. 풀어서 보면 이렇다.

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

`final` 은 C 언어의 `const` 포인터와 비슷하다. `@RequiredArgsConstructor` 는 `final` 로 선언된 필드들을 파라미터로 받는 생성자를 만들어달라는 매크로다. 개념은 그냥 생성자다.

`const` 포인터에 비유한 게 꽤 정확했다. 자바의 `final` 필드도 **참조를 다시 못 바꾸는 것**이지, 그 참조가 가리키는 객체의 내용까지 잠그는 건 아니다. C 로 치면 `T* const` 쪽이다.

그리고 이 생성자를 Spring 이 앱 시작할 때 대신 호출해준다. 이게 DI 다.

<img src="/assets/mermaid/19004444e65637b6.svg" alt="Spring 이 앱 시작 시 구현체를 만들어 컨테이너에 Bean 으로 보관하고, Controller 를 만들 때 생성자가 요구하는 타입을 꺼내 넣어주는 흐름" width="276" height="710" style="max-width:min(100%, 276px);height:auto;" />

Spring 은 앱을 켤 때 구현체들을 하나씩 만들어 컨테이너에 보관해둔다. 이 상자 속 객체를 **Bean** 이라고 부른다. `GradeController` 를 만들 차례가 되면 "이 생성자가 `GradeService` 타입을 필요로 하네" 하고 상자에서 이미 만들어둔 인스턴스를 꺼내 자동으로 넣어준다.

[Spring Boot 공부할 때](/posts/spring-boot-log-01-first-run-controller-and-di) 의존성 주입을 한 번 봤었는데, 그때는 감만 잡았지 이렇게 풀어서 이해하지는 못했다.

## "REST API 로 뽑아낸다" 가 무슨 뜻인가

과제 설명에 나온 이 말이 뭘 하라는 건지 한참 걸렸다. 정리하면 이 순서다.

<img src="/assets/mermaid/1253e7d27d9cc9ea.svg" alt="사용자가 화면에서 버튼을 누른 뒤 Controller · Service · Mapper · MyBatis · 오라클을 거쳐 JSON 응답이 돌아오는 9단계 요청 흐름" width="276" height="1166" style="max-width:min(100%, 276px);height:auto;" />

내 상황에서는 데이터를 화면에 뿌리는 로직을 기존 넥사크로가 이미 갖고 있었다. 그래서 어느 테이블에서, 어느 컬럼을, 어떤 조건으로 조회하는지를 베껴 오면 됐다. **같은 정답을 다른 통로로 꺼내오는 일이다.**

[레이어드 아키텍처를 공부할 때](/posts/spring-boot-log-02-rest-api-crud-and-layered-architecture) 본 구조가 실제 코드에서는 이렇게 생겼다.

## 백엔드 개발자는 띄워서 확인하지 않는다더라

백엔드 개발자분에게 물어보니 **뭔가를 띄워서 결과를 확인하는 일은 잘 없다**고 한다. 보통 머릿속으로 로직을 그려서 개발한다고 했다.

임베디드에서는 항상 컴파일하고 빌드해서 동작을 확인한 뒤 다음 기능을 구현하는 식으로 했었다. 습관이 꽤 다르다.

AI 에게 물어본 백엔드 개발자의 작업 순서는 보통 이렇다고 한다.

1. 명세부터 정한다 — URL, 파라미터, 응답 JSON 모양. 이걸 머릿속으로 그린다
2. 기존 유사 기능을 보고 층별로 뼈대를 만든다 — DTO → Mapper → XML → Service → Controller
3. SQL 은 DB 툴에서 먼저 돌려본다
4. Service 단위 테스트 또는 로컬 기동 후 curl 로 확인한다
5. PR 을 올려 리뷰받는다

## 비슷한 기능의 코드를 읽었다

코드 분석을 AI 에게 시켜봤는데 자연어만 나열된 것으로는 이해가 완전히 되지 않았다. 그래서 내가 구현해야 하는 "강의계획서 조회" 와 비슷한 "성적 조회" 기능의 코드를 직접 읽기로 했다.

읽고 나서 한 줄로 정리한 게 이거다.

> Controller 에서 Service 를 호출하고, Service 의 구현은 `ServiceImpl` 에서 한다. `ServiceImpl` 은 Mapper 를 호출하고, Mapper 의 이름을 키로 XML 에서 SQL 을 찾는다. SQL 에서 응답받은 값을 DTO 에 넣고, `ServiceImpl` 은 이 DTO 들을 Response 객체에 담고, Controller 가 그 Response 를 리턴한다. Spring 이 Response 를 JSON 으로 변환해 응답한다.

## 시간이 없어서 일단 학생 경로부터

강의계획서 조회에는 학생 경로, 교원 경로, 직원 경로가 필요했다. 백엔드가 익숙하지 않고 한 번에 짜면 디버깅이 어려우니 **하나라도 먼저 제대로 짜는 것**을 목표로 잡았다.

기존에 동작하던 넥사크로 코드로 as-is 분석을 해서 출력 형식, 기존 조회 로직, 입력 파라미터를 확인했다. 그리고 DTO → Mapper → XML → Service → Controller 순으로 구현하기로 했다.

### DTO

기존에 있던 DTO 소스 코드를 보고 형식을 따라했다. 크게 틀린 건 없었다. **DTO 에서 사용한 필드 이름을 XML 에서 똑같이 해야 한다**는 걸 알았다.

### Mapper — 주석을 못 썼다

Mapper 도 기존 소스를 보고 형식을 따라했다. 쓰긴 썼는데 이 Mapper 가 어떻게 SQL 을 써서 DB 에서 값을 가져오는지가 이해되지 않았다.

**메서드 이름과 XML 의 `id` 가 같아야 매칭된다**는 걸 이해하고 나서 풀렸다. XML 에서 SQL 을 구현하는 건 Mapper 다음 순서니까, 지금은 Mapper 메서드 이름만 정하면 된다.

막힌 건 다른 데였다. 메서드 상단 주석에 어떤 SQL 인지 한 줄 주석을 쓰는 게 관례였는데, 이걸 어떻게 지켜야 하는지 이해가 안 됐다. 실제 존재하는 테이블을 찾아서 매칭해 알려줘야 하는데 **그 테이블을 못 찾아서** 제대로 못 적은 것이었다.

테이블 주석을 적는 이유는 어느 테이블에서 무엇을 읽는지 알려줘야 XML 을 열지 않고도 알 수 있기 때문이다.

### XML — SQL 이 부족했다

Mapper 인터페이스와 동일한 이름의 XML 파일을 `sql.oracle` 디렉토리에 만들었다. XML 을 작성하는 건 진짜 처음이어서 헷갈렸다.

`resultMap` 의 `id` 를 뭘로 해야 할지 몰랐는데 **그냥 내가 정하는 것**이었다. 나머지는 Mapper 에서 정한 대로 이름 틀리지 않게 형식 맞춰서 옮겨 적었다.

그런데 형식만 맞게 따라 적어서는 안 됐다. 강의계획서 조회를 하려면 원래 하던 기존 파일의 동작 로직과 같게 만들어야 하는데, **SQL 에 대한 이해가 부족해서 기존 로직을 옮겨 쓸 수 없었다.** SQL 공부가 많이 필요하다는 생각을 했다.

`resultMap` 에서 쓰는 컬럼 이름과 `select` 에서 쓰는 컬럼 이름을 잘 맞춰줘야 한다는 것도 배웠다.

### Service — cannot find symbol

Service 는 인터페이스와 `ServiceImpl` 클래스를 만들어야 했다. `@RequiredArgsConstructor` 와 `private final` 로 생성자를 만들어줬다.

`cannot find symbol` 오류가 많이 나왔다. import 에서 자꾸 빠뜨리는 게 있었다. 오타 때문에 못 찾거나, 서로 다른 패키지의 클래스를 쓸 때 import 를 빼먹어서 컴파일이 안 되는 경우가 잦았다.

vo 에서 Response 를 안 만들어줘서 `Impl` 클래스에서 Response 를 쓸 수 없는 게 문제라고 판단해서, DTO 가 있던 자리에 Response 파일을 만들어줬다.

## 단위 테스트는 못 했다

기능 하나 구현할 때마다 테스트 코드를 작성해서 검증해야 할 것 같았는데, **기존에 `src/test` 폴더 자체가 없었다.**

테스트 코드를 AI 에게 맡긴다면 어떤 기능을 검증하려는 건지 철저하게 확인한 후에 작성해야, 코드가 변경됐을 때 신뢰성 있게 테스트할 수 있을 것 같다는 생각이 들었다.

## Controller — 스텁으로 컴파일만 통과시켰다

`core` 서브모듈이 없어서 컴파일이 안 되는 상황이었다. 그런데 스텁으로 컴파일은 되게 했다.

스텁으로 컴파일 되게 했다는 건, `core` 서브모듈과 같은 이름의 **껍데기 클래스를 임시로 만들어서** 컴파일러가 통과하게 한 것이다. 그래서 **실제로 돌아가는 코드인지는 확인할 수 없다.**

좀 익숙해져서, 코드를 적다가 import 해야 하는 게 생기면 위로 올라가 import 를 적고 다시 내려와서 아래 코드를 작성하는 식으로 진행했다. 계속 디버깅하다 보니 어느 부분의 모듈을 빼먹었는지 찾아 고치는 게 익숙해졌다.

그런데 **컴파일러가 잡지 못한 버그를 하나 냈다.** `apiBaseUrl` 인데 `apiBaseurl` 로 친 것이다. 직접 치는 것보다 그냥 복붙하는 게 코드 안정성에 도움이 될 것 같다.

요구사항 정의서와 화면설계서를 못 찾고 진행한 과제였다 보니, 변수명을 정한다든지 다른 규칙을 정하는 측면에서 부족함이 많았던 것 같다.

## 교원까지 늘리니 조건을 이해해야 했다

학생뿐만 아니라 교원 · 직원도 강의계획서를 조회하게 해야 했다. 이미 학생을 위해 만든 기존 파일에 교원 경로를 먼저 추가했다. Mapper, XML, Service(+Impl), Controller 를 수정했다.

XML 을 작성할 때 `SELECT` 만 적는 게 아니고 `resultMap` 도 챙겨서 적어줘야 한다.

학생 하나만일 때는 그냥 따라 써도 바로 되는 느낌이었는데, 교원까지 늘리려고 하니까 **조건에 대해서 제대로 이해해야 쓸 수 있는 느낌**이었다. 역시나 SQL 공부가 필요하다는 생각이 들었다.

### `NVL`

`NVL` 은 오라클 함수다. 자바가 아니라 SQL 안에서 쓰는 것이고, 값이 `NULL` 이면 대신 다른 값을 쓴다.

```sql
NVL(값, 대체값)
```

## 회고

과제를 다 못 끝냈는데 하루가 다 가버렸다. 원래는 교직원, 관리자 쪽까지 확장을 다 했어야 하는데, **교직원 · 관리자 · 학생을 어떻게 구분할지 방법을 몰라서** 구현하기 쉽지 않았던 것 같다.

조금 더 구현하고 물어보고 싶은데, 또 미루게 되면 끝도 없을 것 같아서 내일은 그냥 한 것까지 보여줘야 할 것 같다.

하나의 케이스만 다룰 때는 복잡하지 않았는데, 여러 케이스를 다루려니까 클래스나 메서드를 추가로 더 만드는 게 맞는지, 어떻게 분기를 나누고 필요한 호출을 해야 할지 고민해야 했다. 어렵기도 하고 재밌기도 한 것 같다.

**근데 지금 와서 생각해보니 그냥 더럽게라도 구현하고 나서 리팩토링을 하면 됐겠다 싶다.** 구조를 미리 맞추려다가 진도가 안 나갔다.

툴을 이용하지 않고 머리로만 생각하고, 직접 실행해서 컴파일 되나 안 되나만 보면서 코드를 짰다. 펜으로 필기를 하든가 구조를 그리면서 했으면 좀 더 쉽지 않았을까 하는 생각이 들었다.

## 더 공부해볼 것

- **SQL — 조건절과 JOIN** — 하루 동안 같은 벽에 세 번 부딪혔다. XML 에서 기존 로직을 못 옮겼고, 교원 경로를 늘릴 때 또 막혔다. 다음 과제 전에 이것부터 메워야 한다 → [Oracle: SQL Queries and Subqueries](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/SQL-Queries-and-Subqueries.html)
- **학생 · 교원 · 직원을 어떻게 구분하는가** — 이걸 몰라서 확장을 못 끝냈다. 로그인한 사용자의 역할을 어디서 판단하는지, 그 분기를 Controller 에서 하는지 Service 에서 하는지 기존 코드에서 찾아봐야겠다
- **컴파일러가 `apiBaseurl` 을 왜 못 잡았나** — 자바 식별자였다면 `cannot find symbol` 이 났을 텐데 그냥 넘어갔다. 설정 키나 문자열로 쓴 이름이었을 것 같은데, 어디에 쓴 이름이었는지 확인해두면 다음에 같은 실수를 막는 방법이 달라진다
- **테스트 폴더가 없는 프로젝트에 테스트를 어떻게 넣는가** — `src/test` 가 아예 없었다. 기존 구조를 건드리지 않고 Service 단위 테스트만 먼저 붙일 수 있는지 → [Spring Boot: Testing](https://docs.spring.io/spring-boot/reference/testing/index.html)
- **스텁 말고 실제로 돌려보는 방법** — `core` 서브모듈을 받아서 로컬 기동까지 해보면 "컴파일은 되는데 도는지는 모른다" 상태를 벗어날 수 있다
- **Lombok 이 실제로 생성한 코드 보기** — `@RequiredArgsConstructor` 가 만든 생성자를 눈으로 확인하면 DI 가 더 확실해질 것 같다. delombok 이라는 게 있다고 들었다 → [Lombok: Delombok](https://projectlombok.org/features/delombok)
