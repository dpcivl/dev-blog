---
title: "AGV 사이드 프로젝트 일지 2편 — ROS2 첫 노드 + STM32 PWM LED"
description: "ROS2 talker / listener 패턴으로 첫 노드를 작성하고, geometry_msgs/Twist 로 /cmd_vel 을 받아 좌·우 바퀴 속도로 변환했다. 이후 STM32 에선 TIM4 PWM 설정으로 LED 순환 점등. 두 영역이 어떻게 만날지 감 잡기 시작."
pubDatetime: 2026-06-17T06:30:00Z
tags:
  - AGV
  - 자율주행
  - ros2
  - stm32
  - 임베디드
  - 사이드프로젝트
  - 포트폴리오
draft: false
featured: false
---

[지난 편](./agv-prototype-log-01) 에서 ROS2 Jazzy 설치까지 끝냈다. 이번엔 본격적으로 **첫 노드를 작성**하고, 같은 날 시간을 좀 남겨서 **STM32 쪽 PWM LED 예제**도 같이 했다.

## Table of contents

## 1. ROS2 핵심 어휘 정리

본격 진입 전에 자주 보이는 용어부터 짚었다. **talker**, **chatter** 같은 단어가 자주 등장하는데, 이건 ROS 공식 튜토리얼의 관습 — talker / listener 가 예제 노드 이름, chatter 가 예제 토픽 이름이다.

| 용어 | 의미 |
|---|---|
| **Node** | 독립 실행 프로세스 |
| **Topic** | 노드 간 통신 채널 (이름 + 메시지 타입) |
| **Publisher** | 토픽에 메시지 보내는 쪽 |
| **Subscriber** | 토픽에서 메시지 받는 쪽 |
| **Message** | 토픽으로 흐르는 데이터 단위 (타입이 정해져 있음) |

> ROS2 자체는 처음이지만 **publish / subscribe** 는 [MQTT 작업](./claude-api-multi-turn-context) 등에서 지겹게 다뤄봤던 패턴이라 이해는 어렵지 않았다.

ROS2 공식 패키지에는 **표준 메시지 타입** 이 용도별로 나뉘어 있다 (예: `std_msgs`, `geometry_msgs`, `sensor_msgs`...). 각 패키지 안에 해당 도메인에 맞는 메시지가 들어있다.

## 2. 첫 talker 노드 — chatter 토픽으로 1초마다 발행

학습용이라 **Hello, World 급 예제** 부터.

```bash
ros2 pkg create --build-type ament_python my_agv_pkg
```

![ROS2 talker 패키지 구조 생성 + talker 노드 작성](/assets/posts/agv-prototype-log-02/01-ros2-talker-package-create.png)

`talker` 노드를 만들어서 **`chatter` 토픽에 1초마다 "Hello AGV" 를 보내게** 했다.

그리고 `setup.py` 에 **실행 진입점(entry_points)** 을 등록해야 ROS2 가 `ros2 run` 으로 노드를 실행할 수 있다.

![setup.py 에 entry_points 로 talker 등록한 부분](/assets/posts/agv-prototype-log-02/02-setup-py-entry-point.png)

이후 `colcon build` 로 빌드.

> **`source install/setup.bash` 가 왜 필요한가?**
> 빌드 후 source 를 해야 새로 추가된 패키지를 현재 쉘이 인식한다. setup.bash 스크립트가 `AMENT_PREFIX_PATH` 같은 환경변수를 export 해주는 역할.

다른 터미널에서 같은 토픽을 listen 했더니 1초마다 메시지가 흘러나오는 게 확인됐다.

![talker 가 1초마다 Hello AGV 를 발행하는 출력](/assets/posts/agv-prototype-log-02/03-talker-output.png)

## 3. 표준 메시지 — `geometry_msgs/Twist`

