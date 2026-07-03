---
title: "AGV 사이드 프로젝트 일지 4편 — STM32 UART 송신 + ROS2 launch 파일"
description: "드디어 USB-UART 컨버터 도착. STM32F407 의 USART2 로 1초마다 메시지를 송신하고 PC 시리얼 모니터에서 수신 확인. USART3 을 RS485 용으로 남겨둔 이유, blocking 부터 시작하는 이유, STM32CubeIDE 안에서 시리얼 콘솔 띄우는 법까지. 그리고 ROS2 launch 파일로 노드 두 개 동시 실행."
pubDatetime: 2026-06-19T06:20:00Z
tags:
  - AGV
  - 자율주행
  - 임베디드
  - stm32
  - ros2
  - uart
  - 사이드프로젝트
  - 포트폴리오
draft: false
featured: false
---

[지난 편](./agv-prototype-log-03) 끝에 "USB-UART 컨버터 오면 통신 작업" 이라고 적어뒀던 그게 드디어 도착했다. **오늘은 STM32F407 + UART 컨버터로 PC 시리얼 모니터까지 메시지 흘리는 게 목표.**

## Table of contents

## 1. UART 컨버터 ↔ STM32F407 결선

![USB-UART 컨버터와 STM32F407 결선도](/assets/posts/agv-prototype-log-04/01-uart-converter-stm32-wiring.png)

위와 같이 연결한다. **VCC 핀은 연결하지 않았다** — 컨버터도 3.3V 고 F407 Discovery 가 3.3V 로직 보드라 따로 전원을 줄 필요가 없다. GND / TX / RX 만 결선.

> 결선 방향 주의: 컨버터 TX → STM32 RX, 컨버터 RX → STM32 TX. 한쪽이 보내는 걸 반대쪽이 받아야 하니까 X 자로 교차한다.

### 점퍼 케이블이 앞쪽 헤더에 안 들어감

![점퍼 케이블을 뒤쪽 헤더에 연결한 모습](/assets/posts/agv-prototype-log-04/02-jumper-rear-header.png)

점퍼 케이블이 앞쪽 헤더엔 잘 안 들어가서 뒤쪽에 연결했다. **점퍼 케이블용 헤더는 뒤쪽이 맞는 것 같고**, 앞쪽은 어떤 특정 커넥터 전용인 듯한데 어떤 건지는 못 찾았다 (나중에 확인 필요).

## 2. 왜 USART2 인가? USART3 은 왜 안 쓰는가

코드를 짜기 전에 어느 USART 를 쓸지 정했다.

**USART2 선택 이유:**
- F407 Discovery 보드에서 PA2 (TX) / PA3 (RX) 에 매핑돼 있고 점퍼로 접근하기 편함

**USART3 을 안 쓰는 이유:**
- **USART3 은 RS485 통신용으로 남겨둘 계획.** AGV 의 라즈베리파이 ↔ STM32 통신을 RS485 로 가져갈 거라 USART3 자리를 미리 비워둠.

### Blocking 부터 시작 — DMA + 인터럽트는 나중에

UART 송신은 세 가지 방식이 있다:

| 방식 | 동작 | 적합한 시점 |
|---|---|---|
| **Blocking** | CPU 가 송신 완료까지 멈춤 | 학습용, 짧은 디버그 메시지 |
| **인터럽트** | 송신 완료 시 콜백 | 응답성 필요할 때 |
| **DMA + 인터럽트** | CPU 개입 없이 메모리에서 직접 송신 | 대용량 / 고빈도 통신 |

**일단 blocking 으로 충분.** "Hello AGV" 같은 짧은 메시지 1초마다 보내는 정도라 CPU 가 잠시 멈춰도 무관. **DMA 는 RS485 통신에서 도입할 예정.** 양방향 + 고빈도가 되면 그때 필요해진다.

그리고 변수를 최소화하기 위해 **기존 PWM 코드는 주석 처리** 했다 (지난 편의 LED 순환 점등 부분). 한 번에 한 가지만 보기 위해.

## 3. CubeMX 에서 USART2 활성화

![STM32CubeMX 에서 USART2 를 PA2/PA3 에 활성화한 화면](/assets/posts/agv-prototype-log-04/03-cubemx-usart2-config.png)

- **모드**: Asynchronous
- **Baud rate**: 115200
- **Word length**: 8 bits
- **PA2 → TX**, **PA3 → RX** 자동 할당

