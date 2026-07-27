---
title: "presearch — 검색량이 급증했지만 주가는 조용한 국내 중형주를 찾는 워치리스트"
type: side
status: in-progress
period: "2026-07-22 ~"
role: "1인 개발 · AI 페어 프로그래밍(Claude Code, 설계·구현·QA·리뷰 역할 분리)"
techStack:
  - Python
  - FastAPI
  - pandas
  - BigQuery
  - Cloud Run
  - Cloud Scheduler
  - Secret Manager
  - React 18
  - TypeScript
  - Vite
  - Tailwind CSS
  - lightweight-charts
  - Firebase Hosting
  - pytest
  - Vitest
description: >
  KOSPI·KOSDAQ 시가총액 101~300위 400개 종목을 대상으로, 네이버 검색어 트렌드와 주가를
  매일 수집해 "검색 관심은 늘었는데 주가는 아직 조용한" 종목을 추려 보여주는 도구다.
  Cloud Scheduler가 매일 08시(KST) Cloud Run Job을 실행해 검색량·주가·거래대금을 BigQuery에
  적재하고, Cloud Run의 FastAPI가 이를 읽어 React 프론트에 전달한다. 종목 간 비교나 순위는
  쓰지 않고 각 종목의 자기 시계열 안에서만 급증을 판정한다. 매수·매도 추천과 목표가는
  표시하지 않으며, 금지 표현이 코드에 들어가면 테스트가 실패하도록 게이트를 두었다.
highlight:
  value: "33.6초 → 0.58초"
  label: "API 첫 응답 시간(/api/meta) · 캐시 미스 상태 대비 개선 후 첫 요청 · 로컬 macOS에서 curl 실측, 2026-07-28"
outcomes:
  - value: "33.6초 → 0.58초"
    label: "API 첫 응답(/api/meta). 캐시 TTL을 데이터 갱신 주기(1일)에 맞추고 기동 시 프리로딩·stale-while-revalidate 적용. 로컬 curl 실측, 배포 전후 동일 엔드포인트 비교(2026-07-28)"
  - value: "1,526건"
    label: "자동 테스트(Python 1,110 + 프론트 416). 로컬 pytest·vitest 실행 기준(2026-07-28). 이 중 1건은 날짜를 하드코딩한 기존 테스트 실패로 백로그 등재 상태"
  - value: "864 → 144회/일"
    label: "BigQuery 조회 횟수. TTL 10분→1시간 변경에 따른 계산값(실측 아님). 6개 테이블 × 하루 갱신 횟수 기준"
relatedPosts:
  - presearch-daily-collection-target-date-assumption
links:
  # 저장소는 비공개라 github 링크 없음
  demo: "https://presearch-kr.web.app"
order: 22
---
