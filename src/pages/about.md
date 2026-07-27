---
layout: ../layouts/AboutLayout.astro
title: "About"
---

**박효인 (Park Hyoin)**

임베디드 HW 1년 · 임베디드 SW 2년 2개월 (2022-10 ~ 2025-12). 지금은 [줄곧](https://julgot.com) 과 [이 블로그](https://parkhyo.in) 를 만들고 운영하며, Spring Boot · PostgreSQL 학습 일지를 [시리즈](/series) 로 쓰고 있습니다.

<div class="cta-box">
  <a href="/portfolio" class="cta-btn cta-primary">
    <span class="cta-icon">📁</span>
    <span>포트폴리오 보기</span>
  </a>
  <a href="https://github.com/dpcivl" target="_blank" rel="noopener noreferrer" class="cta-btn">
    <span class="cta-icon">💻</span>
    <span>GitHub</span>
  </a>
  <a href="mailto:dpcivl713@gmail.com" class="cta-btn">
    <span class="cta-icon">📧</span>
    <span>이메일</span>
  </a>
</div>

## 경력

**이전 직장** (환경 계측 · 임베디드 AI R&D) · 2022-10 ~ 2025-12
임베디드 HW 엔지니어 → 임베디드 SW 엔지니어

문과 출신입니다. C 언어를 독학해 정보처리산업기사를 취득했고, 회사의 임베디드 SW 코드를 읽으려고 Python 을 익혔습니다. SW 담당자가 퇴사한 뒤 임베디드 SW 유지보수를 인수했습니다.

- **강우량계 데이터로거 HW** — OrCAD 기반 회로 설계와 PCB 테스트·디버깅을 담당했습니다. 전원부 발열 칩을 데이터시트 레퍼런스대로 교체해 발열 문제를 해결하고 생산팀에 양산 이전까지 완료했습니다 (영업 부진으로 양산 단계는 진행되지 않았습니다).
- **강우량계 데이터로거 SW** — 0.3초 polling 기반 bounce 검출 로직을 스레딩 기반으로 교체했습니다. MQTT 구조를 파악해 대시보드와 로거의 값이 어긋나는 문제를 JS 코드 수정으로 해결했고, 10분 단위 강우량 데이터 항목을 새로 추가했습니다.
- **엣지 AI 화재 감지** — NXP iMX8M Plus · iMX93 개발보드의 NPU 로 객체 감지를 돌리고, Roboflow 공개 화재 데이터셋으로 전이학습한 뒤 태블릿 영상으로 검출을 검증했습니다. mAP 85.50% (IoU 0.50 기준 · fire AP 86.22% / smoke AP 84.79%).
- **LoRa 통신 적합성 테스트** — RAK7248 게이트웨이 + RAK3272S 노드로 무인 운영 테스트 장치를 구성했습니다 (노드는 SD 카드에 송신을 기록하고, 게이트웨이는 MQTT 토픽으로 수신을 검증). 공원 도보 이동 측정에서 약 2km 지점부터 데이터 손실이 시작되는 것을 확인했습니다.
- **마을방송 수신기 펌웨어** — GD32 메인 칩을 PlatformIO + PowerWriter 디버거로 부팅·페리페럴 검증까지 진행했습니다. LVGL UI 개발 중 연구소 폐쇄로 종료됐습니다.

## 지금 하고 있는 것

- **[줄곧 (Julgot)](https://julgot.com)** — 잘한 것만 기록하는 일기 앱. Next.js (PWA) + Supabase Edge Functions (Deno) 스택. 2026-07-13 웹 PWA v0.3.2 를 배포하고 베타 테스트 중입니다. → [배포 1일차 회고](/posts/julgot-launched-day-1-retrospective)
- **[이 블로그](https://parkhyo.in)** — Astro 5 + Tailwind CSS 4 + Vercel. 디자인 방향 · 정보 구조 · 발행 워크플로우는 직접 결정하고, 코드 구현은 Claude Code 와 페어 프로그래밍으로 진행했습니다. → [얹은 기능 정리](/posts/blog-beyond-astropaper-what-i-added)
- **학습 일지** — Spring Boot (REST · JPA · 트랜잭션 · 내장 톰캣/스레드풀 · JVM/GC) 와 PostgreSQL · SQL 기초를 [시리즈](/series) 로 정리하고 있습니다. ([Spring Boot](/tags/spring-boot) · [자바](/tags/java) 태그)

## 연락

- GitHub — [@dpcivl](https://github.com/dpcivl)
- Email — dpcivl713@gmail.com
- Blog — [parkhyo.in](https://parkhyo.in)
