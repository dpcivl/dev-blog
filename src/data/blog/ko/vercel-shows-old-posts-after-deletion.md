---
title: "Vercel이 옛날 글을 계속 보여준 이유 — 빈 컨텐츠 컬렉션 함정"
description: "샘플 포스트를 모두 지우고 push 했는데도 Vercel 배포본에는 이전 글이 그대로 남아있던 현상을 추적했다."
pubDatetime: 2026-05-05T13:00:00Z
tags:
  - astro
  - vercel
  - 트러블슈팅
draft: false
featured: false
---

AstroPaper 템플릿으로 블로그를 새로 세팅하면서 만난 이상한 현상을 기록한다.

## Table of contents

## 상황

블로그를 내 것으로 만들기 위해 다음 작업을 했다.

1. 사이트 제목·설명·소셜 링크 등 개인 정보로 변경
2. 홈 화면 hero 영역의 "Mingalaba" 인사를 한국어로 교체
3. AstroPaper에 딸려오던 **샘플 포스트 17개를 전부 삭제**
4. 모든 변경사항을 commit & push

로컬 dev 서버(`npm run dev`)에서는 의도대로 글 목록이 비어있는 깔끔한 화면이 나왔다. 그런데 Vercel에 배포된 사이트를 열어보니 이런 모습이었다.

![push가 끝났는데도 옛날 샘플 글들이 그대로 보이는 화면](/assets/posts/vercel-shows-old-posts-after-deletion/01-old-posts-still-visible.webp)

Hero 섹션의 한국어 인사("안녕하세요 👋")는 적용됐는데, **Featured 섹션에는 지웠던 샘플 글 3개가 그대로 보였다.** "How to configure AstroPaper theme", "Adding new posts in AstroPaper theme", "AstroPaper 5.0".

## 1차 검증 — 코드는 정말 깨끗한가

가장 먼저 의심한 건 push 누락. 하지만 원격 저장소를 직접 확인해보니 정확히 들어가 있었다.

```bash
$ git ls-tree origin/main src/data/blog/
100644 blob e69de29...    src/data/blog/.gitkeep
```

`.gitkeep` 외에는 아무것도 없다. 원격 코드는 깨끗하다.

로컬에서 직접 빌드를 돌려봤다.

```bash
$ npx astro build
...
[content] Synced content
[WARN] [glob-loader] No files found matching "**/[^_]*.md" in directory "src/data/blog"
...
The collection "blog" does not exist or is empty.
...
✓ Completed in 1.45s.
[build] 7 page(s) built
[build] Complete!
```

`The collection "blog" does not exist or is empty` 메시지가 무섭게 보이지만 **fatal error가 아니라 정보성 로그**다. 실제로 7개 페이지가 정상 생성되며 빌드는 성공으로 끝났다. 생성된 `dist/index.html`을 grep해봐도 "Featured", "Recent Posts", 옛 글 제목 어느 것도 흔적이 없었다.

> 즉 **로컬 빌드 결과물은 완전히 깨끗**했다. 문제는 Vercel 쪽.

## 2차 시도 — 임시 포스트로 강제 트리거

원인을 정확히는 모르겠지만, 컨텐츠가 **0개**라는 상태가 어떤 식으로든 빌드/배포 파이프라인의 엣지 케이스를 건드린 것 같았다. 그래서 단순한 가설을 세웠다.

> "포스트를 하나라도 만들어서 push하면, Vercel이 새 빌드를 정상적으로 배포하지 않을까?"

임시로 `hello-world.md` 한 개를 작성해서 push했다. 결과:

![임시 포스트 push 후 옛 글들이 사라지고 새 포스트만 보이는 화면](/assets/posts/vercel-shows-old-posts-after-deletion/02-resolved-after-temp-post.webp)

**옛날 샘플 글 3개가 전부 사라지고 새 포스트만 노출됐다.** 가설이 맞았다.

## 정리

- **로컬 dev 서버 / 로컬 build 산출물은 처음부터 깨끗했다.**
- **Vercel에 배포된 사이트만** 옛날 글을 계속 서빙하고 있었다.
- 컨텐츠 0개 상태에서는 그 현상이 사라지지 않았고, 포스트를 하나라도 추가해서 push 하니 즉시 해결됐다.

`git`에는 의도한 변경이 정확히 들어가 있었음에도, **호스팅 단계에서 결과가 다를 수 있다**는 것을 직접 확인한 사례였다.

## 더 공부해볼 것

이번에는 "임시 포스트 push"라는 우회로 해결했지만, 아래는 아직 남은 의문들이다. 근본 원인을 짚어보고 싶을 때 따라가볼 학습 거리.

### 1. Astro 컨텐츠 컬렉션이 비어있을 때 빌드 동작
- `glob` loader가 매칭 파일이 0개일 때 출력하는 `WARN`은 어디서 어떻게 처리되는가
- `getCollection("blog")` 가 빈 배열을 반환할 때, 페이지 생성에는 정말 영향이 없는가
- 참고: [Astro Content Collections 공식 문서](https://docs.astro.build/en/guides/content-collections/)

### 2. Vercel의 "Skipped Build" / "No changes" 동작
- Vercel은 어떤 조건일 때 새 배포를 만들지 않고 이전 배포를 alias만 옮기는가
- `pagefind` 단계나 `cp -r dist/pagefind public/` 단계가 실패하면 Vercel이 어떻게 처리하는가 (이전 배포 fallback?)
- 의심 지점: 빌드 스크립트의 `pagefind --site dist` — 인덱싱할 컨텐츠가 0개일 때 정상 종료하는지
- 참고: [Vercel Deployment Lifecycle](https://vercel.com/docs/deployments/overview)

### 3. CDN/Edge 캐시
- Vercel Edge가 정적 자산을 어떤 정책으로 캐싱하는가
- 새 배포 후 CDN 무효화는 즉시 일어나는가, 점진적인가
- 빈 컬렉션으로 빌드된 `index.html`이 어떤 이유로 캐시 무효화 대상에서 빠질 수 있는가

### 4. Pagefind 동작
- 빌드 스크립트의 `pagefind --site dist` 가 인덱싱할 마크다운이 0개일 때 어떻게 끝나는가 (exit code 0인지 1인지)
- `&&` 체이닝 때문에 한 단계라도 실패하면 그 뒤의 `cp -r` 도 실행 안 됨 → 빌드 산출물이 불완전해질 수 있음

### 5. 진단을 더 빨리 하려면
- Vercel Deployment 로그를 끝까지 읽는 습관
- "왜 안 되지" 보다 "정확히 어디까지 됐고 어디서 멈췄는지" 를 먼저 보는 사고
- 다음에 같은 일이 생기면 의심 순서: ① 원격 git 상태 → ② 로컬 빌드 산출물 → ③ Vercel 빌드 로그 끝부분 → ④ 배포된 commit hash

## 회고

원격 저장소와 로컬 빌드 산출물을 직접 검증해서 "내 코드는 맞다"는 걸 확정한 다음, 호스팅 쪽 이슈로 좁혀가는 흐름이 이번 디버깅의 핵심이었다. 처음에 dev 서버 캐시 탓으로 의심하느라 시간을 좀 썼는데, 다음부터는 **원격 + 로컬 빌드 결과물 검증**을 첫 단계로 두자.
