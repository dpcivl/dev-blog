---
title: "바이브코딩을 위한 DB · 데이터 모델링 어휘 — 정규화부터 마이그레이션까지"
description: "UI 어휘 정리에 이은 용어 시리즈 2탄. 'DB 좀 짜줘' 라는 막연한 지시를 벗어나기 위한 6가지 핵심 어휘 — 정규화, 관계, 인덱스, 트랜잭션, 격리 수준, 마이그레이션 — 을 한 줄기로 엮어 정리. 핵심 개념은 playground에서 직접 만져볼 수 있게 따로 만들어뒀다."
pubDatetime: 2026-06-16T12:30:00Z
tags:
  - DB
  - 바이브코딩
  - 용어정리
  - 데이터모델링
  - 학습
draft: false
featured: true
---

[UI 어휘 정리](./ui-vocabulary-for-vibe-coding) 에 이어지는 **용어 정리 시리즈 2탄**. DB에 대해 잘 모르면 AI에게 "DB 좀 짜줘" 라는 막연한 지시를 하게 되고, AI가 짠 코드를 이해도 못 한다. **AI에게 코딩을 맡기더라도 명확하게 업무를 맡길 수 있을 정도**의 어휘를 정리하는 게 이번 글의 목적.

> 📍 핵심 개념(정규화 / 관계 / 인덱스 / 트랜잭션 / 격리 수준 / 마이그레이션) 은 글 끝의 [playground](/playground/db-terms/) 에서 직접 만져볼 수 있게 따로 만들어뒀다.

## Table of contents

## 6개 어휘는 한 줄기로 엮인다

따로따로 외우면 안 된다. 흐름이 있다.

| 묶음 | 어휘 | 질문 |
|---|---|---|
| **데이터를 어떻게 쪼개고 연결하나** | 정규화 · 관계 | 사실(fact)을 어떻게 나눠 저장할까? |
| **그걸 빠르게 읽나** | 인덱스 | 어떻게 빨리 찾을까? |
| **여러 작업을 안전하게 묶나** | 트랜잭션 · 격리 수준 | 동시 작업이 서로 부딪히지 않게? |
| **구조 변경을 안전하게 운영하나** | 마이그레이션 | 운영 중 스키마를 어떻게 바꿀까? |

## 1. 정규화 (Normalization)

> **같은 사실(fact)을 딱 한 곳에만 저장하도록 테이블을 쪼개서, 데이터 중복과 모순을 없애는 작업.**

핵심은 **함수 종속성(functional dependency)** — "A를 알면 B가 결정된다" 의 관계. 정규형은 이 종속성을 점점 깨끗하게 만드는 단계.

### 정규형 4단계

| 단계 | 내용 |
|---|---|
| **1NF** | 컬럼 값은 **원자적(atomic)** 이어야 한다. 한 칸에 여러 값 넣거나 반복 그룹(예: `phone1`, `phone2`, `phone3`) 두면 위반 |
| **2NF** | 1NF + **부분 종속 제거**. 복합 키일 때, 키의 일부에만 의존하는 컬럼을 분리 |
| **3NF** | 2NF + **이행 종속 제거**. 키가 아닌 컬럼이 다른 키 아닌 컬럼에 의존하면 분리 |
| **BCNF** | 3NF의 강화판. **모든 결정자가 후보키** 여야 함 |

### 정규화가 막는 3대 이상현상(anomaly)

- **Insert anomaly**: 고객·주문이 한 테이블에 섞여있으면, **주문 없는 고객을 등록 못 함**
- **Update anomaly**: 한 고객의 주소를 바꾸려면 그 고객의 **모든 주문 행을 갱신**해야 함
- **Delete anomaly**: 마지막 주문을 지우면 **고객 정보까지 같이 사라짐**

### 비정규화도 틀린 게 아니다

**실수로 중복된 게 아니라 의도적으로 합쳐두는** 케이스가 있다. JOIN 비용을 없애기 위해서. 과도한 정규화는 오히려 JOIN을 5–6개 붙여서 쿼리를 느리게 만든다.

> 정규화가 **기본값**, 성능을 보고 비정규화로 되돌리는 게 일반적인 흐름.

→ playground 의 **정규화 섹션** 에서 같은 데이터를 정규화 전/후로 비교하고, Update Anomaly가 어떻게 발생하는지 직접 확인 가능.

## 2. 관계 (Relationships)

