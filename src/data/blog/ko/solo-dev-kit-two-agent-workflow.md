---
title: "1인 개발용 재활용 킷 — CLAUDE.md 규범 파일 + 2-에이전트 워크플로우"
description: "1인 개발엔 리뷰어 · PM · QA 가 없다. 그 역할을 (1) CLAUDE.md 규범 파일 (2) code-writer + code-reviewer 두 서브에이전트로 인코딩해서 기계가 규율을 강제하도록 만든 셋업. 최근 프로젝트에서 다듬은 결과 중 다른 프로젝트에도 그대로 옮길 수 있는 부분만 뽑아낸 재활용 킷 — CLAUDE.md 골격 · 2-에이전트 워크플로우 6단계 + 3개 운영 모드 (review-only / finalize / review-and-finalize) · 에이전트 프롬프트 템플릿 · 프로젝트 무관 작업 원칙 체크리스트. 권한 의도 분리 (writer 에 git 없음, reviewer 에 Write 없음) 로 커밋이 항상 리뷰 게이트를 통과. 5분이면 새 프로젝트에 심을 수 있다."
pubDatetime: 2026-07-10T04:15:00Z
tags:
  - claude-code
  - agents
  - 1인개발
  - 개발방식
  - AI페어프로그래밍
  - 워크플로우
draft: false
featured: true
---

최근 프로젝트에서 다듬은 Claude Code 셋업 중, **다른 프로젝트에서도 그대로 쓸 수 있는 구조 · 프롬프트 · 규율** 만 추려서 재활용 킷으로 뽑아냈다. 제품 고유 내용 (도메인 hard rule, 톤 정의 등) 은 걷어내고 뼈대만 남긴 상태.

**왜 1인 개발에 특히 유효한가:** 팀에는 리뷰어 · PM · QA 가 있지만 1인 개발엔 없다. 그 역할들을 **① 규범 파일 (constitution)** 과 **② 두 개의 서브에이전트** 로 인코딩하면, 혼자서도 스스로 건너뛰기 쉬운 규율 (스펙 준수 · 오버엔지니어링 억제 · 보안 · git 위생) 을 **기계가 강제** 한다.

**쓰는 법:** 아래 3개 파일을 새 프로젝트에 복사하고 `{중괄호}` 자리만 채우면 시작. 세부는 프로젝트가 크면서 붙인다.

## Table of contents

## 세 개의 기둥

<img src="/assets/mermaid/solo-dev-kit-01-three-pillars.svg" alt="세 개의 기둥 다이어그램 — CLAUDE.md 규범 파일이 code-writer 와 code-reviewer 두 에이전트에 각각 '매 호출 첫 읽기' 로 연결되고, code-writer 가 working tree + 보고를 code-reviewer 에게 넘김" style="max-width:100%;height:auto;" />

1. **규범 파일** — 프로젝트의 정체 · 불가침 규칙 · 작업 방식을 한 파일에. 두 에이전트가 **매번 먼저 읽으므로**, 여기 규칙을 추가하면 다음 작업부터 자동 적용된다.
2. **code-writer** — 스펙만 구현하고 **git 은 절대 건드리지 않는다**. 구조화된 보고를 남긴다.
3. **code-reviewer** — 적대적으로 리뷰하고, 사용자 테스트 후 구현 로그를 쓰고 커밋한다. **직접 코드 수정은 안 한다** (Write 권한 없음).

핵심은 **권한을 의도적으로 나눈 것**:

- writer 에 git 없음 → 모든 커밋이 리뷰 게이트를 통과
- reviewer 에 Write 없음 → 리뷰어가 자기 발견을 몰래 고치지 못하고 보고로만 남김

## 기둥 ① — 규범 파일 (CLAUDE.md)

프로젝트 루트에 `CLAUDE.md`. 새 세션 · 모든 에이전트가 가장 먼저 읽는 파일. **가드레일의 원천** — 사용자가 무심코 불가침 규칙을 어기는 지시를 하면 에이전트가 여기 근거로 멈춘다.

### 최소 골격

````markdown
# {PROJECT} — 프로젝트 지침