설정 후 코드 생성하면 `HAL_UART_Transmit()` 으로 송신 가능.

## 4. STM32CubeIDE 안에서 시리얼 콘솔 띄우기

결과 확인은 Putty 같은 별도 프로그램으로 해도 되지만, **이왕 STM32CubeIDE 를 쓰는 김에 IDE 안에서 어떻게 띄우는지** 찾아봤다.

![STM32CubeIDE Console 탭에서 Command Shell Console 옵션 선택](/assets/posts/agv-prototype-log-04/04-stm32cubeide-serial-console.png)

방법:

1. **Console 탭 → "+" 드롭다운 클릭**
2. **Command Shell Console** 선택
3. **Connection Type 을 Serial 로 변경**
4. UART 컨버터가 잡힌 **COM 포트 지정** (장치 관리자에서 확인 가능)
5. Baud rate, word length 등을 보드 설정과 일치시킴

## 5. 결과 — 메시지 수신 확인

![시리얼 모니터에 Hello AGV 메시지가 1초마다 도착하는 화면](/assets/posts/agv-prototype-log-04/05-serial-message-received.png)

`Hello AGV #N` 메시지가 1초마다 잘 들어왔다. **STM32 → 컨버터 → USB → PC** 라인 검증 완료.

더 하고 싶었지만 케이블이 더 와야 해서 STM32 는 여기까지. 다음엔 양방향 (수신 + echo) 으로 확장.

## 6. ROS2 launch 파일 — 노드 여러 개 한 번에 띄우기

라즈베리파이에서는 ROS2 추가 예제 진행. 오늘 배운 건 **launch 파일.**

### Launch 파일이 뭔가

**여러 노드를 한 번에 실행하는 도구.** 지금까지는 `ros2 run` 으로 노드 하나씩 띄웠는데, 실제 시스템에선 노드가 10개 넘게 동시에 떠야 한다 (모터 제어 / 센서 입력 / 경로 계획 / 안전회로 / 로깅 ...). 하나씩 띄우면 터미널이 10개 필요.

Launch 파일은 그걸 한 파일에 묶어준다.

```python
from launch import LaunchDescription
from launch_ros.actions import Node

def generate_launch_description():
    return LaunchDescription([
        Node(
            package='my_agv_pkg',
            executable='talker',
            name='talker_node',
            output='screen',
        ),
        Node(
            package='my_agv_pkg',
            executable='listener',
            name='listener_node',
            output='screen',
        ),
    ])
```

- `LaunchDescription` 안에 **실행할 액션(노드) 리스트** 를 넣음
- 각 노드에 **패키지 이름 / 엔트리 포인트 이름 / 런타임 노드 이름** 지정
- `output='screen'` 으로 로그를 터미널에 출력

### 시행착오 — 로컬 파일을 수정하고 있었다

복붙 안 하고 타이핑으로 따라 쳐서 그런가 실행 중 오류가 발생했다.

```
launch file not found
```

처음엔 "뭐지?" 했는데, 알고 보니 **SSH 환경 (라즈베리파이) 이 아니라 로컬 환경 (Windows) 의 파일을 수정하고 있었다.** 바본가 싶었지만 누구나 한 번쯤 하는 실수.

VS Code 의 Remote SSH 탭과 로컬 탭이 같이 떠 있으면 헷갈리기 쉽다. 다음부턴 작업 전 파일 경로의 호스트명을 한 번 확인하자.

### 결과 — 두 노드 동시 실행

다시 라즈베리파이 측 파일로 옮겨 수정하고 빌드 후 실행.

![ros2 launch 명령으로 talker 와 listener 노드가 동시에 시작된 화면](/assets/posts/agv-prototype-log-04/06-ros2-launch-two-nodes.png)

두 노드가 동시에 뜨는 걸 확인. 나중에 **micro-ROS** (STM32 위에서 돌아갈 ROS 클라이언트) 와 라즈베리파이 노드들을 launch 하나로 묶을 계획이다. 이게 **실제 시스템 배포의 표준 방식** 이라고 한다.

## 오늘 한 것

