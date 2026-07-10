---
title: "AGV 사이드 프로젝트 일지 1편 — 프레임 조립부터 ROS2 설치까지"
description: "포트폴리오용 자율주행 자동차 사이드 프로젝트 1편. 라즈베리파이 5 + STM32 + RS485 조합으로, 오늘은 프레임 조립과 Pi 5 OS 세팅, ROS2 Jazzy 설치까지. 의존성 깨짐을 universe·noble-updates 저장소 추가로 해결한 기록 포함."
pubDatetime: 2026-06-17T04:00:00Z
tags:
  - AGV
  - 자율주행
  - ros2
  - raspberry-pi
  - 임베디드
  - 사이드프로젝트
  - 포트폴리오
draft: false
featured: false
---

포트폴리오용 자율주행 자동차 사이드 프로젝트를 시작했다. 거창하진 않고, 라즈베리파이 5 위에서 ROS2 를 굴리고 RS485 통신으로 모터 제어를 해보는 정도. 오늘이 1편이다.

> **약어 풀이**
> - **AGV** (Autonomous Guided Vehicle): 산업용 자율주행 운반 로봇의 표준 용어. 본 프로젝트의 컨셉
> - **ROS2** (Robot Operating System 2): 로봇 소프트웨어 표준 미들웨어. 노드 간 메시지 통신·서비스·액션 제공
> - **RS485**: 산업용 시리얼 통신 규격. 노이즈에 강하고 다중 장치 연결(half-duplex) 가능

## Table of contents

## 하드웨어 구성

- **메인 보드**: 라즈베리파이 5 (Pi OS 64-bit Desktop)
- **MCU**: STM32 — 모터 제어 / 센서 인터페이스 담당
- **통신**: Pi 5 ↔ STM32 = UART (장기적으로 RS485 변환)
- **(보류) Jetson Nano**: SLAM · 비전을 같이 넣고 싶었는데 너무 구형이라 다른 프로젝트로 미룸

## 1. 프레임 조립 — 오랜만의 납땜

오래전에 주문해놓고 방치했던 프레임을 오늘 꺼냈다.

![AGV 프레임 부품들 — 모터, 바퀴, 알루미늄 프로파일 등](/assets/posts/agv-prototype-log-01/01-agv-frame-parts.png)

납땜기로 집에서 납땜하고 나사를 조였다. 오랜만에 잡은 인두라 그런지, 집에서 처음 납땜한 것도 처음이라, 뭔가 **냉납된 것 같은 느낌**이 살짝 있긴 하다. 일단 고정은 됐으니 동작 확인 단계에서 다시 판단할 예정.

![조립이 끝난 AGV 프레임](/assets/posts/agv-prototype-log-01/02-agv-frame-assembled.png)

## 2. 회상 — STM32 환경 세팅은 기록을 못 했다

엊그제 STM32CubeIDE + CubeMX 환경을 세팅하고 LED 까지 깜빡였는데, **그때는 기록하는 습관이 안 잡혀서 로그를 못 남겼다.** 이제부터는 작업할 때 이렇게 로그 파일을 열어놓고 진행하기로. 그래야 내가 개발한 흐름을 빠짐없이 기록할 수 있다.

(STM32CubeIDE 2.0부터 CubeMX 가 분리된 이슈는 [이전 글](./stm32-cubeide-cubemx-separation) 에 별도로 정리해뒀다.)

## 3. 오늘의 블로커 — USB-UART 컨버터

UART 기능을 테스트해보려고 했는데 **USB-UART 컨버터가 없어서 주문 대기.** 오늘이 아니라 내일 도착이라 😢, 그 사이에 다른 작업으로 우회.

## 4. 라즈베리파이 5 OS 세팅

배터리 쪽 조립도 절연테이프·열수축 튜브가 없어서 막혔고, 멀티미터 배터리까지 떨어져서 — **Pi 5 쪽 세팅으로 방향 전환.**

