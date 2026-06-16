# 블로그 리디자인 작업 계획

작성자(@dpcivl)가 본격적인 디자인 리뉴얼을 결정한 시점에 이 문서대로 진행한다. **회귀 버그 없이 한 영역씩 깎아가는 것** 이 목표.

> 핵심 원칙: **수직 슬라이스 + Phase 단위.** 한 번에 다 갈아엎지 말 것. 매 Phase 끝나면 배포 + 동작 확인 후 다음 Phase 진행.

## Phase 0 — 준비 (반드시 먼저)

작업 시작 전에 챙길 것.

### 0-1. 작성자가 제공할 자료

- [ ] **레퍼런스 3~5개** (URL): "이런 느낌으로 가고 싶다" 의 사이트들
- [ ] **싫어하는 포인트** (현재 스타일에서 구체적으로): "이게 옛날 같음", "여기는 답답함" 같은 한 줄들
- [ ] **유지하고 싶은 것** (있다면): 예) "전체 폭이 좁은 건 그대로 좋음", "다크모드는 필수"

### 0-2. 기준점 캡처

- [ ] 작업 시작 전 현재 상태 스크린샷 (홈, 글 본문, 태그 페이지, 모바일/데스크탑 / 라이트·다크 — 8장 정도)
- [ ] Vercel Analytics 의 현재 페이지뷰 baseline 기록 (리디자인 후 비교용)

### 0-3. 안전장치

- [ ] **새 브랜치 시작**: `git checkout -b redesign/<phase-name>` — main에 직접 작업 X
- [ ] Vercel Preview 배포로 단계마다 확인. main merge 는 Phase 완료 후
- [ ] 작업 도중 다른 inbox/scratch 메모 처리는 일시 정지 (리디자인 PR 영역과 메인 라인 분리)

---

## Phase 1 — 디자인 토큰 (색·폰트)

**가장 안전한 변경. 전역 변수만 손댄다.** 컴포넌트 구조는 그대로.

### 영향 파일

- [src/styles/global.css](../src/styles/global.css) — CSS 변수 (`--accent`, `--background`, `--border`, `--foreground` 등 라이트/다크 양쪽)
- [src/config.ts](../src/config.ts) — `lightAndDarkMode` 설정 (그대로 두는 게 보통)
- [astro.config.ts](../astro.config.ts) — `experimental.fonts` 폰트 정의

### 작업 순서

1. 레퍼런스에서 컬러 팔레트 추출 (HEX 값 정리)
2. `global.css` 의 변수만 교체. **선택자나 구조는 건드리지 않는다.**
3. 폰트 교체할 거면 `astro.config.ts` 의 fonts 항목 + `global.css` 의 `font-family` 갱신
4. 다크/라이트 양쪽 다 변경

### 검증 체크리스트

- [ ] 홈 / 글 본문 / 태그 / 아카이브 / About / 포트폴리오 모두 둘러보기
- [ ] 다크모드 토글로 양쪽 다 확인
- [ ] **대비(contrast)** — 글자가 안 읽히는 곳 없는지 (특히 다크모드의 코드 블록)
- [ ] 모바일에서 한 번 (브라우저 개발자도구 모바일 뷰)
- [ ] 빌드 통과: `npx astro check`

### 되돌리는 법

`git checkout main -- src/styles/global.css astro.config.ts` — 변수만 변경했으니 충돌 없음.

---

## Phase 2 — 홈(메인) hero / 첫인상

**방문자가 처음 보는 영역.** 가장 큰 인상 차이를 만드는 작업.

### 영향 파일

- [src/pages/index.astro](../src/pages/index.astro) — hero 섹션 + Featured + Recent Posts 레이아웃
- [src/components/Socials.astro](../src/components/Socials.astro) — 소셜 링크 (변경 안 해도 됨, 가끔 위치만)
- [src/components/Card.astro](../src/components/Card.astro) — 글 미리보기 카드 (Phase 3과 겹칠 수 있음)

### 작업 순서

1. Hero 영역 구조 변경 (큰 텍스트, 아바타/이미지, CTA 버튼 등)
2. Featured 섹션 디자인 — 현재는 단순 리스트, 카드 그리드로 갈지 결정
3. Recent Posts 도 같이 흐름 정합 맞추기

### ⚠️ 주의

