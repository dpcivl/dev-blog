---
title: "STM32CubeIDE 2.0부터 CubeMX가 다시 분리됐다 — .ioc 가 안 생기는 이유"
description: "자율주행 사이드 프로젝트를 위해 오랜만에 STM32CubeIDE를 켰는데, 예전처럼 보드를 골랐는데도 .ioc 파일이 생성되지 않았다. 알고 보니 2.0.0부터 CubeIDE와 CubeMX가 다시 별도 도구로 분리됐다."
pubDatetime: 2026-06-15T12:30:00Z
tags:
  - stm32
  - 임베디드
  - 트러블슈팅
  - 자율주행
draft: false
featured: false
---

자율주행 자동차 사이드 프로젝트를 시작하려고 오랜만에 STM32CubeIDE를 다시 설치했다. 예전 기억대로 IDE를 켜고 **board selector** 에서 개발보드를 골랐는데, **.ioc 파일이 생성되지 않았다.** 분명 같은 흐름이었는데 뭔가 빠진 느낌.

찾아봤더니 STM32 생태계 자체가 바뀌어 있었다.

## Table of contents

## 원인 — STM32CubeIDE 2.0.0부터 CubeMX가 분리됐다

**STM32CubeIDE 2.0.0 부터 CubeMX 기능이 다시 별도 도구로 분리됐다.** 그래서 CubeIDE만 깐 상태로는 GUI에서 보드를 골라도 초기화 설정 작업(=`.ioc` 파일 생성과 편집)이 안 된다. 별도로 **STM32CubeMX 를 설치**하거나, CubeIDE 안에서 CubeMX 플러그인을 별도로 추가해야 한다.

## 두 도구의 역할이 사실 다르다

| 도구 | 역할 | 다루는 단계 |
|---|---|---|
| **STM32CubeMX** | 하드웨어 설정 도구 — 칩/보드 선택, 클럭 / GPIO / UART 등 주변장치를 GUI로 설정, 그에 맞는 **초기화 코드 생성** | 프로젝트 시작 단계 |
| **STM32CubeIDE** | 개발 환경 — 실제 **애플리케이션 코드 작성**, 컴파일, 디버깅, 플래싱 | 코드 작성 / 빌드 / 디버그 단계 |

원래는 별개의 도구였는데, 사용 편의를 위해 한때 통합됐었다. 그래서 나도 "올인원이 기본" 인 줄로 알고 있었다.

## 왜 다시 분리됐나

ST의 입장은 대략 이렇다.

- 통합 형태가 **CubeIDE의 리소스를 잡아먹어서** (메모리·실행 속도) 통합으로 얻는 실질적 효율이 떨어졌다.
- 사용자들은 통합보다 **더 나은 디버깅 기능** 과 **VS Code 같은 외부 에디터 지원** 을 더 강하게 원했다.

이 방향성은 합리적이다. 임베디드 개발자들의 실제 워크플로우는 "Cube로 한 번 초기화 코드 만들고, 그 뒤로는 VS Code / CLion 등 익숙한 에디터에서 작업" 인 경우가 많다. 그렇다면 **CubeIDE 자체를 무거운 올인원이 아니라 가벼운 빌드/디버그 도구**로 가져가는 게 자연스럽다.

이번에 설치할 때 **STM32CubeIDE for VS Code** 확장 항목이 보였는데, 분리된 방향성과 일치하는 흐름이다. 나중에 VS Code 쪽 통합 환경도 한 번 써볼 예정.

## 번외 — Project Explorer 가 사라졌을 때

CubeMX에서 초기화 코드를 생성한 뒤 프로젝트 폴더를 열었는데, IDE 좌측에 **Project Explorer 패널이 안 보이는** 상황이 있었다.

![STM32CubeIDE에서 Project Explorer가 보이지 않고 오른쪽 Outline/Build Targets만 떠있는 상태](/assets/posts/stm32-cubeide-cubemx-separation/01-project-explorer-missing.png)

해결: **Window → Perspective → Reset Perspective** 클릭하면 Project Explorer가 돌아온다. Eclipse 기반 IDE의 perspective(작업 공간 레이아웃 프리셋)가 어쩌다 어그러진 상태일 때 흔히 쓰는 복구 방법.

## 더 공부해볼 것

### 1. STM32CubeIDE for VS Code 흐름

- 분리된 환경에서 어떻게 CubeMX 초기화 → VS Code 빌드/디버깅으로 이어지는지 한 번 직접 따라가보기
- 디버거 연결, ST-Link 설정, breakpoint 사용 등이 VS Code에서 얼마나 자연스러운지 검증
- 참고: [STM32CubeIDE for VS Code 공식 안내](https://www.st.com/en/development-tools/stm32cubeide.html)

### 2. HAL vs LL 드라이버

- CubeMX가 생성해주는 코드는 보통 HAL 기반. LL(Low-Layer) 도 옵션
- 어느 쪽을 언제 쓰나, 둘 섞어 쓰는 게 가능한가
- 자율주행처럼 타이밍에 민감한 작업이면 LL 고려할 가치

### 3. Eclipse Perspective 개념

- CubeIDE는 Eclipse 기반이라 "Perspective" / "View" 라는 개념이 있음
- Reset Perspective 외에 흔히 쓰는 perspective: C/C++, Debug
- 익숙해지면 IDE 레이아웃이 깨져도 당황 안 함

### 4. 자율주행 사이드 프로젝트 다음 단계

- 보드 선정 (Nucleo / Discovery / 자체 보드 등) — 어떤 센서·모터를 붙일지에 따라 다름
- 초기 시뮬레이션 환경 (CARLA, Gazebo 등) 도 같이 검토
- 임베디드 단독으로 갈지, Linux SBC(라즈베리 파이) + STM32 조합으로 갈지

## 회고

오랜만에 임베디드 툴체인을 만지니 **생태계가 한 사이클 돌아 있는** 게 느껴진다. 통합 → 분리 → 외부 에디터 지원으로 가는 방향성은 다른 분야(ML 프레임워크, 웹 빌드 도구 등)에서도 자주 보는 패턴이고, **"올인원이 항상 좋은 건 아니다"** 라는 일반적인 교훈으로 정리해두면 다음에 유사한 변화를 만났을 때 덜 당황할 듯.