> 테이블끼리 **"누가 누구를 가리키나"** 를 외래키(FK) 로 연결하는 것. 1:1, 1:N, N:M 세 종류.

| 패턴 | 예시 | FK 위치 |
|---|---|---|
| **1:N** (가장 흔함) | 고객 1명 — 주문 N개 | **"N쪽"** 에 FK를 둔다 |
| **1:1** | 사용자 1명 — 프로필 1개 | 한쪽 FK에 **`unique` 제약** 추가 |
| **N:M** | 게시글 ↔ 태그 | **중간 테이블(junction table) 필수** — 직접 연결 불가능 |

### FK 삭제 동작 — CASCADE / SET NULL / RESTRICT

참조하는 행이 삭제될 때 자식 행을 어떻게 할지 정하는 옵션. 모르면 데이터 일관성이 깨지거나 의도치 않게 데이터가 날아간다.

| 옵션 | 동작 | 언제 쓰나 |
|---|---|---|
| **CASCADE** | 부모 삭제 시 자식도 같이 삭제 | 자식의 존재 의미가 부모에 종속될 때 (게시글 삭제 → 댓글 삭제) |
| **SET NULL** | 부모 삭제 시 자식 FK 컬럼을 NULL 로 | 부모가 사라져도 자식은 살아남아야 할 때 (작성자 탈퇴 → 글은 유지, 작성자 표시만 비움) |
| **RESTRICT** (기본) | 자식이 있으면 부모 삭제 **거부** | 가장 안전한 기본값. 명시적 삭제 흐름을 강제 |

→ playground 의 **관계 섹션** 에서 1:N / N:M 의 FK 위치를 시각적으로 확인 가능.

## 3. 인덱스 (Indexes)

> 특정 컬럼의 값을 미리 정렬해둔 **"찾아보기"** 자료구조.

- 인덱스 없음: 전체 스캔 — **O(n)**
- 인덱스 있음: **O(log n)** — 데이터가 100만 건이면 100만 vs 약 20 비교

### B-tree 가 기본인 이유

Postgres 기본은 **B-tree**(균형 트리). 정렬된 키들을 트리로 유지해서 탐색·삽입·삭제 모두 **O(log n)** 보장. GIN, GiST, 복합 인덱스 같은 종류도 있는데 이건 별도 학습 거리로 남겨둠.

### 인덱스는 공짜가 아니다

- **읽기는 빨라지지만 쓰기는 느려진다.** INSERT/UPDATE/DELETE 마다 인덱스도 같이 갱신해야 함
- **저장 공간도 추가로 먹는다**
- 결론: 필요한 곳에만 사용. 처음부터 무작정 거는 게 아니라, **쿼리가 느린 지점에 후속으로 추가**하는 게 정공법

### 인덱스가 효과 없는 경우

- **쓰기 많은 테이블** 에 많이 걸면 INSERT 속도 폭락
- **카디널리티가 낮은 컬럼**(값의 종류가 적은 컬럼, 예: `is_active` boolean) 은 인덱스 효과 거의 없음

→ playground 의 **인덱스 섹션** 에서 선형 검색(전체 스캔) vs B-tree 검색의 단계 수 차이를 직접 비교 가능.

## 4. 트랜잭션 (Transactions)

> 여러 작업을 **"쪼갤 수 없는 하나"** 로 묶어서 전부 성공하거나 전부 없던 일로 만드는 단위.

고전 예시: **계좌 이체.** A에서 출금하고 B에 입금하는 두 작업 사이에서 시스템이 죽으면 — 트랜잭션이 없으면 돈이 증발한다. 트랜잭션으로 묶으면 둘 다 되거나 둘 다 안 된 상태로 ROLLBACK.

### ACID

| 속성 | 의미 |
|---|---|
| **A**tomicity (원자성) | 전부 OR 아예 안함. 중간 실패 시 ROLLBACK |
| **C**onsistency (일관성) | 제약조건(FK · unique · check)을 깨는 상태로는 커밋 안 됨 |
| **I**solation (격리성) | 동시에 돌아도 따로따로 실행한 것처럼 보임 (→ 5장) |
| **D**urability (지속성) | 한 번 커밋되면 그 직후 전원이 나가도 데이터가 남음 |

### WAL — Durability 의 실제 구현

**Write-Ahead Log**: 데이터 파일을 고치기 전에 **로그부터 먼저 적는다.** 로그에 적힌 이상 그 로그대로 데이터 복원이 보장된다. Postgres / MySQL / SQLite 모두 같은 원리.