Raspberry Pi Imager 로 OS 굽기 시작. 그런데 사용자 지정(advanced options) 탭에 불이 안 들어왔다.

![Pi Imager 사용자 지정 탭이 비활성 상태인 화면](/assets/posts/agv-prototype-log-01/03-pi-imager-mistake.png)

> 서버 버전을 선택한 줄 알았는데 **데스크탑 버전을 선택한 초보적 실수.** 일부 옵션이 데스크탑 이미지에선 의미가 없어서 탭 자체가 비활성화된 것.

OS 종류 다시 확인 후 진행.

![Pi Imager 에서 정상적으로 사용자 지정 가능한 상태](/assets/posts/agv-prototype-log-01/04-pi-imager-fixed.png)

## 5. 첫 부팅 + SSH 연결

전원 연결 직후 — **처음에는 녹색 LED 가 깜빡이지도 않고 그냥 켜졌다.** 뭔가 이상해서 한번 전원 빼고 재시도. 두 번째엔 정상적으로 깜빡였다.

<video src="/assets/posts/agv-prototype-log-01/05-rpi5-boot-led-blink.mp4" autoplay muted loop playsinline width="100%"></video>

LED 깜빡임이 끝난 후 부팅이 완료됐다고 판단해서 SSH 연결 시도. 그런데 또 막힘.

> **WiFi 네트워크 mismatch**: Pi 5 의 WiFi 는 거실 공유기 SSID 로 설정했는데, 정작 내 데스크탑은 **다른 공유기와 랜선으로 연결**돼있어서 같은 네트워크가 아니었음. 둘 다 같은 네트워크로 정렬한 뒤 SSH 연결 확인.

![SSH 로 Pi 5 에 정상 접속된 터미널 화면](/assets/posts/agv-prototype-log-01/06-ssh-connected.png)

## 6. ROS2 Jazzy 설치

업데이트·업그레이드 후 리부트. 본격적인 ROS 작업 진입.

순서대로:
1. **로케일 UTF-8 확인**
2. **Universe repository 활성화**
3. **ROS2 GPG 키 + 저장소 추가**
4. **`ros-jazzy-desktop` 설치**

그런데 4번에서 막힘. **의존성이 깨져서 설치 실패.**

![apt 가 의존성 해결을 못 해 ROS2 설치가 중단된 에러 출력](/assets/posts/agv-prototype-log-01/07-ros-install-dependency-error.png)

원인 파악:
- `apt update` 출력에 `noble`, `noble-security` 만 잡혀있고 **`noble-updates` 저장소가 빠져있음**
- 그래서 일부 dev 패키지의 일치 버전을 못 받아와서 의존성이 안 맞음

해결:
- `noble-updates` 저장소를 sources 에 추가
- `sudo apt update && sudo apt upgrade` 로 누락된 업그레이드 적용
- 이후 `sudo apt install ros-jazzy-desktop` 다시 시도 → **성공**

![ROS2 Jazzy 패키지 설치가 정상적으로 끝난 출력](/assets/posts/agv-prototype-log-01/08-ros-install-success.png)

## 7. ROS2 워크스페이스 셋업

`colcon build` 등 기본 워크스페이스 세팅 진행. `build/`, `install/`, `log/` 폴더가 정상적으로 생성된 것까지 확인.

(여기서부터 실제 ROS 노드를 작성하는 건 다음 편에서 — 일단 환경만 세웠다.)

## 추가로 알아본 것

### Universe repository 가 뭔가

Ubuntu 의 소프트웨어 저장소(repository) 4종 중 하나.

| 저장소 | 성격 |
|---|---|
| **Main** | Canonical 이 공식 지원 + 보안 업데이트 책임지는 자유 소프트웨어 |
| **Universe** | **커뮤니티가 유지보수**하는 자유 오픈소스 |
| **Restricted** | 독점 드라이버 등 |
| **Multiverse** | 라이선스/법적 제약 있는 소프트웨어 |

