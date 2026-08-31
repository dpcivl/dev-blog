---
title: "프로그래머스 SQL #2 — 정렬은 sort 가 아니라 ORDER BY 였다"
description: "두 번째 문제는 쉽게 풀렸다. 정렬을 떠올렸을 때 머릿속에 sort 가 먼저 나왔는데 SQL 에서는 ORDER BY 다. 개념으로만 알던 다중 정렬 조건도 처음 써봤다."
pubDatetime: 2026-08-31T11:30:00Z
tags:
  - 프로그래머스
  - sql
  - 학습
draft: false
featured: false
---

프로그래머스 SQL 두 번째 문제다.

## 오늘 푼 문제

[인기있는 아이스크림](https://school.programmers.co.kr/learn/courses/30/lessons/133024) — 결과는 성공.

`FIRST_HALF` 테이블에서 아이스크림 맛(`FLAVOR`)을 총주문량(`TOTAL_ORDER`) 내림차순으로, 총주문량이 같으면 출하번호(`SHIPMENT_ID`) 오름차순으로 정렬해 출력하는 문제다.

제출한 답안은 이렇다.

```sql
SELECT FLAVOR
FROM FIRST_HALF
ORDER BY TOTAL_ORDER DESC, SHIPMENT_ID ASC
```

## 배운 것

**정렬은 `sort` 가 아니라 `ORDER BY` 다.** 정렬해야 한다는 걸 알았을 때 머릿속에 먼저 떠오른 단어는 `sort` 였다. 프로그래밍 언어에서 쓰던 이름이 먼저 나온 것이다. SQL 에서는 `ORDER BY` 이고, 다행히 그건 잘 떠올렸다.

**정렬 조건은 여러 개를 쉼표로 이어 붙인다.** 같은 값일 때 다른 기준으로 한 번 더 정렬한다는 걸 개념으로만 알고 있었는데, 이번에 바로 쓸 수 있었다. 앞에 적은 조건이 우선이고, 그 값이 같을 때만 뒤 조건이 쓰인다.

`DESC` 와 `ASC` 를 조건마다 따로 붙일 수 있다는 것도 이번에 확인했다. 하나는 내림차순, 하나는 오름차순으로 섞어서 지정된다.

예를 들어 총주문량이 같은 행이 있으면 이렇게 갈린다.

| SHIPMENT_ID | FLAVOR | TOTAL_ORDER |
| --- | --- | --- |
| 3 | 초코 | 100 |
| 1 | 딸기 | 100 |
| 5 | 바닐라 | 80 |

`TOTAL_ORDER DESC` 만 있으면 초코와 딸기 중 뭐가 먼저 나올지 정해지지 않는다. `SHIPMENT_ID ASC` 를 뒤에 붙여서 딸기(1) → 초코(3) 순으로 확정한다. 두 번째 조건은 순서를 예쁘게 만드는 게 아니라 **순서를 결정되게 만드는** 역할이었다.

## 회고

이번 문제는 쉽게 풀려서 더 회고할 게 없다. [첫 문제](/posts/programmers-sql-01-select-from-where-order)에서는 절 순서를 몰라 문법 에러를 만났는데, 이번엔 막힌 데 없이 한 번에 통과했다.

굳이 하나 꼽자면 **아는 개념과 쓸 수 있는 개념이 다르다**는 걸 반대 방향으로 확인한 셈이다. 다중 정렬은 개념으로만 알고 있었는데 이번엔 바로 손이 나갔다.

## 더 공부해볼 것

- **`ORDER BY` 는 언제 실행되는가** — [첫 글에서 작성 순서와 실행 순서가 다르다는 걸 숙제로 남겼는데](/posts/programmers-sql-01-select-from-where-order), `ORDER BY` 가 그 순서의 어디에 들어가는지 확인해볼 것. `SELECT` 에서 `AS` 로 붙인 별칭을 `ORDER BY` 에서 쓸 수 있는지도 같이 보면 답이 나올 것 같다
- **정렬 조건이 같은 행의 순서** — 위 예시에서 두 번째 조건을 안 붙이면 순서가 "정해지지 않는다" 고 적었는데, 실제로 DB 가 어떤 순서를 주는지 · 매번 같은 순서가 보장되는지 확인 필요 ([MySQL ORDER BY 최적화](https://dev.mysql.com/doc/refman/8.0/en/order-by-optimization.html))
- **`NULL` 이 섞이면 어디로 가는가** — 정렬 대상 컬럼에 `NULL` 이 있으면 맨 앞인지 맨 뒤인지, DB 마다 다른지
- **`LIMIT` 과 같이 쓰기** — "상위 몇 개만" 같은 문제는 정렬 다음에 개수를 자르는 게 필요할 텐데, 그 문법
- **`ORDER BY` 에 컬럼 번호를 쓰는 방식** — `ORDER BY 1, 2` 처럼 순서 번호로도 쓸 수 있다고 들었다. 되는지, 권장되는지