다음으로 **`geometry_msgs/Twist`** 타입을 직접 사용했다. 이건 로봇의 선속도(linear) + 각속도(angular) 를 담는 표준 메시지로, **모바일 로봇 제어의 사실상 표준**.

예제 자체는 talker 와 비슷하지만 의미가 다르다. 이 메시지를 듣고 **모터를 실제로 움직이려면 별도의 모터 제어 노드** 가 필요한데, 그건 STM32 쪽에서 만들 예정. 지금은 메시지 발행만 하고 `ros2 topic echo` 로 흐름을 확인.

![/cmd_vel 토픽을 ros2 topic echo 로 출력한 결과](/assets/posts/agv-prototype-log-02/04-cmd-vel-echo.png)

메시지 타입 구조도 같이 확인.

![Twist 메시지의 구조 — linear (x,y,z) + angular (x,y,z)](/assets/posts/agv-prototype-log-02/05-twist-message-structure.png)

### 빌드 없이 빠르게 publish — `ros2 topic pub`

테스트할 때 매번 노드 빌드해서 돌리는 건 무거우니까, **터미널에서 직접 publish** 하는 방법도 있다:

```bash
ros2 topic pub /cmd_vel geometry_msgs/msg/Twist "{linear: {x: 0.5}, angular: {z: 0.2}}"
```

→ 토픽 동작 검증이나 listener 디버깅에 유용.

## 4. listener — `/cmd_vel` 받아서 좌·우 바퀴 속도 계산

이번 일지의 **가장 의미 있는 부분.** `/cmd_vel` 의 Twist 메시지를 받아 **좌/우 바퀴 속도** 로 변환하는 시뮬레이션을 Python 으로 작성했다.

> 이건 내가 나중에 **STM32 에서 C 로 구현할 코드의 Python 버전**이다.

미분 구동(differential drive) 키네매틱스:
```
left  = linear.x - angular.z * (wheel_separation / 2)
right = linear.x + angular.z * (wheel_separation / 2)
```

![listener 가 /cmd_vel 을 받아 left / right 값을 계산해서 출력하는 화면](/assets/posts/agv-prototype-log-02/06-listener-left-right.png)

`ros2 topic pub` 으로 던진 메시지를 listener 가 받아서 좌·우 속도를 계산했다. **전진(linear.x>0) / 좌회전(angular.z>0)** 같은 동작을 시뮬레이션 가능. 다음에 STM32 가 같은 일을 할 것.

## 5. 잠깐 멈춤 — STM32 PWM LED 예제

ROS 쪽은 여기까지. 시간이 좀 남아서 **STM32 PWM 으로 LED 끄고 켜기** 예제로 손풀기. 예전에 많이 했던 거지만 PWM 감각 살릴 겸.

### CubeMX 에서 막힌 부분

처음에 타이머 설정에서 **PWM Generation CH1 옵션이 비활성** 으로 잡혔다. 핀아웃 단에서 **PD12~PD15 를 TIM4 의 각 채널에 먼저 할당** 했더니 PWM Generation 옵션이 정상적으로 떴다.

![STM32CubeMX 에서 TIM4 PWM 설정과 파라미터 화면](/assets/posts/agv-prototype-log-02/07-stm32cubemx-tim4-pwm.png)

### Prescaler · Counter Period 계산

목표: **1kHz PWM, 1000단계 분해능.**

| 파라미터 | Before → After | 이유 |
|---|---|---|
| **Prescaler** | 0 → 83 | 타이머 클럭을 1MHz 로: `TIM4_clk / (Prescaler+1) = 84MHz / 84 = 1MHz` |
| **Counter Period (ARR)** | 65535 → 999 | PWM 주파수 1kHz + 분해능 1000: `1MHz / (ARR+1) = 1MHz / 1000 = 1kHz` |

> **트레이드오프**: Counter Period 를 크게 하면 분해능은 좋아지지만 주파수가 낮아진다. 반대로 작게 하면 주파수는 높아지지만 분해능이 떨어짐. 목적(눈에 안 보이는 부드러운 LED 디밍)에 맞춰 1kHz/1000단계로 균형.

