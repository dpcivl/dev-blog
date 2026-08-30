---
title: "프로그래머스 SQL #1 — SELECT · FROM · WHERE 는 순서가 있다"
description: "SQL 공부를 하려고 프로그래머스 문제를 풀기 시작했다. 첫 문제에서 절 순서를 지키지 않아 문법 에러를 만났고, AS · AVG · ROUND 를 하나씩 찾아가며 풀었다."
pubDatetime: 2026-08-30T03:30:00Z
tags:
  - 프로그래머스
  - sql
  - 학습
draft: false
featured: false
---

SQL 공부를 하려고 오늘부터 프로그래머스 문제를 풀기로 했다. 오늘이 첫날이다.

## 오늘 푼 문제

[평균 일일 대여 요금 구하기](https://school.programmers.co.kr/learn/courses/30/lessons/151136) — 결과는 성공.

제출한 답안은 이렇다.

```sql
SELECT ROUND(AVG(DAILY_FEE)) AS AVERAGE_FEE
FROM CAR_RENTAL_COMPANY_CAR
WHERE CAR_TYPE = 'SUV'
```

## 배운 것

**SELECT → FROM → WHERE 순서로 적어야 한다.** 이게 제일 컸다. 파편화된 지식으로 `WHERE` 를 쓰고 `FROM` 을 썼더니 문법 에러가 났다. 절을 아는 것과 순서를 아는 건 별개였다.

**`AS` 로 결과 이름을 정한다.** 평균값을 `AVERAGE_FEE` 라는 이름으로 출력해야 했는데 방법을 몰랐다. `AS` 를 쓰면 된다는 걸 배웠다.

**`AVG` 와 `ROUND`.** 평균을 구하는 `AVG` 가 있는 걸 발견하고 바로 평균은 냈다. 그런데 결과가 소수점으로 나와서 실패했고, `ROUND` 를 몰라서 찾아야 했다.

**`SELECT *` 말고 다르게 써봤다.** 그동안 전체 조회만 해봤는데 이번에 처음으로 필요한 값만 골라서 계산해봤다.

## 회고

문법 에러를 만난 게 오히려 도움이 됐다. `SELECT` 도 알고 `FROM` 도 알고 `WHERE` 도 알았는데, **알고 있는 조각을 아무렇게나 놓으면 안 된다**는 걸 에러가 알려줬다. 각각을 따로 외운 상태였다는 뜻이기도 하다.

한 문제를 푸는 데 `AS` · `AVG` · `ROUND` 세 개를 찾아봤다. 첫날치고는 괜찮은 것 같다.

> 이 순서 문제는 [SQL 절 순서 playground](/playground/sql-order/) 에서 직접 만져볼 수 있게 만들어뒀다. 절을 아무 순서로나 놓아 에러를 내보고, 같은 쿼리가 `FROM → WHERE → SELECT` 로 처리되는 과정을 한 단계씩 볼 수 있다.

## 더 공부해볼 것

- **테이블의 가로줄과 세로줄을 뭐라고 부르는가** — 세로 방향이 **열(column)**, 가로 방향이 **행(row)** 이고, 표 맨 윗줄에 있는 이름들이 **컬럼명**이다. 메모에 "컬럼이라고 해야 하나" 라고 적어뒀는데 그 이름을 가리킨 것이었다면 맞다. 예전에 [DB · 데이터 모델링 어휘](/posts/db-vocabulary-for-vibe-coding)에 정리해둔 게 있으니 한 번 더 볼 것
- **작성 순서와 실행 순서는 다르다** — 적을 때는 `SELECT → FROM → WHERE` 지만, 실제로 처리되는 순서는 `FROM → WHERE → SELECT` 라고 들었다. 이걸 알면 `SELECT` 에서 붙인 별칭을 `WHERE` 에서 못 쓰는 이유도 설명될 것 같다
- **`ROUND` 의 자릿수 인자** — 이번엔 인자 없이 써서 정수로 반올림했는데, 소수점 자리를 지정하는 방법과 `CEIL` · `FLOOR` 와의 차이
- **집계 함수가 NULL 을 어떻게 다루는가** — [데이터 엔지니어링 공부에서 합계가 NULL 을 빼고 계산되는 걸 확인했는데](/posts/de-study-01-dirty-data-and-staging), `AVG` 도 분모에서 빠지는지 확인해볼 것. 빠진다면 "전체 평균" 과 다른 값이 나온다
- **`GROUP BY`** — 이번엔 `WHERE` 로 SUV 만 걸러서 평균을 냈는데, 차종별 평균을 한 번에 내려면 무엇이 필요한지
