# Park Hyoin — 개발 학습 & 프로젝트 로그

> **https://parkhyo.in**

임베디드 SW · AI Agent · Vibe coding 관련 학습과 사이드 프로젝트를 매일 기록하는 개인 기술 블로그의 소스 저장소.

## 스택

- **[Astro 5](https://astro.build/)** + **[Tailwind CSS 4](https://tailwindcss.com/)** ([AstroPaper](https://github.com/satnaing/astro-paper) 테마 기반)
- **[Vercel](https://vercel.com/)** 배포
- **[Claude Sonnet 5](https://claude.com/product/claude-code)** 자동 EN 번역 (Anthropic API + 프롬프트 캐싱)

## 이 블로그의 커스텀 기능

AstroPaper 기본에서 매일 발행하면서 부딪힌 지점들을 도구로 만들었다. 자세한 이유와 결정 로그는 [블로그 글 — AstroPaper 기본에서 더 얹은 것들](https://parkhyo.in/posts/blog-beyond-astropaper-what-i-added/) 에 정리.

**개요:**

| 영역 | 기능 |
|---|---|
| **콘텐츠 탐색** | 시리즈 페이지 (접기/펼치기), 플레이그라운드 (인터랙티브 용어 시뮬레이션), 포트폴리오 (unlisted) |
| **i18n** | KR + EN 이중 언어, hreflang, 사이드바 스위처 |
| **자동화** | KR → EN 자동 번역 파이프라인 (검증기 6종 + anchor 재작성), 로컬 mermaid 사전 렌더, 링크 체커 (내부/외부) |
| **워크플로우** | Inbox / Scratch 발행 시스템, 보안 스크러빙 지침, 종료 프로젝트 소프트 숨김 (`_prefix`) |
| **디자인** | Pretendard 폰트, `<details>` 접기/펼치기, `docs/design-log.md` 결정 로그 |

## 로컬 개발

```bash
pnpm install
pnpm dev              # dev 서버 (localhost:4321)
pnpm build            # 프로덕션 빌드
```

## 유용한 스크립트

```bash
pnpm links            # 내부 링크 검증 (post/anchor/asset/tag/route)
pnpm links:external   # 외부 링크 HTTP 프로브 (retry + bot-blocked 화이트리스트)
pnpm translate one <slug>       # 단일 포스트 KR → EN 번역
pnpm translate batch            # EN 파일 없는 모든 KR 포스트 일괄 번역
pnpm mermaid:render   # ```mermaid``` 블록 → static SVG 로 사전 렌더
pnpm mermaid:gc       # 참조 없는 hash SVG 정리
```

## 프로젝트 구조

```
src/
├── data/
│   ├── blog/
│   │   ├── ko/         # 한국어 포스트 (주 콘텐츠)
│   │   └── en/         # 영어 포스트 (자동 번역)
│   └── portfolio/      # 포트폴리오 (unlisted 컬렉션)
├── pages/
│   ├── posts/          # /posts, /posts/[slug]
│   ├── en/             # /en/posts, /en/tags, /en/about
│   ├── series/         # 시리즈 페이지
│   ├── playground/     # 인터랙티브 실험
│   └── portfolio.astro # 포트폴리오 그리드
├── layouts/
├── components/
└── config.ts
scripts/
├── translate/          # KR → EN 번역 파이프라인 (Sonnet 5)
├── check-links.mjs     # 내부 링크 검증
├── check-links-external.mjs # 외부 링크 프로브
└── render-mermaid.mjs  # 로컬 mermaid 사전 렌더
docs/
└── design-log.md       # 디자인 리디자인 결정 로그
```

## 라이센스 · 크레딧

- **테마**: [AstroPaper](https://github.com/satnaing/astro-paper) by Sat Naing (MIT)
- **콘텐츠 (`src/data/blog/`, `src/data/portfolio/`)**: © 2026 Park Hyoin — All rights reserved
- **코드 (커스텀 스크립트, 컴포넌트, 설정)**: MIT

## 컨택

- 이메일: dpcivl713@gmail.com
- GitHub: [@dpcivl](https://github.com/dpcivl)
- 블로그: https://parkhyo.in