### 결과 — LED 순환 점등

`main.c` 를 수정해서 PD12 → 13 → 14 → 15 순으로 PWM duty 를 올렸다 내렸다 하도록 했다.

<video src="/assets/posts/agv-prototype-log-02/08-stm32-pwm-led-cycling.mp4" autoplay muted loop playsinline width="100%"></video>

## 오늘 한 것

- ROS2 핵심 어휘 정리 (Node / Topic / Publisher / Subscriber / Message)
- 첫 talker 노드 작성, `chatter` 토픽으로 발행 확인
- `geometry_msgs/Twist` 로 `/cmd_vel` publish & echo
- listener 로 `/cmd_vel` 수신 → 좌·우 바퀴 속도 변환 (Python 버전, 차후 STM32 C 포팅 예정)
- STM32 TIM4 PWM 설정 (1kHz / 1000단계) + LED 순환 점등 확인

## 다음 할 것 (USB-UART 컨버터 도착 후)

- **USB-UART 컨버터 납땜 + UART 통신 확인** (Pi 5 ↔ STM32)
- **모터 드라이버 결선** + 첫 모터 회전
- ROS2 listener 의 좌·우 속도 출력을 **UART 로 STM32 에 전달** 하는 첫 통합

## 더 공부해볼 것

### 1. ROS2 미들웨어 (DDS)

- 왜 ROS1 (TCP/UDP 기반) 에서 **DDS (Data Distribution Service)** 로 옮겨갔는지
- 토픽 발행이 어떻게 자동 디스커버리 되는가 (multicast 기반)
- QoS(Quality of Service) 설정 — Reliable vs Best Effort, History depth 등

### 2. Twist 메시지의 6 자유도

- `linear.x/y/z` + `angular.x/y/z` = 6 DOF
- 차륜형 로봇은 보통 `linear.x` (전진) + `angular.z` (yaw 회전) 만 씀
- 드론처럼 3D 자유 이동 로봇은 6 자유도 다 활용
- 차륜이지만 옴니휠/메카넘휠 쓰면 `linear.y` 까지 추가

### 3. 미분 구동 키네매틱스 정밀화

- 단순 공식 `left/right = lin ± ang * (L/2)` 의 한계
- 휠 슬립, 베이스 폭(`wheel_separation`) 의 실측 보정
- 인코더 피드백으로 closed-loop 제어 (PID)
- **odometry** — 휠 회전 정보로 위치 추정

### 4. STM32 PWM 심화

- 1kHz 외의 흔한 PWM 주파수 — 모터: 10–20kHz (가청 노이즈 회피), LED 디밍: 1kHz 이상 충분
- **Dead time** — 모터 H-bridge 에서 상보 PWM 출력 시 short-through 방지 시간
- DMA + PWM — CPU 부담 없이 패턴 재생 (LED 매트릭스, WS2812 등)

### 5. UART → RS485 변환

- 다음 편의 핵심 주제. UART (point-to-point) 와 RS485 (multi-drop) 의 차이
- MAX485 같은 트랜시버 IC 의 동작 (driver enable, half-duplex)
- 산업 표준 프로토콜 — Modbus RTU 가 RS485 위에 흔히 올림

## 회고

ROS2 의 talker → /cmd_vel → listener 흐름에서 **left/right 값이 실제로 계산되는 순간** 이 오늘의 하이라이트. 그동안 추상적이던 "자율주행 로봇이 명령을 어떻게 받는가" 가 **Twist 메시지 한 줄로 구체화** 됐다. STM32 쪽에서 같은 로직을 C 로 옮기는 작업이 다음 편의 핵심.

**시리즈가 트랙으로 잡혀가는 느낌**이 든다. 1편(설치) → 2편(첫 노드) → 3편(통합) 순서로 자연스럽게 연결되고 있다.
