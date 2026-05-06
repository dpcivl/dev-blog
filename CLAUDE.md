# 프로젝트 컨텍스트

이 저장소는 Astro + AstroPaper 테마 기반 개인 학습 블로그입니다. 작성자는 박효인(@dpcivl)이고, 임베디드 SW · AI Agent · Vibe coding에 관심이 있습니다.

블로그 글은 마크다운 파일 기반이며, [src/data/blog/](src/data/blog/)에 `.md` 파일을 추가하면 자동으로 발행됩니다. (`draft: true` 면 비공개)

## Inbox 워크플로우 — 매 세션 시작 시 수행

작성자는 [src/000-inbox.md](src/000-inbox.md)에 그날그날 알게 된 내용을 자유로운 형식으로 적어둡니다. Claude의 책임은 이 메모를 정식 블로그 포스트로 다듬어 발행하는 것입니다.

### 트리거
세션을 시작할 때 `src/000-inbox.md`의 **"처리 대기"** 섹션만 확인합니다. 새 항목이 있으면 사용자가 별도 지시하지 않아도 아래 절차를 수행합니다. (이 워크플로우 자체에 대한 사용자 지시 — 예: "오늘은 글 쓰지 말고 코드만" — 가 있으면 그게 우선)

**"메모 / 계획" 섹션은 자동 발행 대상이 아님.** 거기에는 작성자의 계획·아이디어·진행 중인 실험이 들어가며, Claude는 절대로 자동으로 처리하지 않는다. 작성자가 명시적으로 "메모/계획에 있는 X 정리해서 글로 올려줘"라고 지시할 때만 다룬다. 작성자가 결과/배움이 나오면 직접 "처리 대기"로 항목을 옮긴다.

### 절차

1. **이미지 자산 정리**
   - inbox에 첨부된 이미지(보통 `src/image*.png`처럼 VSCode 붙여넣기 기본 경로에 있음)를 찾는다.
   - 포스트 슬러그(slug) 폴더로 이동: `public/assets/posts/<slug>/`
   - 파일명을 내용을 알 수 있게 변경: 예) `01-screenshot-before.png`, `02-after-fix.png`
   - 마크다운에서는 절대 경로로 참조: `/assets/posts/<slug>/<filename>.png`

2. **포스트 작성** ([src/data/blog/<slug>.md](src/data/blog/))
   - frontmatter 필수 필드 ([src/content.config.ts](src/content.config.ts) 참고):
     - `title`, `description`, `pubDatetime` (ISO 8601, 예: `2026-05-05T13:00:00Z`)
     - `tags`: 한국어 태그 OK (예: `트러블슈팅`, `astro`)
     - `draft: false`, `featured: true/false` 적절히
   - ⚠️ **`pubDatetime` 은 반드시 현재 UTC 시각 또는 과거**로 설정. 미래 시각이면 [src/utils/postFilter.ts](src/utils/postFilter.ts)의 `isPublishTimePassed` 필터에 걸려 production(Vercel) 빌드에서 제외됨 (dev 서버에서는 보이므로 dev 화면만 보고 발행됐다고 착각하기 쉬움). 작성 직전에 `date -u` 로 현재 시각 확인 후 그보다 이전 시각으로 설정.
   - 사용자가 거칠게 적은 메모를 다음 형태로 정돈한다:
     - **상황** → **시도/검증** → **원인/해결** → **회고** 흐름
     - 구어체 한국어, 1인칭("나"), `~다` 어미
     - 코드 블록 / 스크린샷 적극 활용
     - 긴 글이면 `## Table of contents` 자동 생성 (remark-toc가 처리)

3. **"공부할 것" 섹션 추가**
   - 글 마지막에 `## 더 공부해볼 것` (또는 비슷한 제목) 추가
   - 글에서 다룬 주제와 연관된 학습 거리를 작성자가 따라가볼 수 있게 정리
   - 가능하면 공식 문서 링크 동반
   - 작성자가 명시적으로 알고 싶다고 한 의문점은 반드시 포함
   - 목적: 작성자가 자기 글을 다시 읽으며 학습할 수 있도록

4. **inbox 정리** ([src/000-inbox.md](src/000-inbox.md))
   - 처리한 항목을 "처리 대기"에서 "처리 완료" 섹션으로 이동
   - 처리 완료 항목은 취소선(`~~ ~~`)으로 표시하고, 발행된 포스트 파일을 링크
   - 날짜별로 그룹핑 유지

