---
title: "출시 전 하루, 성능을 갈아엎고 — 그리고 결국 못 고친 것 하나"
description: "1인 개발 중인 앱의 출시 하루 전, TTFB 3.15초 → 10ms · LCP 22.1초 → 1.4초 로 갈아엎은 튜닝 회고. 그리고 하루를 태우고도 결국 웹으로는 못 고친 PWA 하단 시스템 바 색 이야기."
pubDatetime: 2026-07-11T07:00:00Z
tags:
  - 성능
  - 트러블슈팅
  - nextjs
  - pwa
  - 회고
  - TTFB
  - LCP
draft: false
featured: false
---

출시를 앞두고 하루를 통째로 성능에 썼다. 기록해두고 싶은 건 잘 된 것만이 아니라, 하루를 삽질하고도 **결국 웹으로는 못 고친 것 하나** 다. 그게 더 남는다.

**결론 먼저**:

- 랜딩 TTFB: **3.15초 → 10ms**
- 랜딩 LCP: **22.1초 → 1.4초** (랩 기준)
- 못 고친 것: 설치형 PWA 하단 시스템 네비게이션 바 색

## Table of contents

## 0. 원칙 — 측정부터

시작할 때 정한 건 하나였다. **추측으로 최적화하지 않는다.** 전날 Lighthouse CI (랩) 와 Vercel Speed Insights (실사용자 지표) 를 붙여뒀고, 첫 측정이 곧바로 범인을 지목했다: **TTFB 3.15초**. 여기가 가장 큰 레버였다.

"느린 것 같다" 는 느낌이 아니라 숫자가 어디를 고칠지 알려줬다. 하루가 헤매지 않은 이유. 이 글에서 제일 하고 싶은 말이기도 하다.

## 1. TTFB 3.15초 → 10ms — 정적이어야 할 것이 동적이었다

원인은 구조에 있었다. **로그아웃 상태의 랜딩 페이지가 로그인 여부 판별하려고 쿠키를 읽고 있었고**, 그 한 줄 때문에 정적이어도 될 페이지 전체가 매 요청마다 서버에서 렌더링되고 있었다. 게다가 로그인 홈은 인증 확인 (`getUser`) 을 프록시 · 레이아웃 · 페이지에서 **세 번 연속 네트워크 왕복** 했다.

고친 방향:

1. **로그아웃 랜딩을 별도 정적 라우트로 분리** — 프록시가 로그아웃 `/` 요청을 그쪽으로 rewrite. 인증 쿠키가 아예 없으면 서버 왕복 없이 바로 처리 → 정적 HTML 이 CDN 엣지에서 서빙된다.
2. **인증 확인을 요청 단위로 한 번만** — React `cache()` 로 dedup.

배포 후 응답 헤더에서 `X-Vercel-Cache: HIT` 을 확인하고 나서야 마음을 놓았다. **3.15초 → 10ms.**

여기서 하마터면 사고가 날 뻔했다. `rewrite` 는 주소는 `/` 인 채 다른 페이지의 메타데이터를 실어 나른다. 그 페이지에 무심코 넣어둔 `noindex` 가 홈페이지에 실릴 뻔했다. 코드 리뷰 단계에서 잡았다. **자동 리뷰 한 겹이 출시 전 SEO 지뢰 하나를 막아준 셈.**

## 2. LCP 22.1초 → 1.4초 — 한글 웹폰트라는 함정

이게 제일 극적이었다. 랜딩의 랩 LCP 가 **22.1초** 로 찍혔다. 처음엔 눈을 의심했다.

범인은 한글 웹폰트였다. 디스플레이용으로 예쁜 한글 폰트를 4가지 굵기로 불러왔는데, 한글은 글자 수가 많아 폰트가 유니코드 구간별로 쪼개진다. 그 결과 랜딩 한 페이지가 **폰트 파일만 288개, 2.4MB** 를 받고 있었다. 느린 네트워크 시뮬레이션에서 이 요청들이 커넥션을 포화시키면서 LCP 를 22초까지 밀어올렸다.

> 참고: 실제 관측 LCP 는 2.3초였다. 22초는 throttling 투영값이라 실사용자가 그대로 겪진 않지만, 2.4MB · 288 요청이 낭비인 건 사실이고 느린 모바일에선 진짜 손해다.

해결은 단순하면서도 확실했다. 랜딩 문구는 고정된 소수의 글자뿐이다. **그 글자들만 담은 서브셋 폰트** 를 만들었다:

