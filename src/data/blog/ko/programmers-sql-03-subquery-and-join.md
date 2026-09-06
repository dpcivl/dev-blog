---
title: "프로그래머스 SQL #3 — 테이블이 두 개면 FROM 을 두 번 쓰는 게 아니었다"
description: "테이블이 두 개 나오는 문제를 처음 만났다. FROM 을 두 번 써봤다가 안 됐고, IN 으로 서브쿼리를 걸어 풀었다. JOIN 으로도 같은 답이 나온다."
pubDatetime: 2026-09-06T06:30:00Z
tags:
  - 프로그래머스
  - sql
  - 학습
draft: false
featured: false
---

프로그래머스 SQL 고득점 Kit 의 SELECT 세 번째 문제다.

RAG 쪽 일을 하게 될 것 같아서 SQL 은 이제 필요 없나 했는데, RAG 에서도 데이터 전처리와 정제가 필요하다고 한다. 그래서 계속 공부하기로 했다.

## 오늘 푼 문제

[과일로 만든 아이스크림 고르기](https://school.programmers.co.kr/learn/courses/30/lessons/133025) — 결과는 성공.

상반기 총주문량이 3000보다 높으면서 아이스크림의 주 성분이 과일인 맛을 총주문량 내림차순으로 출력하는 문제다. 정보가 `FIRST_HALF` 와 `ICECREAM_INFO` 두 테이블에 나뉘어 있다.

제출한 답안은 이렇다.

```sql
SELECT FLAVOR
FROM FIRST_HALF
WHERE TOTAL_ORDER > 3000
AND FLAVOR IN (SELECT FLAVOR FROM ICECREAM_INFO
              WHERE INGREDIENT_TYPE = "fruit_based")
ORDER BY TOTAL_ORDER DESC
```

## 막힌 곳

**테이블 두 개가 나오는 문제를 처음 만났다.** 1번, 2번 문제는 테이블이 하나뿐이었고 조건도 단순해서 여기저기서 주워들은 걸로 풀 수 있었다. 그런데 이번에는 테이블이 두 개고 문제에 "기본 키" 라는 용어까지 나왔다. 기본 키를 어떻게 처리하는지를 몰라서 두 테이블을 어떻게 연결할 수 있을까 한참 고민했다.

## 배운 것

### `FROM` 은 한 쿼리에 하나만 쓴다

처음에 안 되는 걸 알면서도 `FROM` 을 두 개 써서 실행해봤다. 당연히 안 됐다. 테이블이 두 개인 문제니까 `FROM` 도 두 번 써야 할 것 같았는데 무작정 쓰는 건 답이 아니었다.

다만 정확히 말하면 **`FROM` 절이 하나인 것이지 테이블이 하나인 건 아니다.** 한 `FROM` 뒤에 테이블을 쉼표로 나열하는 것은 된다.

```sql
FROM FIRST_HALF, ICECREAM_INFO   -- 문법상 가능
FROM FIRST_HALF
FROM ICECREAM_INFO               -- 이건 안 된다
```

내가 막힌 건 두 번째 쪽이었다. 첫 번째 형태는 아래 `JOIN` 과 이어지는 이야기라 따로 정리해둔다.

### `AND` 로 조건을 하나 더 건다

조건을 하나 더 쓰려면 `AND` 가 필요했다. `WHERE` 절에 `AND` 를 붙여서 조건 두 개를 함께 보게 했다.

### `IN` 을 쓰면 서브쿼리를 걸 수 있다

메인 쿼리가 아니라 다른 테이블의 조건을 가져올 때 `IN` 을 쓴다. 서브쿼리의 결과 안에 있는 값만 남기는 방식이다. 내가 제출한 답이 이 방법이다.

다만 **테이블이 두 개라고 무작정 서브쿼리를 쓸 필요는 없다.**

### `JOIN` 을 처음 써봤다

`JOIN` 은 데이터 분석 교육을 들을 때도 여기저기서 들었던 이름이다. 두 테이블의 값을 함께 출력하거나, 같은 기준(키)으로 나란히 붙여서 보는 게 자연스러울 때 쓴다고 한다.

`JOIN` 으로 답을 냈다면 이렇게 쓸 수 있다.

```sql
SELECT F.FLAVOR
FROM FIRST_HALF F
JOIN ICECREAM_INFO I ON F.FLAVOR = I.FLAVOR
WHERE F.TOTAL_ORDER > 3000
  AND I.INGREDIENT_TYPE = 'fruit_based'
ORDER BY F.TOTAL_ORDER DESC;
```

`FIRST_HALF` 의 별칭을 `F` 로, `ICECREAM_INFO` 의 별칭을 `I` 로 둔다. `JOIN` 뒤에 오는 `ON` 에서 `F` 의 `FLAVOR` 와 `I` 의 `FLAVOR` 가 같다고 명시함으로써, 두 테이블을 어떤 기준으로 짝지을지 알려준다.

문제에 나온 "기본 키" 가 여기서 쓰이는 것이었다. 두 테이블에 같은 이름의 컬럼이 있다는 게 힌트였는데, 그때는 그게 연결 고리라는 걸 몰랐다.

## 회고

`FROM` 을 두 번 써본 게 헛짓은 아니었다. 안 되는 걸 확인하고 나서야 "그럼 두 테이블은 어디서 만나는가" 라는 질문으로 넘어갔다.

한 문제를 두 가지 방법으로 풀 수 있다는 것도 처음 봤다. 서브쿼리로도 되고 `JOIN` 으로도 된다. 지금은 어느 쪽이 나은지 판단할 기준이 없어서, 일단 둘 다 써봤다는 정도로 남겨둔다.

## 더 공부해볼 것

- **`IN` 서브쿼리와 `JOIN` 중 언제 무엇을 쓰는가** — 같은 답이 나오는데 고르는 기준이 있을 것이다. 결과가 갈리는 경우가 있는지도 궁금하다. 특히 서브쿼리 쪽에 중복 값이 있을 때 `JOIN` 은 행이 늘어난다고 들었다 → [MySQL: Optimizing Subqueries](https://dev.mysql.com/doc/refman/8.0/en/subquery-optimization.html)
- **`FROM A, B` 와 `JOIN` 의 관계** — 쉼표로 나열하는 방식이 예전 문법이고 `JOIN` 이 그걸 대체했다고 하는데, 정확히 무엇이 같고 무엇이 다른지 → [MySQL: JOIN Clause](https://dev.mysql.com/doc/refman/8.0/en/join.html)
- **문자열에 쌍따옴표를 써도 되는가** — 제출한 답에는 `"fruit_based"`, `JOIN` 예시에는 `'fruit_based'` 를 썼다. 둘 다 통과했는데 표준 SQL 은 작은따옴표라고 한다. DB 마다 다른지 확인 필요
- **기본 키가 정확히 무엇인가** — 문제에 나온 용어인데 "각 행을 구별하는 값" 정도로만 알고 넘어갔다. 외래 키와의 관계까지 같이 보면 `JOIN` 이 더 잘 이해될 것 같다
- **`JOIN` 의 종류** — `INNER`, `LEFT`, `RIGHT` 가 있다고 들었다. 이번에 쓴 `JOIN` 이 그중 무엇인지부터 확인할 것
