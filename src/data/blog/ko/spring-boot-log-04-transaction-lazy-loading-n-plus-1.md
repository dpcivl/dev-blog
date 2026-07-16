---
title: "Spring Boot #4 — 트랜잭션 · 연관관계 · N+1 과 fetch join"
description: "엔티티를 @ManyToOne 으로 연결하고 전체 조회를 했더니 쿼리가 1번이 아니라 6번 나갔다. LAZY 로딩이 부른 N+1 문제를 fetch join 으로 잡고, @Transactional 의 원자성과 더티 체킹까지 정리한다."
pubDatetime: 2026-07-16T01:50:00Z
tags:
  - 백엔드공부
  - spring-boot
  - jpa
  - 트랜잭션
  - 학습
draft: false
featured: false
---

[Spring Boot #3 (JPA 로 PostgreSQL 연결)](/posts/spring-boot-log-03-jpa-postgresql-entity-repository) 에서 엔티티 하나를 DB 에 붙였다. 이번 #4 는 엔티티를 **둘로 늘려 연관관계로 묶고**, 그 과정에서 마주친 두 가지 — **트랜잭션**과 **N+1 문제** — 를 정리한다.

## Table of contents

## 트랜잭션 — 전부 되거나, 전부 안 되거나

먼저 트랜잭션. 한 문장으로 요약하면 **"전부 다 되거나, 전부 다 안 되거나"** 다. 중간까지만 반영되는 어정쩡한 상태가 없다. 여러 작업을 하나로 묶어서, 하나라도 실패하면 통째로 되돌린다(rollback).

## 두 테이블을 연결 — @ManyToOne · @JoinColumn

엔티티 사이에 **다대일(N:1)** 관계를 맺었다. 예를 들어 할일(Todo) 여러 개가 사용자(User) 한 명에 속하는 구조다.

```java
@Entity
public class Todo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;

    @ManyToOne(fetch = FetchType.LAZY)   // 다(Todo) : 일(User)
    @JoinColumn(name = "user_id")        // 외래키 컬럼 지정
    private User user;
}
```

- `@ManyToOne` — 이 엔티티(Todo)가 "다" 쪽이고 상대(User)가 "일" 쪽임을 표시
- `@JoinColumn` — 두 테이블을 잇는 **외래키** 컬럼을 지정

여기서 `fetch = FetchType.LAZY`, 즉 **지연 로딩**을 걸었다. Todo 를 조회할 때 연결된 User 를 곧바로 다 불러오지 않고, **실제로 `todo.getUser()` 를 건드리는 순간에야** User 를 조회하는 방식이다. 이게 뒤에서 N+1 의 씨앗이 된다.

## record 로 DTO 만들기 (from 정적 팩토리)

응답용 DTO 를 만들었는데, 여기서 하나 처음 봤다. **`public class` 가 아니라 `public record` 로도 DTO 가 된다.**

```java
public record TodoResponse(Long id, String title, String userName) {
    public static TodoResponse from(Todo todo) {
        return new TodoResponse(todo.getId(), todo.getTitle(), todo.getUser().getName());
    }
}
```

`from` 이라는 정적 팩토리 메서드로 엔티티 → DTO 변환을 담았다. ([#3](/posts/spring-boot-log-03-jpa-postgresql-entity-repository) 에서 JPA 엔티티는 값을 바꿔야 해서 record 가 안 맞는다고 했는데, DTO 는 반대다 — 한 번 만들고 안 바꾸는 불변 응답 객체라 record 가 딱 맞는다.)

그런데 저 `from` 안의 `todo.getUser().getName()` — LAZY 로 걸어둔 User 를 꺼내는 이 한 줄이, 반복문에서 돌 때 문제를 일으킨다.

## @Transactional — 기본 read-only, 쓰기에만 권한

Service 에 `@Transactional` 을 붙여 트랜잭션을 걸었다. 전략은 **클래스 기본은 읽기 전용(read-only), 쓰기가 필요한 메서드에만 따로 권한**을 주는 식이다.

```java
@Service
@Transactional(readOnly = true)      // 기본: 읽기 전용
public class TodoService {

    public List<TodoResponse> findAll() { ... }   // 읽기 → 기본값 그대로

    @Transactional                    // 이 메서드만 쓰기 허용
    public void updateTitle(Long id, String title) { ... }
}
```

읽기 전용을 기본으로 두면 실수로 쓰기가 새는 걸 막고, 성능 면에서도 이점이 있다. 쓰기가 필요한 곳에만 명시적으로 `@Transactional` 을 덧붙여 권한을 연다.

## 전체 조회를 했더니 쿼리가 6번 — N+1 문제

코드를 다 짜고 전체 조회를 돌렸다. 그런데 로그를 보니 **쿼리가 이상하게 많이 나갔다.**

Todo 5개를 가져오는 조회는 분명 SELECT 1번이면 된다. 그런데 그 뒤로 **SELECT 가 5번 더** 나갔다. 총 6번.

### N+1 이 뭐지?

이게 바로 **N+1 문제**다. 이름 그대로 쿼리가 **1 + N 번** 나가는 상황이다.

1. **1번** — Todo 목록을 가져오는 조회 (`SELECT * FROM todos`) → 5개 확보
2. **N번** — DTO 로 변환하면서 `todo.getUser().getName()` 을 호출할 때마다, LAZY 로 미뤄뒀던 User 를 지금 조회 (`SELECT * FROM users WHERE id = ?`) → 5개면 5번

즉 **LAZY 로딩** 때문이다. 연관 엔티티를 그때그때 따로 불러오다 보니, 목록 개수(N)만큼 추가 쿼리가 터진다. 데이터가 5개라 6번이지만, 100개면 101번이 된다. 목록이 커질수록 재앙이다.

## 해결 — fetch join (LEFT JOIN FETCH)

이런 경우엔 **fetch join** 으로 잡는다. 예제에서는 Repository 인터페이스 안에 `@Query` 로 직접 넣었다.

```java
public interface TodoRepository extends JpaRepository<Todo, Long> {

    @Query("SELECT t FROM Todo t LEFT JOIN FETCH t.user")
    List<Todo> findAllWithUser();
}
```

평범한 JOIN 인데 **`FETCH`** 가 붙었다. 이게 핵심이다. `JOIN FETCH` 는 Todo 를 가져올 때 **연관된 User 까지 한 방에 다 긁어모은다.** 그래서 나중에 `getUser()` 를 호출해도 추가 쿼리가 안 나간다 — 이미 다 들고 왔으니까. 6번이던 쿼리가 **1번**으로 준다.

## save 를 지웠는데 UPDATE 가 된다 — 더티 체킹

마지막으로 하나 더 신기한 걸 봤다. update 로직에서 원래 쓰던 `save()` 를 **지웠는데도** 수정이 잘 반영됐다.

```java
@Transactional
public void updateTitle(Long id, String title) {
    Todo todo = todoRepository.findById(id).orElseThrow();
    todo.setTitle(title);      // 값만 바꾼다. save() 안 함.
}
```

`save()` 를 부르지 않았는데 DB 에 UPDATE 가 나갔다. 알고 보니 **`@Transactional` 덕분**이었다. 트랜잭션 안에서 조회한 엔티티는 JPA 가 계속 감시하고 있다가, **값이 바뀐 걸 발견하면 트랜잭션이 끝날 때 알아서 UPDATE 쿼리를 날린다.** 이걸 **더티 체킹(dirty checking)** 이라고 한다.

## 회고

오늘의 한 줄 정리(TIL):

> LAZY 연관 엔티티를 반복문에서 꺼내면 N+1(1+N 번 쿼리)이 터진다. `LEFT JOIN FETCH` 로 한 번에 가져오면 쿼리 1번으로 준다. `@Transactional` 은 전부 성공 / 전부 취소를 보장하고, 그 안에서 조회한 엔티티는 더티 체킹으로 `save` 없이도 수정이 반영된다.

엔티티 하나일 땐 안 보이던 것들이, 둘을 관계로 묶자마자 쏟아졌다. 연관관계는 편한 만큼 뒤에서 조용히 쿼리를 늘리고 있었고, 트랜잭션은 편한 만큼 조용히 UPDATE 를 대신 날려주고 있었다. "편하다"의 뒷면을 같이 봐야 한다는 걸 배웠다.

## 더 공부해볼 것

- **fetch join 의 한계** — 컬렉션(일대다, `@OneToMany`)을 fetch join 하면 페이징이 깨지거나 중복 row 가 생긴다고 한다. 오늘은 다대일(단일 연관)이라 안 만났지만, 컬렉션일 때 어떻게 달라지는지. → [Hibernate: Fetching](https://docs.jboss.org/hibernate/orm/current/userguide/html_single/Hibernate_User_Guide.html#fetching)
- **`@EntityGraph` · `@BatchSize`** — fetch join 말고 N+1 을 푸는 다른 길. 각각 언제 쓰는 게 나은지 비교.
- **더티 체킹의 비용** — JPA 가 엔티티를 감시하려면 스냅샷을 들고 있어야 한다는데, 대량 업데이트에서 이게 부담이 되는지. 벌크 연산(`@Modifying @Query`)과의 차이.
- **`@Transactional(readOnly = true)` 가 실제로 뭘 최적화하나** — 그냥 쓰기 금지 플래그인지, 아니면 더티 체킹 스냅샷을 생략하는 등 성능 이점이 따로 있는지.
- **트랜잭션 전파(propagation) · 격리 수준(isolation)** — 트랜잭션 안에서 다른 트랜잭션 메서드를 호출하면 어떻게 되는지, 동시 접근 시 격리 수준별 차이. → [Spring: Transaction Management](https://docs.spring.io/spring-framework/reference/data-access/transaction.html)
