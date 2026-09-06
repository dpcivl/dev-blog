---
title: "개인 블로그 인프라 (parkhyo.in)"
type: side
status: in-progress
period: "2026-05-05 ~"
role: "1인 설계·운영 · AI 페어 프로그래밍"
techStack:
  - Astro 5
  - Tailwind CSS 4
  - TypeScript
  - Vercel
  - Pagefind
  - Pretendard
  - Satori (OG 이미지 동적 생성)
description: "이 포트폴리오 페이지가 올라가 있는 사이트 자체. AstroPaper 템플릿에서 출발했지만 표현 계층은 교체했다 — 디자인 시스템·홈·컴포넌트 23개·빌드 스크립트 10개를 직접 만들었고, 물려받아 쓰는 건 콘텐츠 컬렉션과 정렬·태그 집계 같은 데이터 계층 유틸이다. 2026-09 Vercel 에서 AWS Lightsail 자체 운영으로 이전. **디자인 방향, 정보 구조, 발행 워크플로우 결정은 직접 담당**하고 **코드 구현은 Claude Code 와 페어 프로그래밍** 으로 진행. 콘텐츠 컬렉션 기반 발행 워크플로우, RSS·sitemap·JSON-LD·OG 동적 생성 등 SEO 인프라, Pretendard 한글 본문, 사이드바·시리즈·검색·태그·플레이그라운드 페이지 등을 포함. 디자인 결정 13건을 docs/design-log.md 에 누적해 관리."
highlight:
  value: "13건"
  label: "docs/design-log.md 에 누적한 디자인 결정"
relatedPosts:
  - blog-beyond-astropaper-what-i-added
  - vercel-shows-old-posts-after-deletion
links:
  github: "https://github.com/dpcivl/dev-blog"
  demo: "https://parkhyo.in"
order: 15
---