### 트랜잭션의 비용

> 너무 길게 잡으면 **다른 작업을 막는다.** 행/테이블 lock이 트랜잭션 종료까지 풀리지 않아 동시성이 떨어짐. "필요한 만큼 짧게" 가 원칙.

→ playground 의 **트랜잭션 섹션** 에서 이체 시뮬레이션 — 중간 실패 시 트랜잭션 유무에 따른 결과 차이를 직접 비교 가능.

## 5. 격리 수준 (Isolation Levels)

> 동시에 도는 트랜잭션들이 **서로의 중간 상태를 얼마나 볼 수 있는지** 를 정하는 다이얼. 빡빡할수록 안전하지만 느리다.

### 막아야 할 이상현상 3가지

| 이상현상 | 무엇 |
|---|---|
| **Dirty Read** | 아직 커밋 안 된 남의 변경을 읽음 |
| **Non-Repeatable Read** | 같은 행을 두 번 읽었는데 그 사이 남이 바꿔서 값이 다름 |
| **Phantom Read** | 같은 조건으로 두 번 조회했는데 그 사이 남이 행을 추가/삭제해서 결과가 달라짐 |

### 표준 4단계 (위로 갈수록 안전·느림)

| 격리 수준 | Dirty | Non-Repeatable | Phantom |
|---|---|---|---|
| **Read Uncommitted** | 허용 | 허용 | 허용 |
| **Read Committed** (Postgres 기본) | 차단 | 허용 | 허용 |
| **Repeatable Read** | 차단 | 차단 | 허용 (표준상) |
| **Serializable** | 차단 | 차단 | 차단 |

### 낙관적 락 vs 비관적 락

- **낙관적 락 (Optimistic)**: 내가 읽을 때와 쓸 때의 **버전이 같으면** 커밋, 아니면 재시도. 충돌이 드물 때 효율적
- **비관적 락 (Pessimistic)**: 행을 **먼저 잠그고** 작업. 충돌이 잦을 때 안전

### 함정 — "트랜잭션으로 감쌌으니 끝" 이 아님

`read-then-write` 패턴을 `BEGIN/COMMIT` 으로 감싸도, **격리 수준을 모르면 Read Committed 에선 여전히 깨진다.** 원자적 `UPDATE` 나 명시적 락이 답이다.

```sql
-- 위험: Read Committed 에선 between read & write 사이에 변경 가능
BEGIN;
SELECT balance FROM accounts WHERE id = 1;  -- 1000원
-- 다른 트랜잭션이 여기서 출금 가능
UPDATE accounts SET balance = balance - 500 WHERE id = 1;
COMMIT;

-- 안전: 원자적 UPDATE
UPDATE accounts SET balance = balance - 500 WHERE id = 1 AND balance >= 500;
```

→ playground 의 **격리 수준 섹션** 에서 두 트랜잭션의 타임라인을 단계별로 진행하면서 Dirty Read 가 어떻게 발생하는지 직접 확인 가능.

## 6. 마이그레이션 (Migrations)

> 데이터베이스 **구조(스키마) 변경** 을 순서 있는 스크립트로 기록해서, 어느 환경에서든 같은 상태로 재현·롤백할 수 있게 하는 것.

한 줄로: **스키마 버전의 git.** 구조 변경 하나하나를 커밋처럼 파일로 남겨서, 누가 어디서 적용해도 같은 구조가 되게 한다.

### 원리

1. 각 변경을 **타임스탬프가 붙은 파일**로 저장 (예: `20260616_add_user_profile_column.sql`)
2. DB에 `schema_migrations` 같은 메타 테이블을 둬서 **어디까지 적용했는지** 기록
3. 적용 안 된 마이그레이션만 **순서대로** 실행

### 운영 중 스키마 변경의 위험

> 운영 중인 서비스에서 스키마를 바꾸는 건 위험하다.

- **컬럼 추가**: 보통 안전 (기본값 NULL 또는 default value)
- **컬럼 삭제 / 이름 변경**: 위험 — 기존 코드가 그 컬럼을 참조하면 에러

### Expand-and-Contract 패턴 — 무중단 변경

큰 변경은 한 번에 하지 않고 **4 단계로 쪼갠다.**

