---
title: "이전 직장 — 임베디드 HW → SW 전환 트랙"
type: work
company: "이전 직장 (환경 계측 / 임베디드 AI R&D)"
period: "2022-10 ~ 2025-12"
role: "임베디드 HW 엔지니어 → 임베디드 SW 엔지니어"
techStack:
  - OrCAD
  - C
  - Python
  - JavaScript
  - MQTT
  - TensorFlow Lite
  - Roboflow
  - iMX8M Plus
  - iMX93
  - NPU
  - LoRa
  - GD32
  - PlatformIO
  - LVGL
description: "환경 계측 IoT · 엣지 AI · IoT 통신 R&D 를 한 회사에서 HW → SW 로 옮겨가며 담당. 강우량계 데이터로거 HW·SW, 별도 개발보드 기반 화재 감지 엣지 AI 연구, LoRa 통신 적합성 테스트, 마을방송 수신기 펌웨어 등 5개 프로젝트 수행."
gallery:
  - "/assets/portfolio/prev-job/01-fire-detection-car.png"
  - "/assets/portfolio/prev-job/02-fire-detection-house.png"
  - "/assets/portfolio/prev-job/03-map-results.png"
responsibilities:
  - k: "강우량계 데이터로거 HW"
    v: "전원부 발열 칩 교체 (데이터시트 레퍼런스 적용) 로 발열 문제 해결, 생산팀 양산 이전 완료 (영업 부진으로 양산 단계까지는 미진행)"
  - k: "강우량계 데이터로거 SW"
    v: "0.3초 polling 기반 bounce 검출 로직을 스레딩 기반으로 교체, MQTT 구조 파악 후 JS 코드 수정으로 대시보드↔로거 값 동기화 이슈 해결, 10분 단위 강우량 데이터 항목 신규 추가"
  - k: "엣지 AI 객체 감지 / 화재 감지"
    v: "iMX8M Plus · iMX93 개발보드 NPU 활용 객체 감지, Roboflow 공개 화재 데이터셋으로 전이학습 + 태블릿 영상 활용 검출 검증"
  - k: "LoRa 통신 적합성 테스트"
    v: "RAK7248 (게이트웨이) + RAK3272S (노드) 무인 운영 테스트 장치 구성 (노드: SD 카드 송신 기록 / 게이트웨이: MQTT 토픽 기반 수신 검증), 공원 도보 이동으로 거리·신뢰성 측정"
  - k: "마을방송 수신기 펌웨어"
    v: "GD32 메인 칩 PlatformIO + PowerWriter 디버거 기반 부팅 / 페리페럴 검증, LVGL UI 개발 진행 중 연구소 폐쇄로 종료"
outcomes:
  - value: "mAP 85.50%"
    label: "화재 감지 모델 (IoU 0.50 기준 · fire AP 86.22% / smoke AP 84.79%)"
  - value: "약 2km"
    label: "LoRa 데이터 손실 시작 거리 — 마을방송 수신기 양방향 통신 적합성 검토 근거"
  - value: "polling → 스레딩"
    label: "데이터로거 SW 전환 + 10분 강우량 항목 도입으로 실시간성·운영 가시성 개선"
order: 20
---
