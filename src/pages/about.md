---
layout: ../layouts/AboutLayout.astro
title: "About"
---

**박효인 (Park Hyoin)**

**임베디드 HW 1년 · 임베디드 SW 2년 2개월** 을 거쳐 지금은 **백엔드 · 자바** 로 방향을 옮기는 중입니다. 장치 안쪽에서 데이터를 만들어 서버로 올려보내는 일을 했고, 이제 그 데이터를 받아 쌓고 서비스하는 쪽을 다루려고 Spring Boot · JPA · JVM 을 파고 있습니다.

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

## 경력 흐름

문과 출신으로 **임베디드 하드웨어 설계**(OrCAD · PCB 테스트·디버깅) 로 커리어를 시작했고, 진로 확장을 위해 **C 언어를 독학** 하고 정보처리산업기사 자격을 취득했습니다.

이후 회사의 임베디드 SW 코드를 읽으려고 Python 을 붙였고, SW 담당자가 퇴사한 뒤 **임베디드 SW 유지보수를 인수**했습니다 (강우량계 데이터로거 SW · 마을방송 수신기 펌웨어 등). 데이터로거의 0.3초 polling 기반 bounce 검출 로직을 스레딩으로 교체하고, MQTT 구조를 파악해 대시보드와 로거의 값이 어긋나는 문제를 잡았습니다.

엣지 AI 연구가 시작되면서는 **NXP iMX8M Plus · iMX93 보드에서 NPU 객체 감지와 Roboflow 공개 화재 데이터셋 전이학습**을 맡아, 보드 위에서 실시간 추론이 되는지를 검증했습니다 (화재 감지 mAP 85.50%).

3년 동안 반복해서 걸린 지점은 장치가 만든 데이터가 서버에 닿은 다음이었습니다. MQTT 브로커 구조, 대시보드와 로거의 값 동기화, 수집 주기 설계 — 문제가 장치 안쪽만으로 끝나지 않았습니다. 그쪽을 제대로 다루려고 백엔드로 방향을 잡았습니다.

## 지금 하고 있는 것

- **백엔드 · 자바** (지금의 주축) — Spring Boot 를 축으로 REST · JPA · 트랜잭션 · 내장 톰캣/스레드풀 · JVM/GC 까지 순서대로 파고드는 학습 일지를 [시리즈로 진행 중](/series). 쿼리를 직접 다루려고 PostgreSQL · SQL 기초도 같이 정리하고 있습니다. ([Spring Boot](/tags/spring-boot) · [자바](/tags/java) 태그에 정리.)
- **[줄곧 (Julgot) — 성취 전용 일기](https://julgot.com)** — 완벽주의 성향에서 자주 보이는 "1등 아니면 0점" 패턴을 거꾸로 — **잘한 것만 기록하는 일기 앱**. 본인의 [완벽주의 회고](/posts/perfectionism-as-a-tool-vertical-slice-development) 에서 출발한 제품. **Next.js (PWA) + Supabase Edge Functions (Deno)** 스택. 2026-07-13 웹 PWA v0.3.2 배포. 네이티브 앱 개발 전 베타 테스트 단계로 지속적으로 유지보수 중 — [배포 1일차 회고](/posts/julgot-launched-day-1-retrospective) 참고.
- **블로그 인프라 자체** — Astro + Tailwind 4 기반. 디자인 방향·정보 구조·발행 워크플로우는 직접 결정하고, 코드 구현은 Claude Code 와 페어 프로그래밍 방식으로 7 Phase 모던 리디자인을 진행. 이 페이지를 포함해 모든 페이지가 그 결과물.

## 관심 분야

- **백엔드** — API 설계 · 트랜잭션과 동시성 · JVM 동작 · 쿼리 성능
- **장치와 서버가 만나는 지점** — IoT 데이터 수집 · MQTT · 엣지에서의 추론. 임베디드 3년의 연장선이자 백엔드를 고른 이유
- **메타인지 · 학습 방법론** — 새 도메인 진입 효율, 어휘 정리, 회고 패턴

## 연락

- GitHub — [@dpcivl](https://github.com/dpcivl)
- Email — dpcivl713@gmail.com
- Blog — [parkhyo.in](https://parkhyo.in)