- `pyftsubset` 으로 실제 쓰이는 글리프 (232자) 만 추출 → woff2 3개, 53KB
- 안 쓰는 굵기 하나 제외, 구글 폰트 CDN 대신 직접 호스팅 (self-host)

**288 요청 · 2.4MB → 3 요청 · 53KB.** 랩 LCP 는 22.1초에서 1.4초로. 튜닝 후 **랜딩은 앱에서 가장 빠른 페이지** 가 됐다.

새 문구가 추가되면 서브셋을 다시 만들어야 해서, 재생성 스크립트도 리포에 남겨뒀다.

## 3. 탭 전환의 '끊김' — 지표는 멀쩡한데 체감은 나쁠 때

모바일에서 탭을 누르면 잠깐 멈칫하는 느낌이 있었다 ([지난 글에서 파고들었던 그 문제](/posts/debugging-tab-switch-freeze-postmortem)). 그런데 이번에 INP (상호작용 지표) 를 다시 재보니 **8–40ms 로 이미 양호** 했다. 지표는 좋은데 체감은 나쁜, 흔한 상황.

원인은 INP 가 아니라 **네비게이션 지연** 이었다. 특히 앱을 백그라운드에 뒀다가 돌아오면 프리페치 캐시가 만료돼서, 탭을 눌러도 로딩 표시가 즉시 안 뜨고 이전 화면이 말없이 멈춰 있었다.

- **`useLinkStatus` 로 탭을 누른 즉시** 눌린 탭에 하이라이트와 스피너를 띄웠다 (빠른 전환에선 안 뜨게 150ms 지연). "눌렸다" 는 피드백만으로 체감이 확 달라졌다. 실기기에서 확인했다.
- **재방문은 클라이언트 캐시 (`staleTimes`) 로 즉시 표시**. 대신 데이터가 낡아 보이지 않게, 기록을 추가/수정/삭제하는 모든 지점에서 캐시를 무효화하도록 배선했다.

## 4. 하루를 태우고도 못 고친 것

여기가 이 글을 쓰는 진짜 이유다.

설치형 PWA (홈 화면에 추가한 앱) 에서 **하단 시스템 네비게이션 바 영역이 흰색으로 뜨고, 스크롤한 글자가 그 뒤로 희미하게 비쳤다.** 앱 배경은 따뜻한 크림색인데 그 아래만 흰 띠. 브라우저 (크롬) 에서 열면 멀쩡한데, 설치한 앱에서만 그랬다.

크림색으로 만들려고 시도한 것들, 순서대로:

1. `viewport-fit=cover` 로 화면 끝까지 확장 → 흰색 그대로
2. manifest 의 `background_color` / `theme_color` 를 흰색 → 크림 → 효과 없음
3. 하단 safe-area 를 불투명 크림으로 덮는 고정 요소 추가 → 안 덮임
4. 다크모드 자동전환이 문제인가 싶어 라이트 전용으로 고정 → 무관
5. 외부 조언을 받아 `min-height: 100dvh` 로 배경을 동적 뷰포트 전체까지 확장 (이게 빠졌던 마지막 카드였다) → 그래도 흰색

`cover` 를 켰다 껐다를 몇 번이나 반복했다. **커밋 로그가 부끄러울 정도로 왔다 갔다 했다.**

결정적 단서는 이거였다:

> **똑같은 HTML/CSS 인데 브라우저에선 크림, 설치 앱에선 흰색.**

CSS 가 원인이라면 브라우저에서도 똑같이 나와야 한다. 그러니 원인은 코드가 아니라 **렌더링 환경** — 안드로이드가 설치형 PWA (WebAPK) 의 하단 시스템 바를 그리는 방식이었다. 그리고 **그 색은 웹이나 manifest 로 바꿀 수 없다.** (기기 · 안드로이드 버전에 따라 다르고, 이 기기는 웹 신호를 무시했다.)

**결론: 웹 PWA 의 한계.** 시스템 바 색을 확실히 제어하려면 네이티브 래핑 (TWA/Capacitor) 에서 `navigationBarColor` 를 직접 지정하는 수밖에 없다. 그건 다음 메이저 버전으로 파킹했다.

**배운 것**: 실기기에서만 재현되는 문제를, 기기 없이 추측 커밋으로 다섯 번 때린 게 잘못이었다. **"브라우저에선 되는데 설치 앱에선 안 된다"** 는 사실 하나로 진작 **"이건 플랫폼 층"** 이라고 결론냈어야 했다. 웹으로 안 되는 걸 웹으로 계속 미는 건 삽질이다.