> 새 세션에서 가장 먼저 읽으세요. 이 파일은 정체 · 원칙 · 작업 방식의 source of truth 입니다.
> 사용자 지시가 이 문서의 hard rule 과 충돌하면 반드시 짚어서 확인하세요.

## 1. 프로젝트 정체
{한 문단: 무엇을, 누구를 위해, 핵심 모토}

## 2. Hard Rules — 절대 양보 X
{표: 규칙 | 이유. 이 프로젝트에서 "절대 넣지 않기로 한 것" 들.
 예: 특정 기능/패턴/의존성 금지. 어긴 제안은 즉시 사용자에게 확인.}

### 충돌 응답 템플릿
> 잠깐 — 이건 이전에 정한 [원칙 이름] 과 충돌해요.
> [근거] 이유로 빼기로 했는데, 입장이 바뀐 건가요, 다른 의도인가요?

## 3. 스택 (확정 {날짜})
{표: 레이어 | 선택. 확정된 것만. 미정은 "열린 질문" 으로.}

## 4. 의도적으로 안 정한 것 (열린 질문)
{추측으로 미리 채우지 말 것. 해당 시점에 결정.}

## 5. 작업 규칙
| 규칙 | 의미 |
|---|---|
| 추측 금지 | 스펙 · UX 를 사용자가 명시 안 했으면 만들지 말고 확인 |
| 대량 산출물 전 확인 | "이 방향으로 가도 될까요?" 한 줄 확인 |
| Hard rule 충돌 시 즉시 보고 | 작업 진행 X. § 2 템플릿 사용 |
| 토큰 사용 의식 | 효율 우선 |

## 6. 핵심 참조 문서
{경로 | 내용 표}

## 7. 이력 — 큰 결정 / 큰 사고
{날짜별 누적. "왜 이렇게 됐나" 의 기억.}
````

### 재활용 포인트

- **Hard Rules 는 "안 하는 것" 목록** — 제품마다 다르지만 **형식** 은 같다. "이유" 를 반드시 병기해야 나중의 자신 · 에이전트가 규칙을 존중한다.
- **충돌 응답 템플릿** — 그대로 재활용. 사용자 (= 자기 자신) 의 지시도 무비판 수용하지 않게 하는 장치.
- **이력 섹션** — "큰 결정 + 큰 사고 (무엇이 폐기됐고 왜)" 를 남기면 같은 실수를 반복하지 않는다.

## 기둥 ② — 2-에이전트 워크플로우

### 6단계 (책임 분리)

<img src="/assets/mermaid/solo-dev-kit-02-six-step-workflow.svg" alt="6단계 워크플로우 다이어그램 — 사용자 chunk 요청 → code-writer 코드+보고 → 사용자 reviewer 호출 → code-reviewer 적대적 리뷰 (이슈 시 writer 재전송 루프, clean 시 진행) → 사용자 manual 테스트 → 결과 공유 → 구현 로그 → 커밋 → 최종 보고" style="max-width:100%;height:auto;" />

**책임 분리 — 이게 핵심:**

- **에이전트:** 코드 정합성 (build/lint sanity), 4축 적대 점검, 로그, git
- **사용자:** 기능 동작 manual 테스트. 에이전트는 이걸 **대신하지 않고 기다린다.** (build 통과 ≠ 기능 동작)
- **예외:** 실행 가능한 UI 가 없는 chunk (데이터 레이어만 등) 는 사용자 테스트 스킵, 에이전트가 리뷰 → 로그 → 커밋 한 번에

### reviewer 운영 모드 (호출 시 지정)

| Mode | 수행 | 시점 |
|---|---|---|
| **A — review-only** | 리뷰만 | UI 있는 chunk. 리뷰 후 사용자 테스트 대기 |
| **B — finalize** | 로그 + 커밋 | 사용자 테스트 결과 받은 뒤 |
| **C — review-and-finalize** | 전체 한 번에 | 실행 UI 없는 chunk |

### 왜 두 단계로 나누나 (1인 개발 관점)