- USB-UART 컨버터 ↔ STM32F407 결선 (3.3V 로직이라 VCC 생략)
- USART2 선택 (USART3 은 RS485 용으로 보존)
- Blocking 방식 1초 주기 송신 (`HAL_UART_Transmit`)
- STM32CubeIDE 내장 Command Shell Console 로 시리얼 수신 확인
- ROS2 launch 파일로 talker + listener 두 노드 동시 실행

## 다음 할 것 (다음 월요일)

- **F407 UART 양방향 통신** — 수신 + echo
- **micro-ROS agent + client 셋업** — STM32 가 ROS2 노드 역할을 직접 하게 됨
- 케이블 추가 도착 시 모터 드라이버 결선

## 회고

**계속 학습만 하고 진도는 안 나가는 느낌.** 임베디드라 부품이 안 오는 게 큰 이유긴 한데, 혼자 웹서비스 만들 때와 템포가 너무 차이 나서 좀 어색하다.

다만 한 가지 다른 점: **코드를 AI 에이전트가 바꾸는 게 아니라, 작성된 걸 내가 따라치고 있다.** 그것만으로도 학습에는 도움이 되는 기분. 키보드를 통해 한 번 더 흘러가는 게 머리에 남는 것 같다.

오늘은 몸이 좀 안 좋아서 여기까지. 주말 쉬고 월요일에 이어서.

## 시행착오 모음

### COM 포트가 안 보일 때

USB-UART 컨버터를 꽂았는데 **장치 관리자에 COM 포트가 안 보이는 경우** 가 있다. → 해당 칩셋 (CP210x / FT232 / CH340 등) 의 **드라이버를 설치** 해서 인식하게 한다.

### "Termination of previous launch did not complete successfully"

빌드는 성공했는데 플래시 시도 시 위 에러 발생. **해결:**

1. ST Link 디버그 서버 (`ST-LINK_gdbserver.exe`) 를 작업 관리자에서 **강제 종료**
2. STM32 개발보드의 USB 케이블을 **잠깐 뺐다가 다시 연결**
3. 다시 플래시

ST Link 가 이전 디버그 세션을 정리하지 못한 상태로 남아있을 때 생기는 문제.

## 더 공부해볼 것

### 1. STM32 UART 송신 3가지 방식의 trade-off

- **Blocking (`HAL_UART_Transmit`)** — 간단, CPU 점유
- **인터럽트 (`HAL_UART_Transmit_IT`)** — CPU 비점유, 콜백 처리 필요
- **DMA (`HAL_UART_Transmit_DMA`)** — 대용량/고빈도, 메모리 직접 전송
- RS485 멀티드롭 환경에선 DMA + 인터럽트가 거의 필수가 되는 이유
- HAL 위에서의 callback 흐름 (`HAL_UART_TxCpltCallback` 등)

### 2. USART vs UART 정확한 차이

- **UART** = Universal Asynchronous Receiver/Transmitter — 비동기만
- **USART** = Universal Synchronous/Asynchronous ... — 동기 모드 추가 가능
- STM32 의 "USART" 페리페럴은 둘 다 지원하지만 보통 Asynchronous 모드만 쓰임
- 동기 모드 사용 예시 (SPI 와 유사한 형태)

### 3. Baud rate 115200 의 의미

- 초당 115200 bit 전송
- 실효 데이터 속도 = baud × (data bits / total bits) — start/stop bit 오버헤드 고려
- 더 높은 속도 (921600, 1Mbps 등) 시 케이블 길이·노이즈 영향
- 클럭 정확도 (HSI vs HSE) 가 baud rate 오차에 미치는 영향

### 4. ROS2 launch 파일 심화

- **인자(arguments)** 와 **substitutions** — 런타임에 값 주입
- **조건부 실행** — `IfCondition`, `UnlessCondition`
- **그룹 액션** — namespace 격리, lifecycle 제어
- XML / YAML 형식 launch 파일과 Python 형식의 차이
- [ROS2 Launch 공식 튜토리얼](https://docs.ros.org/en/humble/Tutorials/Intermediate/Launch/Launch-Main.html)

### 5. micro-ROS — STM32 가 ROS2 노드가 되는 메커니즘

- 다음 편의 핵심 주제
- micro-ROS **agent** (PC/Pi 측) ↔ **client** (MCU 측) 구조
- micro-XRCE-DDS 프로토콜 (DDS 의 임베디드용 슬림 버전)
- STM32 + FreeRTOS 위에서 ROS2 토픽을 직접 publish 하는 흐름
