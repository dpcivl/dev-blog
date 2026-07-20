---
title: "Spring Boot #6 — JVM 메모리·GC 들여다보기, 그리고 커넥션풀 병목 실험"
description: "jps·jstat 로 힙을 관찰하고 GC 로그를 찍어봤다. Young/Old 로 나뉜 힙 구조부터, C 의 수동 메모리 관리와의 대비, 그리고 DB 커넥션풀을 1개로 줄였더니 2초짜리 작업이 6초가 되는 병목을 직접 재현한 기록."
pubDatetime: 2026-07-20T02:20:00Z
tags:
  - 백엔드공부
  - spring-boot
  - jvm
  - gc
  - 성능
  - 학습
draft: false
featured: false
---

[Spring Boot #5 (서블릿 · 내장 톰캣 · 스레드풀)](/posts/spring-boot-log-05-servlet-embedded-tomcat-thread-pool) 에서 스레드풀과 DB 커넥션 풀의 균형 이야기를 했다. 이번 #6 은 그 아래 — **JVM 이 메모리를 어떻게 굴리는지**를 도구로 직접 들여다보고, **커넥션풀 병목**을 실험으로 재현했다.

## Table of contents

## jps 로 PID 찾고, jstat 로 힙 보기

먼저 실행 중인 자바 프로세스를 `jps` 로 찾았다. 거기서 내가 띄운 서버의 **PID** 를 확인한 다음, 그 PID 로 `jstat` 을 걸어 힙 상태를 들여다봤다.

```bash
jstat -gc <PID>
```

![jstat -gc 로 본 JVM 힙 영역별 용량·사용량 (S0C/S1C, EC/EU, OC/OU, MC/MU, YGC 등)](/assets/posts/spring-boot-log-06-jvm-memory-gc-connection-pool-bottleneck/01-jstat-gc.webp)

낯선 약자가 잔뜩 나오는데, 앞 글자를 알면 읽힌다.

- **E** = Eden, **S** = Survivor → 이 둘이 **Young 영역**
- **O** = Old 영역
- **C** = Capacity(용량), **U** = Used(사용량)
- **YGC** = Young GC 횟수, **FGC** = Full GC 횟수, **GCT** = GC 총 소요 시간

즉 `EC`/`EU` 는 에덴의 용량/사용량, `OC`/`OU` 는 올드의 용량/사용량이다.

## JVM 메모리 구조 — Young 과 Old

JVM 메모리는 **힙(heap)** 으로 되어 있고, 크게 **Young 영역(E, S)** 과 **Old 영역(O)** 으로 나뉜다.

왜 굳이 나눠서 관리할까. 프로그램이 돌아가는 동안 **계속 생겼다가 금방 사라지는 임시 객체**가 아주 많다. 이런 것들을 오래 살아남는 객체와 섞어두면 정리하기가 번거롭다. 그래서:

- **Young** — 새로 만든 객체가 태어나는 곳. 대부분 여기서 금방 죽는다.
- **Old** — Young 에서 살아남아 오래 버틴 객체가 넘어가는 곳.

이렇게 **수명에 따라 두 부분으로 나눠** 관리한다.

## 힙이 차면 GC 가 돈다 — 로그로 확인

힙이 가득 차면 **GC(가비지 컬렉션)** 가 일어나 안 쓰는 객체를 치운다. 이걸 눈으로 보려고 GC 로그를 켰다.

```bash
JAVA_TOOL_OPTIONS="-Xlog:gc" ./gradlew bootRun
```

이 상태로 GC 가 일어날 만큼 요청을 여러 번 날렸더니, **GC 가 얼마나 정리했는지**를 보여주는 로그가 찍혔다. 힙이 차고 → GC 가 돌고 → 사용량이 뚝 떨어지는 흐름이 로그에 그대로 남았다.

## C 의 수동 관리와의 대비

가비지 컬렉션 자체는 예전부터 말로는 많이 들어봤다. 임베디드 소프트웨어를 하며 **C** 를 쓸 때는 메모리를 직접 할당(`malloc`)하고 해제(`free`)해야 했다. 이 번거로움 — 그리고 깜빡하면 새는(leak) 위험 — 을 자바는 **GC 로 대신 해결한다**고 배운 적이 있다.

오늘 그걸 실제로 확인한 셈이다. JVM 이 안 쓰는 객체를 알아서 정리해주니, 개발자는 메모리 해제를 일일이 신경 쓰지 않아도 된다. C 에서 손으로 하던 일을 런타임이 대신 해주는 것이다. (물론 "신경 안 써도 된다"가 "공짜"라는 뜻은 아니다 — GC 가 도는 동안의 비용은 따로 있다. 그건 아래 커넥션풀 실험과 같은 결의 이야기다.)

## 커넥션풀을 1개로 줄였더니 2초가 6초

[#5](/posts/spring-boot-log-05-servlet-embedded-tomcat-thread-pool) 에서 "스레드풀과 DB 커넥션풀의 균형"을 말로만 정리했는데, 이번엔 그 병목을 **직접 만들어봤다.**

`application.properties` 를 이렇게 조작했다.

- **스레드풀** — 기본값 그대로, 널널하게
- **DB 커넥션풀** — **딱 1개**로 제한

그리고 **2초짜리 DB 명령을 3개 동시에** 호출했다.

결과: **6초**가 걸렸다. 커넥션이 하나뿐이니 세 요청이 나란히 못 가고 **줄을 서서** 하나씩 처리된 것이다. 2초 × 3 = 6초. 스레드는 널널했지만 **DB 앞에서 병목**이 걸렸다.

그다음 커넥션풀 제한을 풀어주니, 같은 작업이 **2초**로 떨어졌다. 세 요청이 각자 커넥션을 잡고 **동시에** 처리됐기 때문이다.

이게 #5 에서 말한 "일꾼(스레드)을 200명 뽑아놔도 DB 연결이 1개면 190명이 줄 선다"의 실제 재현이었다.

## 회고

이번에도 결론이 지난 글들과 같은 자리로 모였다. [#4 의 N+1](/posts/spring-boot-log-04-transaction-lazy-loading-n-plus-1), [#5 의 스레드풀](/posts/spring-boot-log-05-servlet-embedded-tomcat-thread-pool), 그리고 오늘의 GC·커넥션풀 — 전부 **"편하게 추상화된 것 뒤에서 실제로 무슨 일이 벌어지는가"** 였다.

특히 좋았던 건, 커넥션풀 병목을 **글로 읽은 게 아니라 숫자(2초 → 6초)로 직접 만들어본** 점이다. `jstat`·GC 로그·의도적 병목 실험처럼, 안 보이던 걸 **도구로 보이게 만드는 방법**을 하나씩 손에 넣는 중이다.

## 더 공부해볼 것

- **GC 종류와 Stop-The-World** — 오늘은 GC 가 "돈다"만 봤다. G1 · ZGC 같은 수집기 종류와, GC 중 애플리케이션이 잠깐 멈추는 Stop-The-World 가 실제로 얼마나 되는지. → [Oracle: HotSpot GC Tuning Guide](https://docs.oracle.com/en/java/javase/21/gctuning/index.html)
- **jstat 컬럼 완독** — `MC`/`MU`(Metaspace), `CCSC`/`CCSU`, `CGC` 등 오늘 안 짚은 컬럼들이 뭘 뜻하는지. Metaspace 는 왜 힙과 따로 있는지.
- **적정 커넥션풀 크기** — 1개는 극단이었고, 그럼 몇 개가 맞나. [#5 에서 남긴](/posts/spring-boot-log-05-servlet-embedded-tomcat-thread-pool) HikariCP 풀 사이징 공식을 이 실험 위에 얹어보기. → [HikariCP: About Pool Sizing](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing)
- **커넥션 대기 타임아웃** — 커넥션이 1개뿐일 때 네 번째 요청이 무한정 기다리는지, 아니면 어느 순간 타임아웃으로 실패하는지 (HikariCP `connection-timeout`).
- **메모리 릭이 자바에서도 나나** — GC 가 있는데도 메모리 릭이 발생하는 경우(예: 컬렉션에 계속 쌓기, 리스너 미해제). "GC 가 알아서" 의 예외 상황.