- **Featured / Recent 필터 로직은 건드리지 않는다.** 데이터 흐름(`getCollection`, `filter`, `sort`) 은 그대로 두고 **렌더링 부분만 손댄다.**
- [`src/pages/index.astro:18-19`](../src/pages/index.astro#L18) 의 `featured` / `recent` 분리 로직 유지

### 검증 체크리스트

- [ ] Featured 글이 있는 상태 / 없는 상태 양쪽 다 정상 렌더링
- [ ] Recent Posts 가 `SITE.postPerIndex` 갯수만큼 정확히 보여지는지
- [ ] "All Posts" 링크 동작
- [ ] 모바일에서 hero가 답답하지 않은지
- [ ] [src/pages/index.astro:115-121](../src/pages/index.astro#L115) 의 `backUrl` sessionStorage 로직 건드리지 않았는지 확인

---

## Phase 3 — 글 카드 / 글 목록

**Featured / Recent / Posts / Tags 페이지 모두에 영향.** 영향 범위가 가장 넓은 Phase 이라 신중히.

### 영향 파일

- [src/components/Card.astro](../src/components/Card.astro) — 글 카드 (Featured/Recent/Tags/Posts 다 씀)
- [src/components/Datetime.astro](../src/components/Datetime.astro) — 날짜 표기
- [src/pages/posts/[...page].astro](../src/pages/posts/[...page].astro) — 글 목록 페이지
- [src/pages/tags/[tag]/[...page].astro](../src/pages/tags/[tag]/[...page].astro) — 태그별 글 목록
- [src/pages/archives/index.astro](../src/pages/archives/index.astro) — 아카이브 페이지

### ⚠️ 주의 — 한 컴포넌트가 여러 페이지에 영향

`Card.astro` 는 4개 페이지에서 import 됩니다. 한 곳을 손대면 4 곳에서 동시에 모양이 바뀝니다.

→ **수정 후 4 페이지 다 들어가서 깨진 곳 없는지 점검.**

### 검증 체크리스트

- [ ] 홈 (`/`) — Featured + Recent
- [ ] `/posts` (페이지네이션 동작)
- [ ] `/tags/<태그>` (태그별 목록)
- [ ] `/archives` (있다면)
- [ ] 카드의 `viewTransitionName` 이 살아있는지 (페이지 전환 애니메이션) — [src/components/Card.astro:27](../src/components/Card.astro#L27)

---

## Phase 4 — 글 본문 레이아웃 (PostDetails)

긴 글의 가독성이 결정되는 영역. 타이포그래피 / 여백 / 코드 블록 / 이미지 / 인용문 등.

### 영향 파일

- [src/layouts/PostDetails.astro](../src/layouts/PostDetails.astro) (있다면) — 글 상세 페이지 레이아웃
- [src/styles/global.css](../src/styles/global.css) — `.prose` 또는 `article` 관련 스타일
- 코드 블록 스타일링은 [astro.config.ts](../astro.config.ts) 의 `shikiConfig` 에 정의됨 — 주의

### ⚠️ 절대 건드리면 안 되는 것

- **frontmatter 스키마** ([src/content.config.ts](../src/content.config.ts)) — 변경 시 모든 글이 깨짐
- **slug 구조** — URL이 바뀌면 외부 링크(검색엔진, 사람인 포트폴리오 등) 가 다 끊김
- **shikiConfig 의 transformer** — 코드 블록 처리 로직

### 검증 체크리스트

- [ ] 짧은 글 (예: STM32 글) — 여백이 답답하지 않은지
- [ ] 긴 글 + TOC + 이미지 (예: NDT 글) — 흐름이 부드러운지
- [ ] 코드 블록 + 인용문 + 표 모두 렌더링되는 글 (예: 카카오 로그인 글) 확인
- [ ] 라이트/다크 모드 양쪽
- [ ] 모바일 가독성
- [ ] **Edit page 링크** 동작 — [src/config.ts:14-18](../src/config.ts#L14)
- [ ] **OG 이미지 자동 생성** 정상 작동 (`dynamicOgImage: true`)

---

## Phase 5 — 헤더 / 푸터 / 네비

작은 변화로도 인상이 크게 달라지는 영역. 마지막에 다듬기.

### 영향 파일

- [src/components/Header.astro](../src/components/Header.astro) — 상단 네비 (모바일 햄버거 메뉴 포함)
- [src/components/Footer.astro](../src/components/Footer.astro) — 하단

### ⚠️ 주의

- 헤더 햄버거 메뉴 JS 로직 ([src/components/Header.astro:145-169](../src/components/Header.astro#L145)) 건드리지 말 것. CSS만 손대기
- 포트폴리오 페이지는 **헤더 nav 에 링크 추가하지 않는다** (의도된 unlisted 정책)

### 검증 체크리스트

- [ ] 데스크탑에서 nav 정렬·간격
- [ ] 모바일에서 햄버거 메뉴 펼침/닫힘 동작
- [ ] 다크모드 토글 정상 동작
- [ ] 검색 버튼 → `/search` 이동
- [ ] 아카이브 아이콘 표시 (`showArchives` 가 true 일 때)

---

## Phase 6 — 마무리 점검

전 영역 한 번 더 훑기.

### 회귀 테스트 체크리스트

#### 페이지 전체 점검
- [ ] `/` (홈)
- [ ] `/posts/` 와 페이지네이션 (`?page=2`)
- [ ] `/posts/<slug>/` — 글 본문 (대표 글 3개: NDT / 멀티턴 / STM32)
- [ ] `/tags/` 와 개별 태그 페이지
- [ ] `/about/`
- [ ] `/archives/` (있으면)
- [ ] `/search/` (pagefind 검색 동작)
- [ ] `/portfolio/` (unlisted, noindex 유지)
- [ ] `/playground/ui-terms/` (인터랙티브 데모, 디자인 변경에 영향받으면 안 됨)
- [ ] `/rss.xml` 정상 응답
- [ ] `/sitemap-index.xml` 정상 응답 + portfolio 제외 유지

#### 환경 점검
- [ ] 라이트 / 다크 모드 양쪽
- [ ] 데스크탑 (1280+) / 태블릿 (768) / 모바일 (375)
- [ ] Chrome / 모바일 Safari

#### 빌드·배포 점검
- [ ] `npx astro check` 0 errors
- [ ] `pnpm build` 성공 (포트폴리오 비어있어도 Complete!)
- [ ] Vercel preview 에서 모든 페이지 정상 로드
- [ ] **JSON-LD 구조화 데이터** 살아있는지 (글 페이지에서 view source — `BlogPosting` 스키마 확인)
- [ ] **OG 이미지** 자동 생성 동작 (글 URL + `/index.png` 로 직접 접근)

#### 검색엔진 영향 점검
- [ ] sitemap 에서 portfolio 빠져있는지 재확인
- [ ] portfolio 페이지의 `<meta name="robots" content="noindex,nofollow">` 살아있는지
- [ ] Google Search Console 의 인증 메타 태그 (`PUBLIC_GOOGLE_SITE_VERIFICATION`) 깨지지 않았는지
- [ ] 네이버 동일

---

## 절대 건드리면 안 되는 것 (요약)

1. **글 slug 구조 / URL 패턴** — 외부 링크(사람인, 검색엔진, RSS 구독자) 가 다 끊긴다
2. **content.config.ts 의 frontmatter 스키마** — 기존 글이 깨진다
3. **shikiConfig 의 transformer 옵션** — 코드 블록의 fileName / diff / highlight 표시가 망가진다
4. **dynamicOgImage / og.png 라우트** — OG 이미지 자동 생성이 깨진다
5. **포트폴리오 페이지의 noIndex / pagefind-ignore / sitemap 제외** — 정책상 유지
6. **Header.astro 의 햄버거 메뉴 JS** — astro:after-swap 이벤트 핸들링이 ViewTransition 과 엮여있음
7. **postFilter.ts 의 미래 글 제외 로직** — 작성자가 직접 의식하는 기능

---

## 작업 진행 시 매 Phase 끝나면

1. `git status` 로 의도치 않은 변경 없는지 확인
2. `pnpm build` 성공 확인
3. Vercel preview 배포에서 위 회귀 테스트 체크리스트 중 해당 Phase 항목만 검증
4. 문제 없으면 main merge
5. 다음 Phase 시작

## 작업 중 발견된 추가 사항 기록

(Phase 진행하면서 새로 발견된 주의점, 회귀 위험 영역 등은 여기 누적)

- _(이 섹션은 작업하면서 채워나갑니다)_