5. **임시/실험용 포스트 정리**
   - 디버깅이나 빌드 트리거용으로 만든 임시 포스트(`hello-world.md`, `test-*.md` 등)는 처리 후 삭제
   - 단, 사용자가 "남겨둬"라고 한 건 유지

6. **Commit & Push**
   - 한 번에 commit: 새 포스트 + 이미지 + inbox 업데이트 + 임시 파일 삭제 묶어서
   - 메시지 예: `Publish post: <제목>`
   - push까지 완료

### 어조와 분량 가이드

- 사용자의 거친 메모 한 줄도 충분히 풀어쓰되, **억지로 부풀리지 않는다.** 한 줄짜리 발견은 짧은 글로 OK.
- 코드/명령/로그는 그대로 인용 (사용자가 실제로 본 화면을 그대로 재현)
- 추측은 추측이라고 명시 ("~인 것 같다", "확인 필요")
- 사용자가 "왜 그런지 모르겠다"고 한 부분은 **"공부할 것"** 섹션으로 옮겨서 학습 가능 형태로 만든다 (포스트 본문에서 거짓말로 메우지 않기)

### 주의

- **fact-check**: 사용자 메모의 사실관계가 의심스러우면 git 로그 / 빌드 결과 / 코드를 직접 확인 후 정정
- **이미 발행된 글 재발행 금지**: inbox "처리 완료"에 이미 있는 항목은 다시 발행하지 않음

### 🔴 보안 스크러빙 (반드시 발행 직전 수행)

이 블로그는 GitHub public 저장소 + Vercel 공개 배포다. **포스트에 들어가는 모든 텍스트는 인터넷에 영구 공개된다고 간주한다.** 한 번 push되면 git history / GitHub 검색 / 외부 스크래퍼에서 회수 불가능.

**절대 본문·코드 블록·에러 로그·스크린샷·frontmatter 어디에도 포함하면 안 되는 것:**

- API 키 / 토큰 / 시크릿 (모든 종류 — Kakao/Google/Supabase/OpenAI/Anthropic/AWS/GitHub PAT/JWT 등)
- OAuth `client_secret`, refresh token, id_token, access_token 본문
- 비밀번호 / DB 접속 문자열
- private URL (예: 회사 내부 도메인, 미공개 staging URL, 본인의 개인 supabase 프로젝트 URL `*.supabase.co`)
- 작성자가 명시한 게 아닌 한 본인/제3자의 이메일 / 전화번호 / 실명·식별자
- 결제 카드 정보, 사업자번호 등

**의심 패턴 (발행 전에 grep 한 번 돌릴 것):**

- 32자리 이상 hex 문자열 (`[0-9a-f]{32,}`)
- `eyJ` 로 시작하는 JWT
- `sk-`, `sk_live_`, `sk_test_`, `ghp_`, `gho_`, `github_pat_` 등 알려진 prefix
- 20+자리 base64-like 문자열 (특히 `=` padding 포함 시)
- `*.supabase.co/auth/v1/...`, `*.vercel.app` 등 고유 인스턴스 식별 가능한 도메인
- `password`, `secret`, `token`, `api_key`, `Bearer ` 키워드 주변

**조치:**

1. 위 항목 발견 시 즉시 마스킹 (`REDACTED_*`, `<your_key_here>`, `0b52...4805` 같은 일부 숨김)
2. 메모에 키 일부가 섞여있으면 **발행 보류하고 사용자에게 확인**. 자동 마스킹으로 진행하지 말고 명시적으로 알릴 것
3. 사용자가 이미 push된 시크릿을 발견했다면 **마스킹보다 키 재발급(rotate)을 우선 권고** — 마스킹만으로는 git history / 캐시 / 외부 스크래퍼에서 회수 불가능

**작성자 메모를 인용할 때의 원칙**:

> 메모를 글에 그대로 옮겨붙이지 말 것. 한 줄씩 읽으면서 "이게 외부에 노출돼도 되는가" 를 명시적으로 체크 후 옮긴다. 특히 에러 로그 / 스크린샷 / 명령어 출력은 시크릿이 섞여있을 확률이 높음.

## 기타 규칙

- 한국어 응답 기본
- 이 저장소는 Windows + PowerShell 환경. Bash 도구도 쓸 수 있지만 경로 표기 주의 (`c:\dev\dev-blog\` ↔ `/c/dev/dev-blog/`)
- 빌드 스크립트의 `cp -r dist/pagefind public/`는 Unix 명령이라 Windows 로컬 빌드 시 마지막 단계가 실패함. Vercel(Linux)에서는 정상.