## 5. 만들었다가 바로 버린 것 — 로딩 스켈레톤

탭 전환 중 뜨는 "이동 중…" 텍스트를, 페이지 모양을 흉내 낸 회색 스켈레톤으로 바꿔봤다. 요즘 흔한 그거.

써보자마자 별로였다. **탭 사이에 낯선 회색 블록이 번쩍이니 오히려 싸구려처럼 보였다.** 바로 되돌렸다. 짧은 전환에는 담백한 텍스트가 나았다.

교훈은 4번과 짝이 맞는다: **로딩이나 시각 요소를 '좋아 보일 것 같다' 는 감으로 넣지 말 것.** 특히 로컬에서 눈으로 확인이 안 되는 UI 일수록, 실제로 보고 판단하기 전엔 라이브에 올리지 말 것.

## 6. 하루 정리 — 교훈 4가지

1. **측정이 방향을 정한다.** 느낌이 아니라 숫자.
2. **큰 레버는 대개 구조에 있다.** 랜딩이 왜 동적이었나 · 폰트를 왜 통째로 받았나.
3. **안 되는 건 빨리 인정한다.** 웹 PWA 로 시스템 바 색은 못 바꾼다. 다섯 번째 시도가 아니라 두 번째 시도쯤에서 멈췄어야 했다.
4. **감으로 UI 를 늘리지 않는다.** 스켈레톤도, 로딩 로고도, 확인 없이는 안 올린다.

성공한 숫자 (22초 → 1.4초) 보다 **못 고친 것 앞에서 멈춘 판단** 이 더 오래 남을 것 같다.

## 더 공부해볼 것

이 글이 얕게 지나간 것들:

- **Next.js `rewrite` vs `redirect`** — URL 유지 여부 · 메타데이터 전달 · SEO 함정. [Next.js — rewrites](https://nextjs.org/docs/app/api-reference/next-config-js/rewrites)
- **React `cache()`** — Server Component 안에서 요청 단위 dedup. `React.cache` vs `unstable_cache` vs `fetch` cache 차이. [React docs — cache](https://react.dev/reference/react/cache)
- **`X-Vercel-Cache` 헤더 상태** — `HIT` · `MISS` · `STALE` · `BYPASS` · `REVALIDATED` 각각의 의미. [Vercel Edge Network — Caching](https://vercel.com/docs/edge-network/caching)
- **한글 웹폰트 서브셋팅** — `pyftsubset` (fonttools), Unicode range 분할 vs 통합 서브셋, `unicode-range` CSS 프로퍼티. [Google Fonts subset guide](https://developers.google.com/fonts/docs/getting_started#specifying_script_subsets)
- **`font-display` 정책** — `swap` · `optional` · `fallback` · `block`. FOIT vs FOUT 트레이드오프. [MDN — font-display](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display)
- **Next.js `useLinkStatus`** — 링크 pending 상태 감지 훅. Suspense · `loading.tsx` 와의 조합. [Next.js — useLinkStatus](https://nextjs.org/docs/app/api-reference/functions/use-link-status)
- **Next.js Router `staleTimes`** — Client-side router cache TTL 조정. `dynamic` · `static` 세그먼트 각각의 캐시 정책. [Next.js — staleTimes](https://nextjs.org/docs/app/api-reference/next-config-js/staleTimes)
- **Web PWA display modes** — `standalone` · `fullscreen` · `minimal-ui` · `browser` 각각의 시스템 UI 노출 방식. [MDN — display](https://developer.mozilla.org/en-US/docs/Web/Manifest/display)
- **Trusted Web Activity (TWA) vs Capacitor** — Web → Android 네이티브 래핑 옵션. TWA 는 Chrome 위에, Capacitor 는 자체 WebView. `navigationBarColor` 지정 위치가 다름. [Chrome Developers — TWA](https://developer.chrome.com/docs/android/trusted-web-activity)
- **Android WebAPK 렌더링 특성** — 크롬에서 "홈 화면에 추가" 시 생성되는 최소 APK. 시스템 바 처리가 기기/OS 버전마다 다른 이유. [WebAPK Minting](https://web.dev/articles/webapks)
- **INP (Interaction to Next Paint)** — 이번엔 8–40ms 확인 용도로만 썼는데, 상세는 [지난 탭 전환 회고 글의 "더 공부해볼 것"](/posts/debugging-tab-switch-freeze-postmortem#더-공부해볼-것) 참고

*— 출시 전날*
