---
title: "자바 공부 #1 — 자바 첫 실행 · 문법 훑기 · OOP 기본 (클래스 · 캡슐화 · 상속 · 인터페이스)"
description: "부족한 백엔드 · 상용화 경험을 채우기 위해 자바 학습 시작. 자바 설치부터 시작해서 switch 의 -> 화살표 문법 · for-each · 정수 나눗셈에서 double 캐스팅 필요성 · public class 파일 규칙 · private + getter 로 캡슐화 · static 유무의 차이 · @Override 어노테이션 · implements 로 인터페이스 연동까지 하루에 훑음. Python / C++ 경험이 있어 개념적으로는 익숙한 부분이 많았음."
pubDatetime: 2026-07-03T08:30:00Z
tags:
  - 백엔드공부
  - java
  - backend
  - oop
  - 학습
draft: false
featured: false
---

오늘부터 **나의 부족한 부분인 백엔드 쪽 개념과 상용화 경험을 위한 공부** 도 병행한다. [Eval 공부 #2 의 회고](/posts/eval-study-log-02-similarity-and-testset-design#더-공부해볼-것) 에서 잠깐 짚었던 "WAS 이해" 흐름의 시작.

일단 **자바가 안 깔려있어서** 자바부터 깔고, 쉬운 것들을 따라치면서 문법을 체험한 첫 회차.

## Table of contents

## 문법 훑기 — 익숙한 것과 신기한 것

### switch — 화살표 방식

기존에 알던 switch 는 `case ... : break;` 구조. Java 14+ 부터는 **화살표 문법** 을 쓸 수 있다:

```java
String result = switch (day) {
    case "MON", "TUE" -> "weekday start";
    case "SAT", "SUN" -> "weekend";
    default -> "midweek";
};
```

**break 없어도 case fall-through 없음**. 훨씬 깔끔.

### for-each

Python 의 `for x in list:` 랑 똑같은 감각으로 쓸 수 있는 문법:

```java
int[] nums = {1, 2, 3};
for (int num : nums) {
    System.out.println(num);
}
```

`for (int num : nums)` — 콜론 좌우로 요소 타입 + 이터러블. Python 이나 C++ 의 range-based for 랑 같은 결.

### 정수 나눗셈 — double 캐스팅

Python 에선 그냥 되던 게 자바에선 명시적:

```java
int a = 10, b = 3;
double result = (double) a / b;  // 3.333...
// double result = a / b;         // → 3.0 (정수 나눗셈 후 double 로 승격)
```

**정수 / 정수** 는 무조건 정수 나눗셈. 소숫점을 살리려면 **먼저 double 로 캐스팅**. 그리고 반환값 받는 변수 타입도 double 이어야 오류가 안 남. 파이썬만 하다가 오면 이런 게 잔실수 유발 지점.

## 클래스와 객체 — Python / C++ 경험이 그대로 이어짐

Python 의 `__init__` 생성자, 메서드 개념은 그대로 이어짐. C++ 도 객체지향 언어라고 하지만 **Java 는 객체지향 언어 그 자체** 라, 문법이 더 강제된다는 느낌. 재밌겠다는 예감.

### `public class` 파일 규칙

- **`public class` 는 파일 이름과 같은 것 하나만** 가능
- **`public` 안 붙은 클래스는 같은 파일에 여러 개** 둘 수 있음
- 다만 **실무에선 보통 클래스마다 파일 분리** — 관리 편의

## 캡슐화 — `private` + getter

클래스 안 값 보호를 위해 **`private`** 사용. 밖에서 직접 조정 못 하고, **메서드로만** 고침. 이걸 **캡슐화** 라고 부름.

```java
public class User {
    private String name;    // 밖에서 직접 접근 불가

    public String getName() {  // getter
        return name;
    }

    public void setName(String name) {  // setter
        this.name = name;
    }
}
```

**getter** = 클래스 안 변수를 **읽기만** 하게 해주는 메서드.

## `static` — 있고 없고의 차이

- **`static` 붙음** — 객체를 안 만들고도 부를 수 있음 (`ClassName.method()`)
- **`static` 없음** — 반드시 객체 통해서 부름 (`obj.method()`)

Python 의 `@classmethod` / `@staticmethod` 랑 결이 비슷.

## 상속과 다형성 — `@Override`

상속할 때 부모 메서드를 재정의하면 **어노테이션 `@Override`** 를 붙이는 게 새로웠다:

```java
class Animal {
    void speak() { System.out.println("..."); }
}

class Dog extends Animal {
    @Override
    void speak() { System.out.println("멍멍"); }
}
```

`@Override` 는 컴파일러에게 "이건 재정의야" 라고 알려주는 것 — 부모에 없는 메서드 이름으로 실수하면 컴파일 에러. Python 처럼 몰래 새 메서드가 생기는 실수를 원천 차단.

## 인터페이스 — 규격만 정하고 구현은 상속받는 쪽

인터페이스는 **뭘 해야 하는지 규격만** 정하고, **어떻게 할지는** 인터페이스를 상속받은 클래스에서 정의:

```java
interface Flyable {
    void fly();  // 몸통 없이 시그니처만
}

class Bird implements Flyable {
    @Override
    public void fly() {
        System.out.println("날개짓");
    }
}
```

**`extends` 가 아니라 `implements`** 를 사용해서 연동. Python 의 abstract class + `@abstractmethod` 랑 목적은 비슷하지만 자바는 인터페이스라는 별개 개념으로 분리.

## 회고

오늘은 기본 문법 훑기라 내용이 짧다. 얻은 것 3가지:

1. **자바는 파이썬보다 명시적** — 나눗셈 형변환, 캡슐화, 오버라이드 어노테이션 다 명시가 필요. 그만큼 컴파일러가 실수 잡아줌.
2. **OOP 개념은 Python / C++ 에서 배운 게 대부분 이어짐** — 새 언어 하나 배우는 게 아니라 **하나의 언어로 OOP 를 강제 실습** 하는 느낌.
3. **백엔드로 넘어가려면 자바 감각이 필요** — 실무 SI · 대기업 백엔드는 여전히 자바 중심. 학습 곡선 초반이 은근 얕아서 다행.

## 더 공부해볼 것

### 1. 컬렉션 (Collection Framework)

- `List` / `Set` / `Map` 계열 — Python 의 list / set / dict 대응
- `ArrayList` vs `LinkedList` — 언제 어느 쪽?
- `HashMap` vs `TreeMap` — 순서 vs 성능

### 2. 제네릭 (Generics)

- 타입 안정성을 위한 파라미터화된 타입 — `List<String>`, `Map<K,V>`
- 와일드카드 `<? extends T>` / `<? super T>` — 공변·반공변
- Python 의 타입 힌트나 TypeScript 의 제네릭이랑 개념 비교

### 3. 예외 처리 (`try / catch / finally`)

- **Checked exception vs Unchecked exception** — 자바 특유 개념
- `throws` 선언 — 메서드 시그니처 레벨의 예외 명시
- Python 이나 JS 에는 없는 개념이라 처음엔 어색할 듯

### 4. 스레드와 동시성

- `Thread` / `Runnable` / `ExecutorService`
- `synchronized` 키워드, volatile
- Java Memory Model 기초 — 자바 백엔드 실무의 필수 지점

### 5. 빌드 도구 & 프로젝트 구조

- **Maven vs Gradle** — 표준적으로 어느 쪽?
- `pom.xml` / `build.gradle` 감각
- 실무의 자바 프로젝트 폴더 구조 (`src/main/java`, `src/test/java`)

### 6. Spring Boot 로 이어지기

- 자바 문법이 익숙해진 후 프레임워크로
- 의존성 주입 (DI), IoC, `@Component` / `@Service` / `@Repository`
- REST API 만들기 (`@RestController`)
- 실제 백엔드 상용 서비스는 결국 여기서 출발
