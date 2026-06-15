# portfolio

`/portfolio` 페이지에 노출되는 프로젝트 데이터. 마크다운 파일 하나 = 카드 하나.

## 새 프로젝트 추가하는 법

이 폴더에 `<slug>.md` 파일 추가. frontmatter만 채워도 카드가 나오고, 본문은 비워도 OK.

### 사이드 프로젝트 (`type: side`) frontmatter 예시

```yaml
---
title: "NDT 결함 분류기"
type: side
status: completed          # in-progress | completed | paused
period: "2026-05"          # 단일 시점 또는 "2026-05 ~ 2026-06" 범위
role: "1인 개발"
techStack: [PyTorch, ResNet18, Grad-CAM]
description: "강철 표면 결함 6종 분류 모델 — 전이학습 + 모델 해석성."
cover: "/assets/posts/<slug>/cover.png"   # 선택, 없으면 카드에 이미지 없음
relatedPosts:                              # 선택, 블로그 글 슬러그 (확장자 X)
  - ndt-defect-classification-pytorch-resnet18
links:                                     # 선택
  github: "https://github.com/dpcivl/..."
  demo: "https://..."
order: 10                                  # 같은 섹션 내 정렬 (높을수록 먼저)
---

(본문 마크다운 — 카드의 상세 페이지가 필요하면 작성, 보통 비워둬도 OK)
```

### 경력 (`type: work`) frontmatter 예시

```yaml
---
title: "엣지 AI 영상 분류 시스템 개발"
type: work
company: "이전 직장"        # 회사명 비공개 원칙 — "이전 직장" 통일
period: "2024-03 ~ 2025-12"
role: "임베디드 SW 엔지니어"
techStack: [C, STM32, OpenCV, 객체 인식]
description: "개발보드에서 실시간 화재 감시 모델 추론. 모델 경량화·추론 파이프라인 구축."
responsibilities:
  - C로 STM32 펌웨어 유지보수
  - 엣지 AI 객체 인식 모델 개발보드 통합
outcomes:                  # 선택, 정량 결과
  - "추론 속도 N ms → M ms 단축"
order: 20
---
```

## 페이지 동작 규칙

- 폴더에 .md 파일이 0개면 페이지에 안 노출 (빈 섹션 숨김)
- 섹션 순서: 진행 중 사이드 → 완성된 사이드 → 경력
- 같은 섹션 내에서는 `order` 내림차순 (높은 숫자가 위)
- `_` 로 시작하는 파일명은 무시됨 (드래프트로 활용 가능)

## 노출 정책

이 페이지는 **검색엔진 색인 제외 + 사이트 네비 미노출** 입니다.
- 메인 헤더에 링크 없음
- robots.txt 차단은 안 하지만 `<meta name="robots" content="noindex, nofollow">` 적용
- sitemap.xml 에서도 제외
- URL(`parkhyo.in/portfolio`) 을 직접 알아야 접근 가능

이력서 / 사람인 등 작성자가 의도한 채널에만 URL을 공개하세요.
