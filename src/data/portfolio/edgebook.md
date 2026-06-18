---
title: "EdgeBook — 데이트레이딩 포지션 사이저 & 손익 트래커"
type: side
status: in-progress
period: "2026-06-08 ~"
role: "1인 개발 (Dogfooding 중)"
techStack:
  - HTML (단일 파일)
  - Vanilla JavaScript
  - Supabase (Auth + DB)
description: "실제 자금 투입 전 트레이딩 가능 여부를 사전 점검하기 위한 본인용 도구. 시드머니 · 하루 손실 한도 · 1회 허용 손실 · 시장 (코스피·코스닥) · 위탁수수료를 설정해두면, 진입가 / 손절가 / 목표가 입력 시 손실비와 왕복 실효 비용을 자동 계산해 적정 포지션 사이즈를 제시. 모의 거래 결과를 날짜별로 누적해 오늘 거래 / 월간 결산 / 승률·실현손익을 추적. 백엔드를 따로 만들지 않고 단일 HTML 파일 + Supabase Auth·DB 로 클라우드 동기화 + JSON 내보내기·가져오기까지 구성. localhost 에서만 띄워 본인이 매일 사용. 향후 데이터가 충분히 쌓이면 AI 기반 손실 패턴 분석 + 트레이딩 습관 컨설팅 기능 도입 예정."
order: 35
---