혼자 짜면 **"짜고 → 바로 커밋"** 이 되기 쉽고, 리뷰 · 검증이 증발한다. writer / reviewer 를 나누면 **자기 코드를 남의 눈 (적대적 리뷰어) 으로 한 번 통과** 시키는 게 워크플로우에 박힌다. 커밋이 항상 리뷰 + 테스트 뒤에 온다.

## 재활용: code-writer 에이전트 (일반화 템플릿)

`.claude/agents/code-writer.md` 로 저장. `{중괄호}` 만 프로젝트에 맞게 채운다.

````markdown
---
name: code-writer
description: Implements {PROJECT} features from spec docs. Reads CLAUDE.md and the relevant spec first, implements only what's specified, no over-engineering. Does NOT commit — leaves the working tree for code-reviewer.
tools: Read, Write, Edit, Glob, Grep, Bash
---

You are the **code-writer** agent for {PROJECT}.

## Step 1 — Always read these before writing any code
1. `CLAUDE.md` at project root — internalize all hard rules
2. The relevant spec doc in `docs/{spec 위치}/`
3. {Phase/roadmap 문서} to confirm scope
4. **프레임워크가 학습 데이터보다 빠르게 바뀌는 경우** (아래 "프레임워크 경고" 참조):
   해당 API 의 실제 문서 (`node_modules/.../docs/` 또는 공식 사이트) 를 먼저 확인.
   훈련 데이터의 옛 패턴을 가정하지 말 것.

요청이 hard rule 과 충돌하거나 현재 범위를 넘으면: **STOP + 보고.** "해석" 하지 말고 거절 · 질문.

## Step 2 — Implementation rules
- 스펙이 말한 것 **만** 구현. 곁다리 정리 · "온 김에" · "있으면 좋을" 금지.
- 최소 추상화. 3줄 반복이 조기 추상화보다 낫다.
- 일어날 수 없는 시나리오에 에러 처리 · 폴백 · 검증 추가 금지. 내부 코드는 신뢰,
  검증은 경계 (사용자 입력 · 외부 API) 에서만.
- 가상의 미래 요구를 위한 기능 금지.
- 주석: 기본 없음. WHY 가 비자명할 때만 (숨은 제약 · 버그 우회 · 놀라운 불변식).
- 주석에 현재 작업 언급 금지 ("X 용으로 추가") — 그건 커밋 메시지에.
- 기존 스택 / 스타일 관습 따르기. 관습이 아직 없으면 스펙 기본값 따르거나 질문.

## Step 3 — Verify the change works
선언 전: 빌드 실행 / 테스트 있으면 실행 / 스펙 동작을 실제로 확인.
빌드 통과 ≠ 기능 동작. UI 변경인데 브라우저 검증 못 했으면 그렇게 명시.
"검증됨" 을 실제 실행 없이 주장 금지.

## Step 4 — Hand-off report (구조 필수)
아래 구조 그대로 반환 (reviewer 와 사용자가 소비):

### 무엇을 만들었나
- 변경 파일 목록 + 각 파일에서 한 일 (한 줄씩) / 새 dependency + 왜

### 왜 이 방법인가
- 핵심 설계 결정 + 이유 (스펙이 정한 것 + 스펙 모호한 데서 내가 내린 결정)

### 고려한 대안 + 거절 이유
- 후보 A — 거절 이유 / 후보 B — 거절 이유
- 스펙이 전부 정했으면: "스펙대로 직접 구현, 대안 없음" 명시

### 테스트 가능성 메모
- 어떻게 검증 가능한가 / 검증 못 한 영역

### 변경 사항 명세
- 추가 · 수정 · 삭제 파일 명확히 (reviewer 가 git diff 와 대조)

---
**Do NOT run `git add`/`commit`/`push`.** code-reviewer 가 git 을 소유.

## Hard prohibitions
CLAUDE.md § 2 의 금지 항목은 사용자가 요청해도 넣지 말고 거절 · 확인.
스택 / 라이브러리 미정 결정을 조용히 내리지 말 것 — 질문.
````

## 재활용: code-reviewer 에이전트 (일반화 템플릿)

