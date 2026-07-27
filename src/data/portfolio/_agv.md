---
title: "AGV 자율주행 프로토타입"
type: side
status: in-progress
period: "진행 중"
role: "1인 개발 · AI 페어 프로그래밍"
techStack:
  - Raspberry Pi 5
  - STM32 F407
  - ROS2 Humble
  - RS485
  - MAX485
  - L298N
  - A3144 엔코더
  - UART
  - PWM
description: "실내 자율주행 AGV (Automated Guided Vehicle) 프로토타입. 라즈베리파이 5 가 ROS2 상위 제어 (/cmd_vel) 를 담당하고, STM32 (F407) 가 RS485 로 명령을 받아 모터·엔코더·안전회로를 처리하는 2층 구조."
relatedPosts:
  - agv-prototype-log-04
  - agv-prototype-log-03
  - agv-prototype-log-02
  - agv-prototype-log-01
links:
  github: "https://github.com/dpcivl/agv-portfolio"
order: 30
---
