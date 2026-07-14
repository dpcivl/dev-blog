---
title: "PostgreSQL 기초 — CRUD와 한글 정렬(COLLATE) 함정"
description: "SQLite만 쓰다 PostgreSQL을 처음 잡았다. CREATE부터 CRUD 대응, 그리고 ORDER BY가 가나다 순으로 안 되던 collation 문제까지."
pubDatetime: 2026-07-14T13:00:00Z
tags:
  - postgresql
  - sql
  - 데이터베이스
  - 학습
featured: false
draft: false
---

오늘은 PostgreSQL과 SQL 기초를 배웠다. 이전까지는 WSL2 환경에서 했는데, 오늘 중고로 맥북을 하나 구해서 macOS에서 학습했다. SQLite는 종종 써봤지만 PostgreSQL은 처음이라 문법이 좀 어색했다.

## Table of contents

## 데이터베이스 만들고 접속하기

PostgreSQL을 설치하고 가장 먼저 한 건 `CREATE`였다. 데이터베이스를 만들고 `\c`로 접속한 다음, 그 안에 테이블을 만들었다.

```sql
CREATE TABLE todos (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    done BOOLEAN NOT NULL DEFAULT false
);
```

`\dt`로 테이블 목록을, `\d todos`로 스키마를 확인할 수 있다.

![CREATE TABLE 후 \dt와 \d todos로 스키마를 확인한 화면](/assets/posts/postgresql-sql-basics/01-create-table.png)

`BIGSERIAL`을 PRIMARY KEY로 잡으니 `\d todos`에서 초기값이 `nextval('todos_id_seq'::regclass)`로 잡혀 있는 게 보인다. SQLite의 `AUTOINCREMENT`에 해당하는 부분을, PostgreSQL은 내부적으로 시퀀스(sequence)로 처리한다는 걸 눈으로 확인할 수 있었다.

## CRUD와 SQL의 대응

자바에서 했던 CRUD가 오늘 배운 SQL과 그대로 대응된다는 게 눈에 들어왔다.

| SQL | 동작 | REST / 메서드 이름 |
| --- | --- | --- |
| `INSERT INTO` | 추가 | POST / create |
| `SELECT` | 읽기 | GET / findAll |
| `UPDATE ... SET` | 수정 | PUT / update |
| `DELETE FROM` | 삭제 | DELETE / delete |

그리고 이 명령들을 쓸 때 거의 항상 따라붙는 게 `WHERE`다. **어떤 대상을 지목해서 동작을 수행할지** 정하는 절이라, 수정·삭제·조회 어디에나 붙는다. 활용도가 제일 높았다.

## 정작 중요한 건 SQL이 아니라 데이터 구조 설계

여기까지 해보면서 든 생각. 데이터베이스 쪽은 이런 SQL 문법을 외우는 것보다 **데이터 구조를 그릴 수 있는 능력**이 훨씬 중요하겠다 싶었다.

어떤 데이터 구조로 저장할지 설계가 되면, 그걸 SQL로 구현하는 건 요즘 시대엔 AI로도 금방 나온다. 하지만 요구사항에 맞게 기본키·외래키 같은 제약을 다 지키면서 구조를 설계하는 건 결국 사람이 판단해야 하는 영역이다.

## 흥미로운 발견 — ORDER BY가 가나다 순이 아니었다

한 가지 재밌는 걸 만났다. `ORDER BY title ASC`로 제목을 가나다 순 정렬하려 했는데, **가나다 순으로 정렬되지 않았다.**

![ORDER BY title ASC 결과가 가나다 순이 아닌 화면 — 청소하기, 밥 먹기, 스프링 공부, 책 읽기 순](/assets/posts/postgresql-sql-basics/02-order-by-wrong.png)

"청소하기 → 밥 먹기 → 스프링 공부 → 책 읽기" 순으로 나왔는데, 가나다 순(밥 → 스프링 → 청소 → 책)이 전혀 아니다.

원인을 찾으려고 데이터베이스의 정렬 규칙(collation)을 확인했다.

```sql
SELECT datcollate FROM pg_database WHERE datname = 'study';
```

결과는 `en_US.UTF-8`이었다. 즉 이 데이터베이스는 영어(미국) 기준으로 정렬하고 있었던 것. 한글을 한국어 규칙이 아니라 유니코드 코드포인트 순 비슷하게 늘어놓다 보니 뒤죽박죽으로 보였다.

그래서 시스템에 설치된 한국어 정렬 규칙을 찾아봤다.

```sql
SELECT collname FROM pg_collation WHERE collname LIKE 'ko%';
```

13가지가 나왔고, 그중 `ko-KR-x-icu`를 골랐다. (ICU 라이브러리가 제공하는 한국어 로케일이다.) 이걸 `COLLATE`로 명시해서 정렬하니 원하는 대로 됐다.

```sql
SELECT * FROM todos ORDER BY title COLLATE "ko-KR-x-icu" ASC;
```

정렬 규칙은 이렇게 쿼리 단위로 `COLLATE`를 붙여 그때그때 지정할 수도 있고, 컬럼이나 데이터베이스 생성 시점에 아예 박아둘 수도 있다. 이번엔 쿼리에서 한 번만 바꿔봤다.

## 회고

SQL 명령어 자체는 (SQLite 경험 덕분에) 익숙했다. 그런데도 오늘 두 번이나 같은 결론에 도달했다 — **문법보다 데이터베이스 구조를 어떻게 짜는지가 진짜 공부할 부분**이라는 것. collation 문제도 결국 "이 데이터를 어떤 규칙으로 다룰 것인가"라는 설계 판단의 일부였다.

## 더 공부해볼 것

- **collation을 쿼리마다 붙이지 않는 법** — 매번 `COLLATE "ko-KR-x-icu"`를 쓰는 건 번거롭다. 컬럼 정의(`title VARCHAR(255) COLLATE "ko-KR-x-icu"`)나 데이터베이스 생성 시(`CREATE DATABASE ... LC_COLLATE`)에 기본 정렬 규칙을 지정하는 방법을 비교해보기. → [PostgreSQL: Collation Support](https://www.postgresql.org/docs/current/collation.html)
- **`ko-KR-x-icu`의 정체** — `x-icu` 접미사가 붙은 collation과 libc 기반 collation(`en_US.UTF-8` 같은)의 차이. ICU가 왜 필요한지. → [PostgreSQL: ICU Collations](https://www.postgresql.org/docs/current/collation.html#ICU-COLLATIONS)
- **`BIGSERIAL` vs `IDENTITY`** — `\d todos`에서 본 `nextval(...::regclass)` 시퀀스 방식. 최신 PostgreSQL에서 권장되는 `GENERATED ALWAYS AS IDENTITY`와 뭐가 다른지. → [PostgreSQL: Identity Columns](https://www.postgresql.org/docs/current/ddl-identity-columns.html)
- **데이터 구조 설계 연습** — 기본키/외래키/정규화. todos 하나를 넘어서 여러 테이블을 관계로 묶는 실습(예: 사용자–할일 관계)으로 넘어가 보기.
- **인덱스** — `\d todos`에 이미 `todos_pkey`가 btree 인덱스로 잡혀 있었다. WHERE·ORDER BY 성능과 인덱스가 어떻게 연결되는지.