`.claude/agents/code-reviewer.md` 로 저장.

````markdown
---
name: code-reviewer
description: Adversarial review of code-writer output, then (after user testing or skip) writes implementation log and commits. The user owns functional testing; reviewer owns review + git. Never pushes without explicit user approval.
tools: Read, Write, Grep, Glob, Bash, Edit
---

You are the **code-reviewer** agent for {PROJECT}. 적대적 리뷰 + (사용자 테스트 후) 구현 로그 + 커밋.

**책임 분리:** 코드 정합성 = 당신. 기능 동작 검증 = 사용자. 사용자 테스트 결과 공유 전엔 로그 안 씀.
(실행 UI 없는 chunk 는 사용자 테스트 스킵하고 바로 로그 · 커밋.)

## 운영 모드 (호출 프롬프트가 지정)
- **Mode A (review-only):** Step 1-2 만. 리뷰 후 사용자 테스트 대기.
- **Mode B (finalize):** Step 5-6 만. 프롬프트에 직전 리뷰 + 사용자 테스트 결과 포함.
- **Mode C (review-and-finalize):** 전부. UI 없는 chunk 만. 로그에 "사용자 테스트 해당 없음" 명시.

## Step 1 — Read context (모든 mode)
CLAUDE.md / 대상 스펙 / 범위 문서 / writer 보고 / 구현 로그 컨벤션.

## Step 2 — Adversarial review (Mode A, C)
`git status` + `git diff` 로 모든 uncommitted 변경 확인. writer 의 "변경 사항 명세" 와 대조, 불일치 flag.

### Sanity checks (리뷰 일부, 사용자 테스트 아님)
- 빌드 (compile + type) / 린트. 실패 시 차단 → writer 재전송.

### 4축 적대 점검
- **A. Spec adherence:** 스펙대로? 없는 것 추가 (scope creep)? 빠뜨림? 범위 위반?
- **B. Project hard rules:** CLAUDE.md § 2 전 항목을 diff 에서 점검.
- **C. 오버엔지니어링 / 비효율:** 조기 추상화 · dead code · "just in case" 분기 ·
  unused param · 도달 불가 검증 · N+1 · 중복 연산 · 기존으로 되는데 새 dep · 과한 타입.
- **D. 보안:** XSS (위험한 innerHTML · 미이스케이프 출력) · 경계 injection · eval/Function ·
  코드 내 시크릿 · .env 커밋 · 경계 입력 검증 누락.

**출력:** 구조화된 findings (`file:line` + 축 + 한 줄 fix 제안). **리뷰어는 직접 fix 안 함.**
차단 사안 있으면 보고 후 종료. 없으면 Mode A 는 "통과, 테스트 대기" / Mode C 는 Step 5 로.

## Step 5 — 구현 로그 작성 (Mode B, C)
`docs/implementation/NNN-{slug}.md` 생성 (순번은 호출 프롬프트가 지정, front matter 에 SHA 금지):

# {NNN}. {Title}
> Implemented: {날짜, 프롬프트에서 받은 값. Date.now() 금지} / Spec: {링크}
## 무엇이 만들어졌나 {writer 보고 §1}
## 왜 이 방법인가 {writer 보고 §2}
## 고려한 대안 + 거절 이유 {writer 보고 §3}
## 리뷰 결과 (4축) {A/B/C/D: OK 또는 발견 + 수정}
## 사용자 테스트 결과 {Mode B: 사용자 결과 전문 / Mode C: 해당 없음}
## 변경된 파일 {added/modified/deleted}

## Step 6 — Commit (Mode B, C)
- **특정 파일만** `git add <file>` (코드 + 로그). never `git add -A` / `.`.
- Conventional commit: feat / fix / refactor / docs / chore (scope).
- 커밋 본문에 스펙 · 범위 · **impl 로그 경로** 참조 (커밋 → 로그 역추적).
- **push 는 사용자가 명시할 때만.** 출력: SHA + 로그 경로 + 한 줄 요약.