ROS 설치 과정에서 Universe 가 등장하는 이유: **ROS 가 의존하는 일부 패키지가 Universe 에 있기 때문.** ROS 공식 설치 가이드에 활성화 단계가 명시돼있다.

### GPG 키가 뭔가

> 패키지의 **출처와 무결성**을 검증하기 위한 암호화 서명 키.

`apt install` 할 때 "이 패키지가 정말 ROS 공식 저장소에서 온 게 맞는지" 를 검증하는 용도. GPG 키 없이는 (또는 키가 깨졌으면) apt 가 안전성 보장을 못 해 설치를 거부한다.

## 오늘 한 것

- AGV 프레임 조립 (납땜 + 나사 조임)
- Raspberry Pi 5 OS 설치 (사용자 지정 포함 재시도)
- Pi 5 첫 부팅 + SSH 연결 (WiFi mismatch 해결)
- ROS2 Jazzy 설치 (noble-updates 누락 → 추가 해결)
- ROS2 워크스페이스 기본 셋업 (`colcon build` 동작 확인)

## 다음 할 것 (USB-UART 컨버터 도착하면)

- STM32 ↔ Pi 5 **UART 통신 테스트** (간단한 echo 또는 LED 토글 명령)
- ROS2 첫 노드 작성 — publisher / subscriber 패턴 익히기
- 배터리 회로 조립 (절연테이프·열수축 튜브 마련 후)

## 더 공부해볼 것

### 1. ROS2 핵심 개념

- **Node / Topic / Service / Action** 의 차이와 언제 어떤 걸 쓰나
- **DDS (Data Distribution Service)** — ROS2 의 underlying 통신 미들웨어
- **rclpy vs rclcpp** — Python 노드 vs C++ 노드 작성 비교
- 참고: [ROS2 공식 튜토리얼](https://docs.ros.org/en/jazzy/Tutorials.html)

### 2. RS485 통신

- UART 와 차이 (전기적 신호 방식: TTL vs differential)
- half-duplex 의 의미와 마스터/슬레이브 패턴 설계
- Modbus 프로토콜 (RS485 위에 흔히 올림)
- Pi 5 의 UART → RS485 변환 모듈(MAX485 등) 회로

### 3. SLAM / 비전 — 나중에 다시 도전

- Jetson Nano 가 너무 구형이라 보류했지만, Pi 5 + Pi Camera 만으로도 가능한 경량 SLAM 패키지 (RTAB-Map, Cartographer 등) 검토
- 또는 별도 가속기(Coral USB, Hailo) 활용

### 4. 운영 관련

- 라즈베리파이 부팅 패턴(녹색 LED 횟수)의 의미 — 표준 부트 로그 시퀀스가 정의되어 있음
- 시스템d 서비스로 ROS2 워크스페이스 자동 source 등록
- `colcon build` 성능 옵션 (`--symlink-install`, `--parallel-workers`)

### 5. 냉납 검증

> 프레임 조립 때 의심됐던 냉납 부분을 어떻게 검증할까

- 멀티미터로 도통 확인 (저항 측정)
- 부하 걸었을 때 발열·전압강하 측정
- 재납땜 시 인두 온도 / 플럭스 사용 노하우

## 회고

첫 사이드 프로젝트 일지라 톤을 어디까지 풀어야 할지 고민했는데, **시행착오를 그대로 남기는 게 가장 가치 있다**는 결론. ROS2 의존성 깨짐 같은 건 정확히 같은 검색어로 막힌 사람들이 분명 있을 거고, 작성자 본인도 다음에 다른 보드에서 ROS 깔 때 이 글이 가장 빠른 참고가 될 것.

[STM32CubeIDE 글](./stm32-cubeide-cubemx-separation) 에서 시작된 자율주행 트랙이 이제 본격적으로 줄기를 잡기 시작했다. 다음 편은 UART 통신 테스트부터.
