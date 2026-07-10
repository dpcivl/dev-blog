---
title: "AstroPaper 기본에서 더 얹은 것들 — 블로그를 프로덕트처럼 굴리기"
description: "이 블로그는 AstroPaper 를 그대로 두지 않고 '매일 발행하는 1인 콘텐츠 시스템' 관점에서 계속 확장 중. 어떤 문제에 부딪혔고 어떻게 도구로 만들었는지 정리 — 시리즈 페이지 (접기/펼치기) · 플레이그라운드 · KR/EN i18n · Sonnet 5 번역 자동화 파이프라인 · 내부/외부 링크 체커 · Mermaid 로컬 사전 렌더 · Scratch/Inbox 워크플로우 · 종료 프로젝트 자동 숨김 컨벤션 · 보안 스크러빙 지침 · 사이드바 프로필 · 접기/펼치기 등 hover. 각 기능마다 '기본 상태에서 뭐가 부족했는가 → 어떻게 해결했는가 → 결과' 3단 구조. 살아있는 문서라 새 기능 추가 시 계속 확장 예정."
pubDatetime: 2026-07-10T05:15:00Z
tags:
  - 블로그
  - astro
  - astropaper
  - 프로덕트
  - 기획
  - 개발방식
  - 살아있는-문서
draft: false
featured: true
---

