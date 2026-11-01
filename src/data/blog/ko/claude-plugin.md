---
title: "플러그인을 만들어보자"
description: "만든 skills를 프로젝트마다 옮기는 작업이 번거로워서 skill과 에이전트를 플러그인으로 묶어 내 컴퓨터에 설치해본 기록"
pubDatetime: 2026-11-01T03:52:00Z
tags:
  - agent
  - 워크플로우
  - AI
  - claude-code
draft: false
featured: false
---

**AI를 사용하여 정리하지 않은 글입니다.**
## 배경
- 만든 skills를 기존 프로젝트에서 사용하거나 새로운 프로젝트에서 사용할 때 옮기는 작업이 번거로웠음
- 방법을 찾다가 플러그인이라는 것을 알게 되어 플러그인을 등록하고 기존 프로젝트에 적용하는 것을 진행하고자 함

## 클로드 플러그인
- Skill, 에이전트, 훅 같은 것들을 하나로 묶어 설치하는 단위
- 플러그인을 설치하면 그 안의 Skill과 에이전트가 한꺼번에 들어옴
- Skill이나 에이전트는 플러그인 없이 사용할 수 있지만 여러 개를 한 묶음으로 팀원과 나누거나 여러 프로젝트에 설치하거나 버전을 매겨 배포하고 싶을 때 플러그인을 사용하면 편함
- /hi-dev-plan 으로 호출하던 스킬을 /hi-dev-pipeline:hi-dev-plan 이런 식으로 호출 하게 됨
- reviewer 에이전트를 hi-dev-pipeline:reviewer로 부를 수 있음

## 스킬 -> 플러그인
- 스킬로 구현했던 것들을 플러그인으로 만들어보려고 함
  - 지난 구현에 대한 내용: https://parkhyo.in/posts/claude-skills/
- 스크립트 경로가 달라져야 하기 때문에 프로젝트 기준으로 적었던 경로를 다 고쳐줘야 함
- 전체 순서는 아래와 같이 이루어짐
  1. 폴더 구조 바꾸기
  2. 플러그인 이름표(plugin.json) 쓰기
  3. 스크립트 경로 고치기
  4. 에이전트 이름 고치기
  5. 내 컴퓨터에서 시험하기 (설치 없이)
  6. 마켓플레이스 파일 쓰고 로컬에 설치하기
  7. README 고치기

## 폴더 구조 바꾸기
```
hi-dev-pipeline/
├── .claude-plugin/
│   └── plugin.json          ← 2단계에서 작성
├── skills/
│   ├── hi-dev-plan/         ← skills-src에서 옮김
│   ├── hi-dev-mockup/
│   ├── hi-dev-impl/
│   └── hi-dev-audit/
├── agents/
│   └── (에이전트 일곱 개)
├── skills-src/
│   └── drafts/              ← 그대로 (플러그인에 안 들어감)
└── README.md
```
- 플러그인을 적용하기 위해 파이프라인에 사용하는 것들을 전부 한 곳으로 모았음
- hi-dev-plan은 저번 구현 때 클로드에서 직접 개발했기 때문에 skill에 대한 폴더가 없었지만 따로 내용에 대한 것은 백업해뒀음

## 플러그인 이름표 쓰기
- .claude-plugin 폴더 안에 plugin.json 파일을 만들고 아래의 내용을 작성함
```
{
  "name": "hi-dev-pipeline",
  "version": "0.1.0",
  "description": "설계, 목업(랄프 루프), 서브에이전트 오케스트레이션 구현, 전체 보안 점검까지 이어지는 개발 파이프라인",
  "author": {
    "name": "dpcivl"
  },
  "repository": "https://github.com/dpcivl/hi-dev-pipeline",
  "license": "MIT",
  "keywords": ["pipeline", "ralph-loop", "orchestration", "subagents", "security"]
}
```

## 스크립트 경로 고치기
- 플러그인을 설치하면 .claude/plugin/... 경로로 복사됨
- 그러나 이전에 구현했던 것들은 다른 경로들을 가리키고 있기 때문에 고쳐줘야 함
- 내 경우에는 실행 파일, 랄프 루프 스크립트, 목업 관련 SKILL.md를 고쳤음

## 에이전트와 Skill 이름 고치기
- 에이전트와 Skill 이름도 플러그인을 적용하면서 바뀌었기 때문에 hi-dev-impl, hi-dev-audit의 SKILL.md 내용을 수정해줬음

## 내 컴퓨터에서 시험하기
- 아래와 같이 플러그인 검사를 했음
![](/assets/posts/claude-plugin/01-plugin-validate.webp)
- 플러그인 검사를 통과한 것을 확인하고 플러그인 시험용 폴더를 만듦
  - 아래의 명령어로 플러그인 동작 시험
```
claude --plugin-dir /Users/d/dev/hi-dev-pipeline
```
- 아래와 같이 잘 불러오는 것을 확인할 수 있음
![](/assets/posts/claude-plugin/02-plugin-dir-test.webp)

## 마켓플레이스에 파일 쓰고 로컬에 설치하기 
- .claude-plugin 폴더 안에 marketplace.json을 만들어줌
- marketplace라고 전체 공개가 아니라 접근 권한이 있다면 플러그인을 설치할 수 있도록 해줌
```json
{
  "name": "hi-dev",
  "description": "dpcivl의 hi-dev 개발 파이프라인 플러그인",
  "owner": {
    "name": "dpcivl"
  },
  "plugins": [
    {
      "name": "hi-dev-pipeline",
      "source": "./",
      "description": "설계, 목업(랄프 루프), 서브에이전트 오케스트레이션 구현, 전체 보안 점검까지 이어지는 개발 파이프라인"
    }
  ]
}
```
- "hi-dev"라고 하는 마켓플레이스에서 "hi-dev-pipeline" 플러그인을 설치할 수 있게 하는 것
  - 아래의 명령어를 실행하면 프로젝트 단위가 아니라 내 컴퓨터에 설치됨
```
claude plugin marketplace add ./
claude plugin install hi-dev-pipeline@hi-dev
```

![](/assets/posts/claude-plugin/03-plugin-install.webp)
- 깃허브에서 설치하는 건 진행하지 못했음
  - 파이프라인이 개발 단계라 안정화된 뒤에 깃허브에서 설치하는 것을 시도할 예정
## README 고치기
- 설치 방법, 사용 방법에 대하여 README 파일을 고쳐주었음

## 결과
- 이제 플러그인을 설치했기 때문에 이전에 구현했던 파이프라인과 에이전트를 다른 프로젝트에서도 바로 사용할 수 있게 되었음
- 하지만 지금은 깃허브에서 설치하는 건 하지 않았고 로컬 폴더에 있는 세팅을 읽어오기 때문에 현재 방식이 안정되면 github에서 설치하는 방식으로 바꿔야 함

## 알게된 것
- `mv`를 쓰지 않고 `git mv`를 사용한 이유
  - 그냥 `mv`를 쓰면 파일만 옮기고 옮긴 사실을 git에 따로 알려야 하는데 `git mv`를 쓰면 git에도 기록됨
