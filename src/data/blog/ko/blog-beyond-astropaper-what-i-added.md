---
title: "AstroPaper 기본에서 더 얹은 것들 — 블로그를 프로덕트처럼 굴리기"
description: "이 블로그는 AstroPaper 를 그대로 두지 않고 '매일 발행하는 1인 콘텐츠 시스템' 관점에서 계속 확장 중. 어떤 문제에 부딪혔고 어떻게 도구로 만들었는지 정리 — 시리즈 페이지 (접기/펼치기) · 플레이그라운드 · KR/EN i18n · Sonnet 5 번역 자동화 파이프라인 · 내부/외부 링크 체커 · Mermaid 로컬 사전 렌더 · Scratch/Inbox 워크플로우 · 종료 프로젝트 자동 숨김 컨벤션 · 보안 스크러빙 지침 · Markdown 사후 검증기 · 사이드바를 걷은 에디토리얼 리디자인 · 정적 사이트에서 매일 갱신되는 발행 잔디 · 성과 우선 포트폴리오 카드. 각 기능마다 '기본 상태에서 뭐가 부족했는가 → 어떻게 해결했는가 → 결과' 3단 구조. 살아있는 문서라 새 기능 추가 시 계속 확장 예정."
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

이 블로그는 **[AstroPaper](https://github.com/satnaing/astro-paper)** 를 기반으로 시작했지만, 그대로 두지 않았다. 2026-05 부터 시작해서 **매일 발행하는 1인 콘텐츠 시스템** 관점에서 석 달 남짓 부딪히면서 얹은 기능들을 정리한다. 각 항목은 **"AstroPaper 기본 상태에서 뭐가 부족했나 → 어떻게 해결했나 → 결과"** 3단으로.

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
- **이후 변경 (2026-07-27)**: 사이드바와 Featured 섹션은 **17번에서 걷어냈다.** 시리즈 태그 시스템만 그대로 남아 있고, 프로필은 홈 히어로로, 언어 스위처는 헤더로 옮겼다.

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

### 16. Markdown 사후 검증기 — 우발적 strikethrough 감지

- **문제**: GFM 파서가 `~1.5~2주` 같은 숫자 범위 tilde 를 strikethrough (`~text~`) 로 오파싱해서 글자에 취소선이 그어지는 사고. 실제 발행글 3편에서 발견 (`claude-api-streaming-ttft-and-events` · `fems-project-log-01` · `rag-from-scratch-embedding-and-similarity-search`) — 사용자 눈으로만 발견되던 부류라 시스템적 감지 필요.
- **해법**:
  - **컨벤션**: 숫자 범위는 en dash `–` 사용 (예: `1~2일` → `1–2일`). Leading approximate `~` 는 `약` 으로 (예: `~1.5초` → `약 1.5초`). Tilde 는 본문에서 원천 배제.
  - **검증기**: [`scripts/translate/validate.mjs`](https://github.com/dpcivl/dev-blog/blob/main/scripts/translate/validate.mjs) 에 `detectAccidentalStrikethrough(text)` 추가. 코드블록 · inline code · 의도적 `~~strike~~` 제외 후 single-tilde 짝을 스캔. 라인 번호와 스니펫 반환.
  - **번역 파이프라인 통합**: `validateAll(kr, en)` 이 KR/EN 각각 실행. `[KO]` · `[EN]` 프리픽스로 보고. 번역 직후 자동 검출.
  - **Standalone 감사**: [`scripts/check-markdown.mjs`](https://github.com/dpcivl/dev-blog/blob/main/scripts/check-markdown.mjs) + `pnpm check:md` — 전체 발행글 일괄 스캔. CI 통합 가능한 exit code (0/1).
- **결과**: 전체 108개 파일 스캔 → 기존 발행글 3편의 tilde 오파싱 자동 발견 · 수정. 앞으로 번역 시 자동 감지. 라인 번호 정렬을 위해 코드블록 스트라이핑 시 개행 보존 (`m.replace(/[^\n]/g, " ")`) 로 실제 파일 라인과 일치.

### 17. 에디토리얼 리디자인 — 사이드바를 걷고 단일 컬럼으로

- **문제**: 좌측 220px 프로필 사이드바가 **모든 페이지에서 같은 정보를 반복**하면서 본문 폭을 좁혔다. 더 큰 문제는 홈이었다. 최신 글 목록으로 바로 시작해서 **"이 사람이 무엇을 하는가" 를 말하는 문장이 첫 화면에 없었다.** 설명이 200자 넘는 글이 많아 카드 3장이 화면을 다 먹었고, 정작 이 블로그의 자산인 "얼마나 꾸준히 쓰는가" 는 어디에도 안 보였다.
- **해법**:
  - **`page-narrow` 단일 컬럼** (max-w-5xl) 으로 전환. `Sidebar.astro` 와 `page-grid` 유틸 삭제. 대상은 홈 · 포트폴리오 · `/posts` · `/tags` · `/archives` · `/series` · `/playground` · `/404` · 포스트 상세 · About 전부.
  - **좌측 기준선 통일** — 브레드크럼 · 백버튼이 `app-layout`(max-w-3xl 중앙) 을 쓰고 본문은 max-w-5xl 이라 좌측 edge 가 어긋났다. 둘을 같은 컨테이너로 옮기고, 긴 글 페이지는 본문 컬럼을 **중앙 정렬이 아니라 좌측 정렬 + `max-w-app`(48rem)** 으로 제한. 5xl 을 그대로 열면 한국어 한 줄이 1088px 이 되어 가독성이 무너진다.
  - **헤더 재구성** — 로고 36px → 26px + `PARKHYO.IN` 워드마크, nav 축소 + hover 언더라인, 아이콘 24px → 17px. 사이드바에 있던 **KO/EN 스위처를 헤더로 이관** (포스트 상세의 짝 페이지 override 경로도 함께 재배선).
  - **홈 글 목록을 한 줄 인덱스로** — `날짜 | 제목 | 시리즈` (`PostRow.astro`). 노출 3편 → 8편. Featured 섹션 폐지, `featured: true` 는 목록에서 ★ 로만 표시. 목록 페이지(`/posts`)는 골라 읽는 화면이라 카드 유지.
  - **한국어 줄바꿈** — 저장소에 `word-break` 설정이 없어서 `자세한` 이 `자` / `세한` 으로 쪼개졌다. `body` 에 `word-break: keep-all` + `overflow-wrap: break-word` (keep-all 단독은 긴 URL 이 넘친다).
- **결과**: 8개 페이지의 h1 · 본문 좌측 edge 가 1280px 뷰포트에서 모두 139px 로 일치. 375px 가로 오버플로 0. 대신 프로필 사진 · 이름은 홈 히어로와 About 에만 남고, 다른 페이지에서는 헤더 워드마크가 그 역할을 한다.

### 18. 발행 잔디 — 정적 사이트에서 매일 움직이게 하기

- **문제**: 홈에 GitHub 스타일 발행 히트맵을 붙였는데 **8월 1일에서 멈춰 있었다.** 정적 사이트라 "오늘" 이 빌드 시점에 HTML 로 박제되기 때문이다. 마지막 배포가 7/30 이면 그 주 토요일에 고정되고, 새 글을 안 올리면 영원히 안 움직인다. GitHub 은 매 요청마다 서버가 그리니 이 문제가 없다.
- **해법**:
  - **날짜 계산을 브라우저로** — 발행이 있었던 날짜만 담은 맵(`{ "2026-07-30": 2, ... }`, 38일치 약 700바이트)을 `data-counts` 로 심고, 로드 시 방문 시점 기준으로 창을 다시 계산해 셀 레벨 · 툴팁 · `aria-label` · 기간 요약을 갱신한다. **재배포 없이 매일 앞으로 나아간다.**
  - **날짜 키는 KST 고정** — 서버 집계(`SITE.timezone`)와 클라이언트가 같은 기준을 써야 해외 방문자에게 발행 캘린더가 하루씩 밀리지 않는다.
  - **마지막 칸은 오늘** — 처음엔 7행 격자를 꽉 채우려고 그 주 토요일까지 그렸는데, 아직 오지 않은 날짜가 "0편" 셀로 그려지고 툴팁까지 `2026-08-08 · 0편` 으로 떴다. 미발생을 미발행으로 표시한 셈이라 틀렸다. 마지막 열이 짧아지더라도 오늘에서 끊는다.
  - **셀 개수 동기화** — 서버가 그린 칸 수와 방문 시점 칸 수가 다를 수 있어(주 정렬 때문에 91~97 사이에서 오르내린다) 스크립트가 셀을 복제 · 제거해 맞춘다. 없으면 배포가 오래됐을 때 마지막 며칠이 잘린다.
  - **범례는 실제 단계와 같은 수로** — 5칸을 그렸는데 레벨 매핑이 1을 건너뛰어 실제 데이터는 0 · 2 · 3 · 4 네 단계만 썼다. 안 쓰는 색이 범례에 남아 있었다.
- **결과**: 최근 90일 롤링 창. `Date` 를 +30일로 속여 확인했을 때 창이 따라 이동하고 합계가 재계산된다(오래된 글은 창 밖으로 빠지므로 숫자가 줄 수 있다). JS 를 끈 방문자는 빌드 시점 창을 본다 — 서버 렌더 값을 그대로 남겨둬서 빈 화면이 되지는 않는다.

### 19. 포트폴리오 재구조화 — 성과 우선 카드와 게재 기준

- **문제**: 포트폴리오 카드가 기간 / 역할 / 기술 / 설명을 나열하는 `<dl>` 정의 목록이라, **측정된 결과(mAP 85.50%, LoRa 2km)가 설명 문단에 묻혀 있었다.** 채용 담당자가 스캔하는 건 숫자인데. 게재 기준도 없어서 저장소 링크만 있는 프로젝트와 배포된 제품이 같은 무게로 놓였다.
- **해법**:
  - **케이스 블록으로 교체** — 좌측 서술 + 우측 지표(측정값 큰 활자) 2단. 경력은 좌측 sticky 타임라인 + 우측 성과 카드 3열 + 담당 업무 2열 표.
  - **스키마 확장** — `highlight { value, label }` 추가, `responsibilities` 를 `{ k, v }`, `outcomes` 를 `{ value, label }` 객체 배열로. 레거시 문자열도 `z.union` 으로 계속 받고 렌더러에서 정규화한다.
  - **게재 기준** — **접속 가능한 사이트가 있는 것만** `/portfolio` 에 노출. 저장소 링크만 있는 건 `_` prefix 로 숨긴다(파일은 보존). 이 기준을 `CLAUDE.md` 에 규칙으로 박았다.
  - **인테이크 템플릿** ([`docs/portfolio-intake.md`](https://github.com/dpcivl/dev-blog/blob/main/docs/portfolio-intake.md)) — 새 프로젝트 정보를 **그 프로젝트의 Claude 세션에 붙여넣어** 받아오는 프롬프트. 블로그 세션은 그 저장소를 못 보지만 프로젝트 세션은 커밋 · 로그 · 설정을 직접 확인할 수 있다. 홍보 문구 금지 · **수치는 측정 조건 동반** · 시크릿 금지를 프롬프트 단계에서 강제한다.
- **결과**: 카드가 숫자부터 읽힌다. "수치는 측정 조건과 함께" 규칙은 실제로 값을 했는데, 어떤 성능 개선치는 랩 투영값이고 실측은 훨씬 낮았다 — 조건 없이 큰 활자로 세웠으면 과장이 될 뻔했다.

### 20. 다이어그램을 실제로 쓰기 시작했다

- **문제**: mermaid 사전 렌더 파이프라인(6번)을 만들어놓고 **146편 중 3편에서만 쓰고 있었다.** 도구는 있는데 습관이 없었던 셈이다. 특히 항만 도메인 시리즈처럼 프로세스와 계층이 많은 글이 표와 글머리표로만 되어 있어서, 읽어도 구조가 안 그려졌다.
- **왜 영상이 아니라 다이어그램인가**: "글만 있으니 허전하다" 는 진단에서 영상 도입을 검토했는데, 이 블로그에서는 비용이 맞지 않았다. 이미지 62MB → 15MB 최적화(14번)와 정면으로 부딪히고, mermaid 를 Vercel 파이프라인에 넣었다가 본문을 날린 전례(6번)가 있어 렌더 단계를 또 늘리는 것도 부담이다. 무엇보다 **정지 그림이 나은 대상**이었다. 영상이 맞는 자리는 "시간에 따라 변하고 그 변화 자체가 요점일 때" 로 좁혀진다 — 이 저장소의 mp4 두 개(LED 점멸, PWM)가 정확히 그 경우다.
- **해법**: 항만 시리즈 5편에 다이어그램 6개를 넣었다. 항만 구성 계층 · 수출 8단계 · 수입 6단계 · 환적 흐름 · 식별자 계층(MRN → MSN → HSN) · 기관 분산 구조. KO 와 EN 에 **같은 블록**을 넣어 렌더러가 콘텐츠 해시로 같은 SVG 를 공유하게 했다 (11개 블록 → 6개 SVG). 라벨은 기존 정책대로 한국어 유지, `%% alt:` 로 접근성 텍스트를 각각 붙였다.
- **결과**: 클라이언트 JS 0, 방문자 렌더 지연 0 을 유지하면서 구조가 보이게 됐다. 도구를 만드는 것과 쓰는 것은 별개라는 게 이번 교훈이다.

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
- **2026-07-10** (7차) — Markdown 사후 검증기 (`detectAccidentalStrikethrough`) 도입. GFM 이 `~1.5~2주` 같은 숫자 범위 tilde 를 strikethrough 로 오파싱하는 문제. 번역 파이프라인 `validateAll` 에 통합 + standalone `pnpm check:md` 스크립트. 전체 108개 파일 스캔 → 기존 발행글 3편의 tilde 오파싱 자동 발견 후 수정. 컨벤션: 숫자 범위는 en dash `–`, leading approximate 는 `약` 으로.
- **2026-07-28** (8차) — 홈/포트폴리오 에디토리얼 리디자인 (17~19번). 사이드바 · `page-grid` 제거 후 전 페이지 단일 컬럼, 헤더 워드마크 + KO/EN 스위처 이관, 홈 글 목록을 한 줄 인덱스로 (Featured 폐지), 발행 잔디 + 지표 격자 신설, 포트폴리오 카드를 성과 우선 케이스 블록으로 교체하고 `highlight`/`outcomes`/`responsibilities` 스키마 확장. 포트폴리오 게재 기준(라이브 사이트가 있는 것만)과 인테이크 템플릿 신설. `word-break: keep-all` 로 한국어 단어 중간 줄바꿈 차단. 정적 사이트라 빌드 시점에 박제되던 잔디를 클라이언트 재계산으로 전환해 최근 90일 롤링 창으로 만듦.
- **2026-08-04** (9차) — 발행 잔디의 마지막 칸을 오늘로 정정 (18번). 7행 격자를 채우려고 그 주 토요일까지 그렸더니 아직 오지 않은 날짜가 "0편" 셀로 표시됐다. 마지막 열이 짧아지더라도 오늘에서 끊는 쪽이 맞다. 범례도 실제로 쓰는 4단계(0 · 2 · 3 · 4)에 맞춤.
- **2026-08-30** (10차) — 다이어그램 사용 시작 (20번). mermaid 파이프라인이 있는데도 146편 중 3편에서만 쓰고 있었다. 항만 시리즈 5편에 다이어그램 6개 추가 (KO/EN 11블록 → 6 SVG 공유). 영상(Remotion) 도입은 비용·유지비 대비 이득이 낮아 보류하고, 정지 그림으로 해결되지 않는 대상에만 쓰기로 기준을 정했다. README 도 현행화 — 사이드바 스위처 → 헤더, 번역 자동 실행 중단 표기, 잔디·단일 컬럼·성과 카드 항목 추가, 누락돼 있던 `check:md` · `images:webp` 스크립트 보강.
