---
title: "Spring Boot #3 — JPA 로 PostgreSQL 연결 · 엔티티와 리포지토리로 CRUD"
description: "인메모리 List 로 하던 CRUD 를 실제 PostgreSQL 로 교체했다. build.gradle 의존성부터 application.properties, record 를 버리고 @Entity 로, JpaRepository 는 빈 인터페이스인데 CRUD 가 되는 이유, 그리고 컨트롤러를 한 줄도 안 바꾼 레이어 분리의 배당금까지."
pubDatetime: 2026-07-15T02:25:00Z
tags:
  - 백엔드공부
  - spring-boot
  - jpa
  - postgresql
  - crud
  - 학습
draft: false
featured: false
---

[Spring Boot #2 (REST API 로 CRUD · 레이어드 아키텍처)](/posts/spring-boot-log-02-rest-api-crud-and-layered-architecture) 에서는 CRUD 를 **인메모리 List** 로 처리했다. 프로세스를 재시작하면 데이터가 다 날아가는 임시 저장소였다. #2 의 "더 공부해볼 것" 에 적어뒀던 그 다음 축 — **JPA 로 실제 DB 붙이기** — 를 오늘 했다.

마침 얼마 전 [PostgreSQL 기초](/posts/postgresql-sql-basics) 에서 SQL 로 직접 해봤던 CRUD 를, 이번엔 자바(JPA)로 다시 해본 셈이다.

## Table of contents

## 1. build.gradle — 의존성 두 개

JPA 를 쓰려면 먼저 `build.gradle` 에 의존성을 넣어야 한다. 두 개가 필요했다.

```gradle
dependencies {
    // JPA (Hibernate 포함) — 객체를 DB 테이블에 매핑
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
    // 자바가 PostgreSQL 과 실제로 말을 주고받는 통로 (JDBC 드라이버)
    runtimeOnly 'org.postgresql:postgresql'
}
```

`starter-data-jpa` 는 ORM 본체고, `postgresql` 은 자바와 PostgreSQL 사이의 통로(드라이버)다. 둘 중 하나만 있으면 안 된다 — 매핑은 되는데 접속을 못 하거나, 그 반대가 된다.

## 2. application.properties — 데이터소스 + JPA 설정

다음으로 `application.properties` 에 DB 접속 정보와 JPA 동작 설정을 적었다.

```properties
# 어느 DB 에 붙을지
spring.datasource.url=jdbc:postgresql://localhost:5432/study
spring.datasource.username=<your_username>
spring.datasource.password=<your_password>

# JPA 동작 설정
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
```

> ⚠️ `username` · `password` 는 실제 값을 커밋하면 안 된다. 여기선 자리표시자로 뒀다. 실무에선 환경변수나 `application-local.properties` 로 빼고 `.gitignore` 하는 게 안전하다.

## 3. record 를 버리고 @Entity 로

#2 까지는 데이터를 담는 컨테이너로 자바 `record` 를 썼다. 그런데 이번에 그걸 버리고 **JPA 엔티티 클래스**로 바꿔야 했다.

```java
@Entity
public class Todo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;
    private boolean done;

    protected Todo() {}          // JPA 가 쓰는 빈 껍데기 생성자

    public Todo(String title) {
        this.title = title;
        this.done = false;
    }
    // getter / setter ...
}
```

- `@Entity` — 이 클래스가 DB 테이블과 연결된다는 표시
- `@Id` — 기본키 지정
- `@GeneratedValue` — 기본키 값을 DB 가 자동 생성 (PostgreSQL 이면 시퀀스/IDENTITY)

### record 가 JPA 와 안 맞는 이유

여기서 하나 배웠다. **왜 record 로는 안 되는가.**

JPA 는 DB 에서 읽어온 값으로 객체를 만들 때, 먼저 **빈 껍데기 객체를 만들어 놓고** 그 다음에 필드를 하나씩 채워 넣는 방식으로 동작한다. 그래서 두 가지가 필요하다.

1. **인자 없는 기본 생성자** — 빈 껍데기를 만들 수 있어야 함 (그래서 `protected Todo() {}`)
2. **필드를 나중에 바꿀 수 있어야 함** — 만들어 놓고 값을 채우니까

그런데 `record` 는 정반대다. 생성할 때 값을 다 넣어야 하고, 한 번 만들면 값을 못 바꾸는 **불변(immutable)** 구조다. JPA 의 "빈 껍데기 먼저, 값은 나중에" 방식과 정면으로 충돌한다. 그래서 record 를 버린 것이다.

## 4. Repository — 빈 인터페이스인데 CRUD 가 된다

오늘 제일 신기했던 부분. `Repository` 라는 인터페이스를 만들었는데:

```java
public interface TodoRepository extends JpaRepository<Todo, Long> {
    // 안이 비어 있다.
}
```

`JpaRepository<Todo, Long>` 를 상속받기만 하고 **안에는 아무것도 안 적었는데** `save()`, `findAll()`, `findById()`, `deleteById()` 같은 CRUD 메서드가 다 쓸 수 있게 된다. 구현 클래스를 내가 만든 적이 없는데도 동작한다.

이게 어떻게 되는 건지는 아직 정확히 모르겠다 — Spring 이 런타임에 뭔가 대신 구현해주는 것 같은데, 그 원리는 아래 "더 공부해볼 것" 으로 남긴다.

## 5. Service — ArrayList 에서 Repository 로

Service 클래스는 대폭 바뀌었다. 원래는 클래스 안에서 `ArrayList` 를 직접 만들어 CRUD 를 담당했는데, 오늘은 그 자리를 **Repository 를 불러서** 대신하게 했다.

```java
// 전 (인메모리)
private final List<Todo> todos = new ArrayList<>();

// 후 (JPA)
private final TodoRepository todoRepository;
// ... todoRepository.save(todo), todoRepository.findAll() ...
```

저장 위치가 메모리 List 에서 실제 DB 로 옮겨갔을 뿐, 서비스가 바깥에 보여주는 **메서드 이름과 반환 타입은 그대로** 유지했다.

## 6. Controller 는 한 줄도 안 바꿨다

그리고 이게 오늘의 하이라이트다. **Controller 는 하나도 안 고쳤다.**

가능했던 이유: 처음 레이어를 나눌 때부터 컨트롤러는 서비스의 **반환 타입과 메서드 이름만** 보고 썼기 때문이다. 서비스 속을 List 에서 JPA 로 통째로 갈아엎어도, 바깥 계약(메서드 이름·반환 타입)이 그대로면 컨트롤러 입장에선 바뀐 게 없다. 그래서 그대로 가져다 쓴다.

저장소를 인메모리에서 DB 로 바꾸는 큰 변경인데도 위층(컨트롤러)이 무사한 것 — 이게 레이어를 나눠둔 값어치였다.

## 7. SQL 을 안 썼는데 SQL 이 돈다

세팅을 다 하고 나니, 정말 내가 SQL 을 한 줄도 안 썼는데 **JPA 가 알아서 SQL 을 만들어 호출**하고 있었다.

이전에 파이썬으로 SQLite 명령어를 직접 문자열로 호출해서 DB 를 다뤘던 기억이 나는데, 그때랑 비교하니 JPA 로 객체만 다뤘는데 DB 가 조작되는 게 꽤 신기했다. (`spring.jpa.show-sql=true` 를 켜두면 JPA 가 실제로 어떤 SQL 을 날리는지 로그로 볼 수 있다.)

## 회고 — 레이어를 나누는 의미

오늘 예제를 하면서 **레이어를 나누는 의미**가 몸으로 이해됐다.

- **API 주소가 바뀌면** → 컨트롤러만 바꾼다
- **로직이 바뀌면** → 서비스만 바꾼다
- **저장 방식이 바뀌면 (List → DB)** → 서비스 속만 바꾸고 컨트롤러는 그대로 (오늘 겪음)

테스트할 때도 이점이 있다. 레이어가 분리돼 있으니 **테스트하고 싶은 층만 떼어서** 검증할 수 있다.

## 더 공부해볼 것

- **JpaRepository 가 구현 없이 동작하는 원리** — 빈 인터페이스인데 CRUD 가 되는 그 마법. Spring Data JPA 가 런타임에 프록시(proxy) 구현체를 만들어 주입한다고 알고 있는데, 정확히 어떻게 되는지. → [Spring Data JPA Reference](https://docs.spring.io/spring-data/jpa/reference/repositories/core-concepts.html)
- **JPA 가 실제로 만드는 SQL 보기** — `show-sql=true` 로그를 읽어보고, `INSERT`/`SELECT` 가 어떻게 생성되는지. 내가 [PostgreSQL 기초](/posts/postgresql-sql-basics) 에서 직접 쓴 SQL 과 비교.
- **`@GeneratedValue` 전략 4가지** — `IDENTITY` / `SEQUENCE` / `TABLE` / `AUTO`. PostgreSQL 에선 뭐가 맞고 뭐가 성능에 유리한지. → [Baeldung: JPA @GeneratedValue](https://www.baeldung.com/hibernate-identifiers)
- **`ddl-auto` 옵션** — `update` / `create` / `create-drop` / `validate` / `none`. 개발 땐 편하지만 운영에서 `update` 를 쓰면 위험한 이유.
- **기본 생성자가 왜 `protected` 인가** — `private` 도 `public` 도 아닌 이유. JPA(프록시)는 접근해야 하지만 내 코드에서 빈 객체를 함부로 만들면 안 되니까 — 이 절충을 더 정확히.
- **N+1 문제** — 연관관계(예: 사용자–할일)가 생기면 마주친다는 그 유명한 성능 함정. 아직 엔티티가 하나뿐이라 안 만났지만, 관계를 붙이기 전에 미리 감을 잡아두기.
