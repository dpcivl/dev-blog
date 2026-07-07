---
title: "자바 공부 W2 — 컬렉션 (List / Map / Set) · Stream 파이프라인 · Optional 로 null 안전 처리"
description: "자바 공부 2주차. Collection Framework 핵심 — List (ArrayList), Map (HashMap), Set 을 훑고, 각각 '인터페이스와 구현체' 패턴이 보임 (List<String> books = new ArrayList<>()). 이후 Stream 으로 넘어가 for 문 없이 filter → map → collect 파이프라인, method reference (System.out::println), groupingBy + counting 조합. 마지막은 Optional — get() 즉시 호출 대신 ifPresent / orElse / map 으로 값 없을 때를 항상 함께 처리해야 하는 감각."
pubDatetime: 2026-07-06T05:00:00Z
tags:
  - 백엔드공부
  - java
  - collection
  - stream
  - oop
  - 학습
draft: false
featured: false
---

[자바 공부 W1](/posts/java-study-w1-first-syntax-and-oop-basics) 에 이어 W2. 오늘은 **컬렉션 · Stream · Optional** — 자바 백엔드에서 매일 만지는 3종.

## Table of contents

## List — 인터페이스와 구현체가 분리된 패턴

코드: [`ListDemo.java`](https://github.com/dpcivl/be-study/blob/main/week2-collections/ListDemo.java)

**List** = 크기가 정해지지 않은 리스트. `.add()` 로 늘리고 `.remove()` 로 줄인다.

`<String>`, `<Integer>` 처럼 리스트 안에 뭐가 들어가야 하는지 명시할 수 있는데 — **C++ 의 제네릭 프로그래밍** 배울 때 봤던 것과 같은 결.

```java
List<String> books = new ArrayList<>();
```

이 표현을 뜯어보면:

- **`List` 는 인터페이스** — 뭘 해야 하는지 규격만
- **`ArrayList` 는 구현체** — 어떻게 할지 실제 코드

바로 [W1 에서 배운 인터페이스 개념](/posts/java-study-w1-first-syntax-and-oop-basics#인터페이스--규격만-정하고-구현은-상속받는-쪽) 이 적용된다. 오른쪽 `ArrayList<>` 에서 `String` 을 굳이 안 써도 되는 이유 — 왼쪽에서 정했으니까 자동으로 타입 추론.

## Map — 딕셔너리 감각

코드: [`MapDemo.java`](https://github.com/dpcivl/be-study/blob/main/week2-collections/MapDemo.java)

```java
Map<String, Integer> scores = new HashMap<>();
```

Map 도 **인터페이스(Map) / 구현체(HashMap)** 분리 패턴. 파이썬 딕셔너리처럼 사용:

- `put(key, value)` 로 넣기
- `get(key)` 로 꺼내기

### 순회 — `entrySet()` 로 키·값 함께

```java
for (Map.Entry<String, Integer> entry : scores.entrySet()) {
    System.out.println(entry.getKey() + ": " + entry.getValue());
}
```

**`.entrySet()`** 이라는 걸로 엔트리 집합을 만들어서 각 엔트리마다 `getKey()` / `getValue()` 로 순회. 파이썬의 `for k, v in d.items():` 랑 비슷한 그림인데 자바는 좀 더 명시적.

## Set — 중복 없음이 유일한 차이

코드: [`SetDemo.java`](https://github.com/dpcivl/be-study/blob/main/week2-collections/SetDemo.java)

List 대신 Set 을 쓰면 **중복을 허용하지 않음**. 그 외 사용법은 List 와 거의 동일. 언제 어느 쪽을 쓰는지는 데이터 특성에 달렸음 — 순서·중복 필요하면 List, "고유값 집합" 이면 Set.

## Stream — for 없이 파이프라인으로

코드: [`StreamDemo.java`](https://github.com/dpcivl/be-study/blob/main/week2-collections/StreamDemo.java)

여기부터가 자바 8+ 의 재미있는 부분. **Stream** 을 쓰면 for 문으로 처리하던 복잡한 작업을 **파이프라인 식으로** 만들 수 있다:

```java
List.of(1, 2, 3, 4, 5)
    .stream()
    .filter(n -> n % 2 == 0)      // 짝수만
    .map(n -> n * n)              // 제곱
    .forEach(System.out::println); // 4, 16
```

**filter → map → forEach** — 각 단계가 한 줄로 표현되니 **뭘 하는지 한눈에 읽힘**. 파이썬의 list comprehension / functools.reduce 조합과 비슷한 결이지만, 파이프라인이 명시적이라 더 선언적.

### Method reference — `System.out::println`

```java
.forEach(System.out::println);
```

`System.out::println` — **메서드 참조**. Stream 마지막에서 받은 걸 println 에 넘길 때 사용. `n -> System.out.println(n)` 을 짧게 쓴 것.

### `List.of` 는 읽기 전용

```java
List<Integer> nums = List.of(1, 2, 3);
nums.add(4);  // ❌ UnsupportedOperationException
```

**예제 때 자주 쓰는 `List.of` 는 immutable list** — 나중에 수정 불가능. 수정 가능한 리스트가 필요하면 `new ArrayList<>(List.of(1, 2, 3))` 처럼 감싸야 함. 이건 실수 유발 지점.

## `groupingBy` + `counting` — 묶고 세기

코드: [`GroupDemo.java`](https://github.com/dpcivl/be-study/blob/main/week2-collections/GroupDemo.java)

**`groupingBy`** — 무엇을 기준으로 묶을지 정하는 것. 기존 List 를 기준에 맞춰 컬렉션(Map) 으로 변환.

```java
Map<String, Long> countByCategory = books.stream()
    .collect(Collectors.groupingBy(Book::getCategory, Collectors.counting()));
// {소설=3, 기술=5, 에세이=2}
```

`groupingBy` 와 `counting` 을 같이 쓰면 **카테고리별 개수** 를 한 번에 얻을 수 있음. SQL 의 `GROUP BY category, COUNT(*)` 랑 정확히 같은 그림.

## Optional — null 안전 처리

코드: [`OptionalDemo.java`](https://github.com/dpcivl/be-study/blob/main/week2-collections/OptionalDemo.java)

**Optional** = "값이 있을 수도 없을 수도 있음" 을 명시하는 컨테이너. Java 8+ 에 도입된 null 안전 도구.

신기한 지점 — **인스턴스 내부에 `isPresent` 라는 값이 있는 것처럼 보임**. 실제로는 메서드지만 감각적으로 그렇게 느껴짐.

```java
Optional<User> user = findUser("alice");
if (user.isPresent()) {
    System.out.println(user.get().getName());
}
```

### 안 좋은 습관 — 바로 `get()`

```java
user.get().getName();  // ❌ 값이 없으면 NoSuchElementException
```

**값이 있다고 무조건 `get()` 호출하는 게 아님.** `ifPresent` / `orElse` / `map` 으로 **값 없을 때를 항상 함께 처리** 해야 함:

```java
// 있으면 실행, 없으면 무시
user.ifPresent(u -> System.out.println(u.getName()));

// 없으면 기본값
String name = user.map(User::getName).orElse("Anonymous");

// 있으면 변환해서 새 Optional
Optional<String> upperName = user.map(u -> u.getName().toUpperCase());
```

**"있으면 A, 없으면 B" 를 한 줄로 표현하는 감각** — 파이썬의 `x if x else default` 같은 것과 결이 비슷하지만 자바는 Optional 이라는 별개 타입으로 강제.

## 회고

W2 에서 얻은 것 3가지:

1. **인터페이스/구현체 분리 패턴이 컬렉션 전반에 반복** — `List / ArrayList`, `Map / HashMap`, `Set / HashSet`. W1 에서 배운 개념이 실전에서 계속 재활용됨.
2. **Stream 은 SQL 같은 감각** — filter/map/collect 를 조합하면 for 문 없이도 데이터 변형이 선언적으로 표현됨. `groupingBy` 는 SQL `GROUP BY` 그대로.
3. **Optional 은 "없음을 명시하는 감각"** — 값이 없을 수 있다는 걸 타입으로 강제. Python 의 None 처리보다 훨씬 엄격해서 실수 여지가 적음.

## 더 공부해볼 것

### 1. 예외 처리 — 자바 특유의 checked exception

- `try / catch / finally` 기본
- **Checked vs Unchecked exception** — 자바만의 개념
- `throws` 선언 — 메서드 시그니처 레벨의 예외 명시
- Python / JS 에는 없는 것이라 처음엔 어색할 듯

### 2. 동시성 기초

- `Thread` / `Runnable` / `ExecutorService`
- `synchronized` 키워드 · volatile
- Java Memory Model 기초
- 자바 백엔드 실무에서 반드시 만나는 지점

### 3. 함수형 인터페이스 심화

- `Function<T, R>` / `Predicate<T>` / `Consumer<T>` / `Supplier<T>`
- Stream API 가 내부적으로 이걸 어떻게 활용하는가
- 커스텀 함수형 인터페이스 (`@FunctionalInterface`) 만들기

### 4. Collection 성능 특성

- `ArrayList` vs `LinkedList` — 언제 어느 쪽?
- `HashMap` vs `TreeMap` vs `LinkedHashMap` — 순서 · 성능 · 정렬
- Big O 관점에서 선택하는 감각

### 5. 빌드 도구 (Maven / Gradle)

- 지금은 단일 파일로 학습 중이지만 실무는 프로젝트 단위
- **Maven vs Gradle** — 표준적으로 어느 쪽?
- 실무 프로젝트 폴더 구조 (`src/main/java`, `src/test/java`)

### 6. Spring Boot 로 이어지기

- 문법이 익숙해진 후 프레임워크로
- **의존성 주입 (DI)** — Spring 의 핵심
- `@Component` / `@Service` / `@Repository` / `@RestController`
- REST API 만들어서 실제 백엔드 감각 익히기