이 블로그는 **[AstroPaper](https://github.com/satnaing/astro-paper)** 를 기반으로 시작했지만, 그대로 두지 않았다. 2026-05 부터 시작해서 **매일 발행하는 1인 콘텐츠 시스템** 관점에서 두 달 남짓 부딪히면서 얹은 기능들을 정리한다. 각 항목은 **"AstroPaper 기본 상태에서 뭐가 부족했나 → 어떻게 해결했나 → 결과"** 3단으로.

> **왜 이런 글을 쓰나:** 이 블로그의 코드는 [GitHub](https://github.com/dpcivl/dev-blog) 에 공개되어 있는데, 정작 **왜 이런 결정들을 내렸는지** 는 커밋 메시지에 흩어져있어서 한 번에 볼 수가 없다. 이 문서를 그 컨텍스트 로그로 삼는다.
>
> **살아있는 문서** — 새 기능이 추가되면 아래에 계속 append. 마지막 갱신 정보는 하단 참고.

## Table of contents

## 시작점 — AstroPaper 는 훌륭하지만 개인 프로덕트로는 부족했다

**AstroPaper 가 잘 하는 것:**

- 마크다운 기반 정적 사이트, 빠르고 SEO 친화
- 태그 · 검색 (Pagefind) · RSS · 아카이브 기본 탑재
- 다크/라이트 테마, 깔끔한 타이포그래피
- Astro 5 최신, 프레임워크 학습 곡선 완만

**하지만 내가 원한 건:**

- 매일 학습 로그를 쌓는 곳 → **주제별 시리즈 탐색** 이 필요
- 국내 지향이지만 x/구글로 외국 방문자 유입 → **KR + EN 이중 언어**
- 인터랙티브 콘텐츠 (용어 시뮬레이션) → **플레이그라운드** 라우트
- 종료된 프로젝트/시리즈를 삭제 없이 감추기 → **소프트 숨김 컨벤션**
- 발행 후 회수 못 하는 실수 방어 → **보안 스크러빙 · 링크 체커 · 발행 시각 필터**
- 반복 작업 자동화 → **번역 · 링크 · Mermaid 파이프라인**

**총론:** 블로그를 "포스트를 저장하는 사이트" 가 아니라 **콘텐츠 발행 시스템** 으로 보기 시작. 도구 · 컨벤션 · 스크립트가 매 발행 반복의 마찰을 줄이도록 계속 얹었다.

## 얹은 것들 (문제 → 해법 매핑)

### 1. 시리즈 페이지 `/series` — 접기/펼치기

- **문제**: AstroPaper 는 태그 기반이지만 "이 주제를 처음부터 순서대로 읽고 싶다" 는 흐름이 없었다. 태그 페이지는 시간 순서지만 시리즈의 정체성 (제목/설명/편수) 이 없음.
- **해법**:
  - `src/pages/series/index.astro` — 하드코딩된 `SERIES` 배열이 `id` · `title` · `description` · `tag` 를 정의
  - 각 시리즈는 태그로 필터링 → 자동으로 그 시리즈에 편입
  - **접기/펼치기** (`<details>/<summary>`) 로 시리즈 4개가 페이지를 잡아먹지 않게
  - Chevron 은 open 시 90° 회전 + accent 색
- **결과**: [LLM 공부 (19편)](/series) · 백엔드 공부 · AGV 자율주행 · 바이브코딩 용어 4개 시리즈가 한 페이지에 압축. 클릭 한 번으로 편 목록 확장. JS 0 (`<details>` 만)

### 2. 플레이그라운드 `/playground`

- **문제**: 용어 설명 글을 쓰면 "이 상태는 hover, 이 상태는 disabled" 같은 걸 텍스트로만 설명해야 함. 독자가 감을 잡기 어려움.
- **해법**: 별도 라우트 `/playground/` 로 인터랙티브 페이지를 분리
  - UI 용어 playground (버튼 상태 · 애니메이션 · duration · easing 을 hover · 클릭으로 체험)
  - DB 용어 playground (정규화 Update Anomaly · B-tree 검색 · 트랜잭션 rollback 시뮬레이션)
  - API 설계 playground
- **결과**: 용어 정리 글이 있고 그 밑에 "[playground 로 체험하기]" 링크 → 텍스트 + 인터랙션 조합

### 3. i18n — KR + EN 이중 언어

- **문제**: 국내 방문자가 주지만 x (트위터) 통한 외국 유입 + 구글 검색 유입이 있음. 영어 없이 이탈.
- **해법**:
  - 콘텐츠 컬렉션을 `src/data/blog/ko/` + `src/data/blog/en/` 로 분리
  - 라우트 미러: `/en/posts/`, `/en/tags/`, `/en/about`
  - `hreflang` 태그로 검색엔진에 언어 대응 표기
  - 사이드바 KO/EN 스위처 (현재 언어 하이라이트)
  - `getPath()` 유틸이 파일 경로에서 언어 접두어를 붙임/제거
  - PostDetails · Tag · Sidebar 컴포넌트가 `Astro.url.pathname` 으로 언어 감지 → 라벨 자동 스위칭
- **결과**: 한 번의 발행으로 두 언어 사이트가 동기화. 발행 부담은 KR 만 씀. EN 은 자동 (아래 4번).

### 4. Sonnet 5 번역 자동화 파이프라인

- **문제**: 42편의 KR 포스트를 EN 으로 옮기려면 수동은 불가능. 신규 글도 발행 즉시 EN 필요.
- **해법**: `scripts/translate/` 아래 파이프라인
  - **모델**: Claude Sonnet 5 (인트로 프라이싱 $2/$10 per MTok)
  - **프롬프트 캐싱**: 시스템 프롬프트를 캐시로 마킹 → 반복 호출 시 90% 절감
  - **6개 validator** — 코드 블록 개수 · 링크 URL · 이미지 경로 · heading 구조 · HTML 태그 · 길이 비율
  - **Anchor 자동 재작성**: KR heading slug (`#인터페이스--규격만-정하고-구현은-상속받는-쪽`) → EN heading slug 자동 매핑 (같은 위치의 heading 을 찾아 slug 계산)
  - **CLI**: `pnpm translate one <slug>` · `pnpm translate batch`
- **결과**: 편당 $0.05 로 EN 사이트 자동 유지. 총 44편 번역에 $2 이하. 편차 없는 톤 · 링크/이미지 무결성 검증까지 자동.

### 5. 링크 체커 — 내부 + 외부

- **문제**: 발행 후 slug 리팩터링하면 옛 anchor 링크가 죽음. 외부 링크는 시간 지나면 404 (예: alistair.cockburn.us 개편으로 삭제됨). 사람 눈으로는 못 잡음.
- **해법**:
  - **`pnpm links`** (내부, ~1초): post/anchor/asset/tag/route 5축 검증
    - `/posts/x` — 파일 존재?
    - `/posts/x#anchor` — heading slug 매칭? (`github-slugger` 로 정확히 계산)
    - `/assets/...` — public/ 아래 파일?
    - `/tags/x` — 실제 사용된 태그?
    - `/about`, `/portfolio`, `/playground` — 라우트 존재?
  - **`pnpm links:external`** (외부, ~30초): HEAD → 405/403/501 이면 GET fallback → timeout/transient 시 backoff retry × 2 → bot-blocked 호스트 (st.com, ragas 등) 는 error 대신 warn
- **결과**: 첫 실행에서 **깨진 anchor 13건** (KR 실오류 1 + EN 파이프라인 갭 12) + **외부 404 1건** 자동 발견. 이후 매 발행 전 clean 유지.

### 6. Mermaid 로컬 사전 렌더

- **문제**: `remark-mermaidjs` 를 Astro 파이프라인에 넣었더니 **Vercel 배포에서 Chromium 실행 실패로 본문이 통째로 유실** (로컬 100KB → 라이브 15KB, H1 만 남음). 로컬에서는 정상.
- **해법**: `scripts/render-mermaid.mjs`
  - 로컬에서 Playwright + `mermaid-isomorphic` 로 SVG 생성
  - 콘텐츠 SHA256 hash (앞 16자) 로 파일명 → `public/assets/mermaid/<hash>.svg`
  - MD 의 ```` ```mermaid ```` 블록을 `<img src="/assets/mermaid/<hash>.svg" ...>` 로 자동 재작성
  - 첫 줄 `%% alt: ...` 로 접근성 (mermaid 는 `%%` 를 주석 처리해서 렌더에 영향 없음)
  - Orphan 감지 (참조 없는 hash 파일) + `--gc` 로 정리
- **결과**: **방문자 렌더 지연 0, 클라이언트 JS 0.** Vercel 은 Chromium 안 태우고 이미지만 서빙. 이 사고와 회복 과정 자체가 이 파이프라인이 왜 필요한지 설명하는 학습 케이스가 됨.

### 7. Scratch / Inbox 워크플로우

- **문제**: 반쯤 쓴 메모를 어디에 두고 언제 발행할지 매번 헷갈렸다. inbox 를 텍스트로만 관리하니 어디까지 처리됐는지 안 보임.
- **해법**:
  - **`src/000-inbox.md`** — 짧은 메모 저장소. 세션 시작 시 Claude 가 "처리 대기" 영역만 스캔 → 자동 발행 시도. 처리된 항목은 취소선 + 발행 링크 붙어 "처리 완료" 로 이동.
  - **`src/scratch/`** — 긴 자유 형식 메모. `.gitignored` (로컬 전용). **명시적 지시** 때만 처리 (`"scratch/X 정리해서 올려줘"`).
  - **`src/scratch/published/`** — 발행 완료 아카이브. 최상단에 `<!-- 📤 발행됨: ... -->` 태그.
- **결과**: `ls src/scratch/` 한 번으로 "뭐가 작성 중이고 뭐가 발행됐는지" 파악. 발행 마찰 대폭 감소.

### 8. 종료 프로젝트/포스트의 소프트 숨김 컨벤션

- **문제**: 포트폴리오 프로젝트가 종료됐을 때 삭제하면 링크 · 기록 · 검색 인덱스가 다 죽음. 그렇다고 노출하면 "지금도 하고 있나?" 오해.
- **해법**: **`_` 접두어 파일명 컨벤션**
  - Astro Content Collections glob 로더 패턴: `**/[^_]*.md`
  - `_edgebook.md` 같이 접두어 붙이면 컬렉션에서 자동 제외
  - 파일은 유지, 페이지만 숨김 → 향후 부활도 파일명 되돌리기 한 번
  - Frontmatter 에 `status: paused` + `period: "2026-06-08 ~ 2026-06-19"` 로 종료 정보도 보존
- **결과**: 종료 프로젝트 (EdgeBook) 를 삭제 없이 페이지에서만 숨김. 기록은 그대로.

### 9. 발행 시각 필터 — 미래 pubDatetime 자동 제외

- **문제**: `pubDatetime` 을 미래로 실수 설정하면 dev 서버에선 보이는데 프로덕션에선 조용히 숨겨짐. "발행됐다고 착각" 문제.
- **해법**: `src/utils/postFilter.ts` 의 `isPublishTimePassed` 필터가 프로덕션 빌드에서 미래 시각 포스트 제외
- **결과**: 실수해도 프로덕션 배포까지 도달하지 못함. dev 화면 확인 후 발행됐다 착각하는 함정 방어.

### 10. 보안 스크러빙 지침

- **문제**: 공개 GitHub + Vercel 배포라 본문/에러 로그/스크린샷/frontmatter 어디든 시크릿 · PII · 사내 URL 노출 시 즉시 회수 불가.
- **해법**: **`CLAUDE.md § 🔴 보안 스크러빙`**
  - 절대 금지 목록 (API 키 · JWT · OAuth secret · supabase URL · 카드 · PII)
  - 발행 전 grep 의심 패턴 (32자리 hex, `eyJ` prefix, `sk-*`, `Bearer` 근처 등)
  - 조치 흐름 — 마스킹만으로 부족한 경우 **키 재발급 우선**
  - 메모 인용 원칙: "한 줄씩 읽으면서 이게 외부 노출돼도 되는가 체크 후 옮긴다"
- **결과**: 자동화되진 않았지만 매 발행마다 리마인더 강제. 이번 세션에서 이 지침 덕분에 실제로 몇 건 걸러냈다.

### 11. 사이드바 · Featured · 시리즈 태그 시스템

- **문제**: AstroPaper 기본은 홈이 최신 글 리스트만. 대표작을 강조할 방법 없음. 시리즈 편입은 수동 태그.
- **해법**:
  - **`featured: true`** frontmatter → 홈페이지 상단 별도 섹션
  - **사이드바 프로필** — 아바타 · 이름 · 롤 · 소셜 (GitHub · 이메일 · RSS) · 언어 스위처를 왼쪽 고정
  - **시리즈 태그** — `LLM공부` · `백엔드공부` · `AGV` · `용어정리` 같은 전용 태그 → `/series` 페이지가 자동 편입
- **결과**: 편집 없이 컨벤션만으로 콘텐츠 큐레이션. 대표작 5편 항상 홈 상단.

### 12. 리디자인 — 톤과 리듬

- **문제**: 기본 AstroPaper 는 다크/미니멀. 개인 톤이 없음.
- **해법**:
  - **Pretendard** 폰트 (CDN 동적 서브셋, 한국어 가독성)
  - 접기/펼치기 (`<details>/<summary>`) 를 시리즈뿐 아니라 긴 TOC · 확장 정보에 활용
  - Hover effects (accent 색 전환) 로 인터랙션 리듬
  - Design log (`docs/design-log.md`) — Phase 별 결정 누적
- **결과**: 개인 톤 확립 + 결정 히스토리 보존. Phase 1 (레이아웃) → Phase 7 (i18n UI) 로 이어짐.

### 13. SEO 강화 — JSON-LD 구조화 데이터 페이지 유형별 분기

- **문제**: 기본 상태에서는 모든 페이지가 `@type: BlogPosting` JSON-LD 를 emit. 홈페이지 · 시리즈 · 태그 페이지도 "블로그 글" 로 잘못 마킹됨. `description` · `publisher` · `mainEntityOfPage` · `inLanguage` 같은 표준 필드도 누락.
- **해법**: `src/layouts/Layout.astro` 의 `structuredData` 를 페이지 유형에 따라 분기
  - 포스트 (`pubDatetime` 있음) → **BlogPosting** + `description` · `url` · `mainEntityOfPage` · `inLanguage` · `publisher` 필드 추가
  - 그 외 (`pubDatetime` 없음) → **WebSite** 스키마
- **결과**: 구글 리치 스니펫에서 저자 · 발행일 · 언어 정확 인식. 홈페이지가 잘못 article 로 마킹되던 문제 해결.

### 14. Perf — 이미지 lazy loading + PNG → WebP + 폰트 preload

세 축 동시 최적화:

- **문제**: 스크린샷 위주 포스트의 초기 페이지 로드가 무거움 (`public/assets/posts/` 총 62 MB). 아카이브 · 태그 페이지에서 목록 스크롤 시 뷰 밖 이미지까지 즉시 로드. Pretendard CSS 는 렌더링 차단.
- **해법**:
  - **커스텀 rehype 플러그인** ([`src/plugins/rehype-image-perf.mjs`](https://github.com/dpcivl/dev-blog/blob/main/src/plugins/rehype-image-perf.mjs)) — 첫 이미지는 `loading="eager" fetchpriority="high"` (LCP 후보), 나머지는 `loading="lazy" decoding="async"`
  - **`pnpm images:webp`** — sharp 로 PNG → WebP 일괄 변환 스크립트. WebP 가 더 작을 때만 교체 (일부 소형 스크린샷은 PNG 가 오히려 압축률 좋음), MD 의 이미지 URL 도 자동 갱신, 원본 삭제
  - **Pretendard CSS `<link rel="preload">`** 로 폰트 CSS 조기 취득 → 렌더링 차단 완화
- **결과**: `public/assets/posts/` **62 MB → 15 MB (75% 감소, 61개 변환)**. 목록/태그 페이지 스크롤 시 뷰 밖 이미지 지연 로드 → 첫 뷰 페인트 개선. LCP 후보 이미지는 여전히 우선순위 유지.

### 15. 포스트 하단 피드백 CTA — 댓글 시스템 없이 채널만

- **문제**: 이 블로그는 학습 일지 성격이라 댓글창을 붙일 정도의 상호작용 압력이 없다. 그런데 About 페이지는 nav · sidebar · footer 어디서도 링크되지 않아서 사실상 이력서 · 채용용 랜딩으로만 쓰이고, 방문자가 오류 지적 · 보충 의견을 남길 창구가 사이드바 이메일 아이콘 하나뿐이었다. 아이콘이 작아 존재를 인지하기 어렵다.
- **해법**: [`src/components/Feedback.astro`](https://github.com/dpcivl/dev-blog/blob/main/src/components/Feedback.astro) — 각 포스트 하단에 dashed border 박스. 두 개의 액션만 병렬 배치.
  - **① 이메일 pill (클릭 = 복사)** — 이메일 주소 자체가 버튼. Clipboard API + "복사됐어요!" 시각 피드백 (배경 accent 반전 + 체크 아이콘) · 실패 시 텍스트 selection 폴백. GitHub · Vercel · Notion 이 쓰는 표준 패턴.
  - **② GitHub Issue 열기** (제목 prefill)
  - `mailto:` 는 국내 사용자 상당수가 안 쓰므로 배제. Gmail 컴포즈 URL 도 초기엔 뒀다가 뺐음 — 이유는 Naver/Kakao 메일 사용자에겐 무의미, Gmail 사용자도 결국 복사→붙여넣기가 자연스러워서 UI 중복.
  - i18n 대응 (KO/EN 문구 분기). 인트로 카피는 "질문 · 코멘트 · 다른 시각 환영합니다" — 능동형으로 부정/긍정 피드백 둘 다 받는 시그널.
- **결과**: 댓글 시스템의 JS 로드 · 스팸 · 모더레이션 · 유령방 문제 없이 실질 피드백 채널만 확보. 성능 손실 0. 방문자가 "여기 저자에게 말할 수 있는 곳" 을 명시적으로 인지.
- **참고**: 댓글 (giscus 등) 은 트래픽이 붙고 실제 피드백 압력이 생길 때 재검토. 지금은 CTA 만으로 충분하다는 판단.

## 공통 원칙

기능들을 관통하는 4가지:

1. **발행 마찰 최소화** — 메모에서 발행까지 클릭 · 결정 수를 계속 줄인다. Inbox/Scratch 워크플로우 · 번역 자동화 · Mermaid 사전 렌더 다 이 축.
2. **회수 못 하는 실수 방어** — public git 에 한 번 나가면 되돌리기 어렵다. 보안 스크러빙 · 링크 체커 · pubDatetime 필터 · 종료 프로젝트 소프트 숨김 다 이 축.
3. **1인 리뷰어 부재 대체** — 팀엔 리뷰어가 있지만 1인엔 없다. 검증기 · 링크 체커 · [Claude Code 2-에이전트 워크플로우](/posts/solo-dev-kit-two-agent-workflow) 로 기계에 위임.
4. **재활용 킷 관점** — 매 기능이 스크립트 + 컨벤션 조합. `.claude/agents/` · `CLAUDE.md` 골격 · scripts/ 스크립트들 그대로 다른 프로젝트에 옮길 수 있게 설계.

## 앞으로 (여기부터 계속 append)

- **자동 orphan 이미지 감지** — `public/assets/posts/` 아래에 참조 없는 이미지 정리
- **번역 파이프라인의 mermaid 라벨 번역** — 현재는 EN 포스트도 mermaid 다이어그램 라벨이 KR (verbatim 정책). alt 텍스트 · description 만 번역
- **playground 확장** — 자바 컬렉션 · Spring Boot 요청 흐름 시각화 등
- **RSS 카테고리 분리** — 언어별 · 시리즈별 RSS
- **댓글/구독** — Giscus 검토 중이었음. 우선순위 낮음

## 이 문서에 대해

- **최초 발행**: 2026-07-10
- **살아있는 문서** — 새 기능이 붙을 때마다 위 목록에 append + 하단 갱신 기록 한 줄
- **소스**: [`src/data/blog/ko/blog-beyond-astropaper-what-i-added.md`](https://github.com/dpcivl/dev-blog/blob/main/src/data/blog/ko/blog-beyond-astropaper-what-i-added.md)

### 갱신 기록

- **2026-07-10** — 초판. 12개 기능 정리 (시리즈 · 플레이그라운드 · i18n · 번역 자동화 · 링크 체커 · Mermaid · Scratch/Inbox · 소프트 숨김 · pubDatetime 필터 · 보안 스크러빙 · Featured/시리즈 태그 · 리디자인)
- **2026-07-10** (2차) — SEO 강화 (JSON-LD 페이지 유형별 분기 · 표준 필드 보강) + Perf 3종 (rehype 이미지 lazy loading · PNG → WebP 스크립트 · Pretendard CSS preload) 추가. README 도 AstroPaper 원본에서 커스텀으로 교체.
- **2026-07-10** (3차) — 포스트 하단 피드백 CTA (`Feedback.astro`) 추가. 댓글 시스템 없이 이메일 · GitHub Issue 로 실질 채널만 확보.
- **2026-07-10** (4차) — 피드백 CTA UX 를 국내 사용자 기준으로 개편. `mailto:` 대신 "주소 복사 (Clipboard API)" + "Gmail 로 쓰기" + "GitHub Issue 열기" 3-트랙. 이메일 주소는 텍스트로 노출 + `user-select: all` 로 클릭 한 번 전체 선택. `docs/analytics-log.md` 관측 로그 신설 (첫 30일 스냅샷: Visitors 168 · Pages/Visitor 7.8 · Bounce 45%).
- **2026-07-10** (5차) — 피드백 CTA 슬림화. Hick's law 관점에서 옵션 줄임. 이메일 pill 자체가 클릭 = 복사 (GitHub · Vercel · Notion 표준 패턴), copy 아이콘 → check 아이콘 스왑. Gmail 버튼 · 별도 "주소 복사" 버튼 · 이메일 라벨 전부 제거. 인트로 카피도 "오류/보충" defensive → "질문 · 코멘트 · 다른 시각 환영" 능동형으로.
- **2026-07-10** (6차) — 사이드바 이메일 아이콘도 클릭 = 복사로 통일. `mailto:` href 는 폴백용으로 유지 (Clipboard API 실패 시 원 mailto 동작). fixed toast (bottom-center) 로 "이메일 주소가 복사됐어요" 알림. Ctrl/Cmd/Shift/Alt+click 은 native 동작 유지 (새 탭 등). 사이트 전체에서 이메일 UX 일관성 확보.