```
1) Expand   : 새 컬럼/테이블 추가         (구 코드는 영향 없음)
2) Migrate  : 코드가 양쪽 다 쓰게 배포      (전환 기간)
3) Backfill : 데이터를 새 자리로 채워넣기
4) Contract : 옛 컬럼/테이블 제거           (모든 코드가 새 자리만 쓸 때)
```

### 그 외 안전 팁

- **`CREATE INDEX CONCURRENTLY`** — 큰 테이블의 인덱스 생성을 락 없이 (Postgres)
- **프로덕션 콘솔에서 직접 손대지 말 것** — 재현 불가, 롤백 불가, 다음 사람이 스키마 상태를 모름. 무조건 마이그레이션 스크립트 경유

→ playground 의 **마이그레이션 섹션** 에서 expand-and-contract 의 4 단계를 시각적으로 확인 가능.

## 직접 만져보는 playground

> 🎮 **[DB 어휘 playground](/playground/db-terms/)** — 위 6가지 개념을 실제 데이터·트랜잭션 시뮬레이션으로 직접 만져볼 수 있다.

- 정규화 전/후 비교 + Update Anomaly 시연
- 1:N / N:M 관계와 FK 위치
- 선형 스캔 vs B-tree 인덱스 검색 단계 수 비교
- 트랜잭션 유무에 따른 이체 결과 차이
- Dirty Read 가 발생하는 두 트랜잭션 타임라인
- expand-and-contract 4 단계 마이그레이션

## 더 공부해볼 것

### 1. FK 동작 옵션 깊이

- `ON UPDATE` 도 `CASCADE` / `SET NULL` / `RESTRICT` 가 있음 — 언제 쓰나
- Soft delete (`deleted_at` 컬럼) vs hard delete + cascade 의 트레이드오프

### 2. 인덱스 종류 전수조사

- B-tree 외에 GIN, GiST, BRIN, Hash — 각각 어떤 워크로드에 맞나
- **복합 인덱스** 의 컬럼 순서 — leftmost prefix 규칙
- 부분 인덱스(Partial Index), Covering Index, Expression Index
- 참고: [Postgres Index Types](https://www.postgresql.org/docs/current/indexes-types.html)

### 3. 격리 수준 실전

- Postgres / MySQL / SQLite 의 격리 수준 기본값과 실제 동작 차이
- **Snapshot Isolation** 과 표준 격리 수준의 관계
- 어떤 워크로드에 어떤 수준이 맞나 (대부분 Read Committed로 OK, 강한 일관성 필요 시만 Serializable)
- 참고: [Postgres Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)

### 4. 마이그레이션 도구

- 작성자가 쓰는 Supabase 마이그레이션 흐름 (`supabase migration new`, `supabase db push`)
- 다른 생태계: Prisma migrate / Alembic (Python) / Flyway / Liquibase
- 실패한 마이그레이션 복구 패턴

### 5. 동시성 패턴 더 깊이

- **Advisory Lock** (Postgres `pg_advisory_lock`) — 트랜잭션 외부에서 명시적으로 잡는 락
- **SELECT ... FOR UPDATE** vs `FOR SHARE` 의 차이
- **Compare-And-Swap (CAS) / Optimistic Concurrency Control** 구현 패턴
- Race condition 디버깅 — 실제로 어떻게 재현하고 잡나

### 6. 다음 시리즈로 이어질 주제

- **API 어휘** (REST, 상태 코드, 멱등성, 페이지네이션)
- **인증·인가** (이미 [Supabase OAuth 글](./supabase-social-login-multiple-keys) 에서 한 번 봤음)
- **성능 최적화** (병목 종류, 프로파일링, 캐싱)

## 회고

UI 정리에서 정착시킨 톤(왜 필요 / 어휘 표 / 좋은 지시문 / playground) 을 그대로 DB에 적용해보니, **시리즈로서의 일관성이 분명히 잡혔다.** 다음 글들도 같은 틀로 가면 작성자 입장에서도 작성 부담이 줄고, 독자 입장에서도 어디서 무엇을 찾을지 예측 가능하다.

DB는 UI 보다 추상적이라 playground 디자인이 어려웠는데, **"개념을 실제 데이터 변화로 보여주는 시뮬레이션"** 형태로 풀어보니 의외로 잘 맞았다. 격리 수준의 dirty read 같은 건 정말 그림 없이 이해하기 어려운 주제라, playground 가 글의 가치를 한 단계 올려주는 보조 자산이 된 느낌.