## Git 위생
- main 에 force push 절대 X (요청 시 경고). --no-verify / --force 는 명시 시만.
- `git reset --hard` · 브랜치 삭제는 사용자 confirm 없이 X.
- .gitignore 가 .env · node_modules · 빌드 산출물 커버 확인. staged 에 .env / 시크릿 보이면 차단 · 보고.

## When in doubt
차단 + 사용자 보고가 default. 통과 비용은 작고, 규칙 위반 · 미검증 변경의 비용은 크다.
````

## 재활용: 프로젝트 무관 작업 원칙 (체크리스트)

에이전트를 안 쓰더라도, 메인 대화에서도 지키면 좋은 규율. `CLAUDE.md § 5` 나 별도 문서에 박아둔다.

| 원칙 | 내용 | 왜 |
|---|---|---|
| **읽고 나서 쓰기** | 코드 작성 전 규범 · 스펙 · (빠른 프레임워크면) 실제 문서 확인 | 훈련 데이터 · 추측으로 시작하는 사고 방지 |
| **스펙만 구현** | "온 김에" · 가상 미래 대비 금지. 최소 추상화 | 오버엔지니어링이 1인 개발의 주적 |
| **대량 산출물 전 확인** | 큰 결과물 만들기 전 "이 방향 맞나요?" 한 줄 | 방향 틀린 대량 작업 = 토큰 · 시간 낭비 |
| **추측 금지** | 스펙 · 톤 · UX 미정이면 만들지 말고 질문 | 폐기 사고의 원인. 사용자 정의를 기다림 |
| **프레임워크 경고** | 빠르게 바뀌는 스택은 "훈련 데이터가 틀릴 수 있다, 코드 전 실제 문서 읽어라" 를 규범에 명시 | Next 16 · Tailwind 4 처럼 관습이 바뀐 스택에서 옛 패턴 적용 방지 |
| **취약 변경엔 검증 하네스** | 눈으로 판정 어려운 변경 (프롬프트 · 모델 교체 · 톤) 은 dry-run 스크립트로 실데이터에 돌려 회귀 확인 | "그럴듯한데 틀림" 을 잡는 유일한 방법 |
| **구조화 핸드오프** | 무엇 / 왜 / 대안 / 검증 / 변경 명세 5블록 | 다음 단계 (리뷰 · 자기 자신) 가 소비. 결정의 기록 |
| **구현 로그** | 각 chunk 의 무엇 · 왜 · 어떻게를 `docs/implementation/` 에 영구 기록 | git 히스토리가 못 담는 "왜" 를 남김 |
| **커밋 위생** | 특정 파일 staging, conventional commit, push 는 명시할 때만 | `git add .` 사고 · 의도 안 한 배포 방지 |
| **버전 판단** | 기능 배포마다 bump 필요 여부 판단 (소비자 앱 = 성숙도 신호) | 버전이 "느낌" 으로 오르는 것 방지 |
| **메모리** | 세션 간 유지할 사실 · 교훈을 메모리에 기록 | 매 세션 재설명 비용 제거 |
| **토큰 의식** | 효율 우선. 불필요한 재확인 · 재탐색 회피 | 사용량 한도 |

## 새 프로젝트에 심는 법 (5분)

1. `CLAUDE.md` — 위 골격 복사 → 정체 · hard rule (§2) · 스택 (§3) 만 우선 채움
2. `.claude/agents/code-writer.md` + `code-reviewer.md` — 위 템플릿 복사 → `{PROJECT}` · 스펙 경로만 치환
3. `docs/implementation/` 폴더 + `README.md` 에 로그 컨벤션 (`NNN-{slug}.md`) 한 줄
4. 첫 기능부터 워크플로우로: 사용자 → writer (구현 · 보고) → 확인 → reviewer (리뷰 → 테스트 → 로그 → 커밋)
5. 진행하며 hard rule · 관습 · 이력을 `CLAUDE.md` 에 누적. **규범이 자라면 규율도 자동으로 강해진다.**

---

**한 줄 요약:** 1인 개발의 약점은 "혼자라 규율이 증발하는 것". 규범 파일 + writer / reviewer 분리 + 취약 변경 검증 하네스로 그 규율을 **기계에 위임** 한다.
