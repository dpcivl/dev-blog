# inbox

> 여기에 그날그날 알게 된 것을 자유롭게 적어둡니다.
> Claude가 세션 시작 시 확인해서 정식 포스트로 정리·발행하고, 처리한 내용은 아래 "처리 완료" 영역으로 옮깁니다.

## 처리 대기

> Claude가 정식 포스트로 정리·발행합니다. **학습/발견/완료된 실험**을 적어주세요.

(여기에 새 메모를 추가하세요)

---

## 메모 / 계획

> Claude가 자동 발행하지 않는 영역. **계획, 아이디어, 진행 중인 실험, 출시 후 회고용 메모** 등을 자유롭게 적어두세요.
> 결과/배움이 나와 발행할 만해지면 위쪽 "처리 대기"로 옮기시면 됩니다.

---

## 처리 완료

### 2026-05-05
- ~~post를 다 제거했고 commit도 성공했는데 vercel에서는 post가 보이는 상황 → 임시 포스트 추가로 해결~~
  → 발행: [vercel-shows-old-posts-after-deletion.md](./data/blog/vercel-shows-old-posts-after-deletion.md)
- ~~Claude API 멀티턴 대화 — assistant 메시지 누적 여부에 따라 기억/망각이 갈림~~
  → 발행: [claude-api-multi-turn-context.md](./data/blog/claude-api-multi-turn-context.md)

### 2026-05-06
- ~~Persona 실험 — 시스템 프롬프트 vs user 메시지의 차이, JSON 출력 강제와 안전장치(text.find/rfind)~~
  → 발행: [claude-api-system-prompt-vs-user-message.md](./data/blog/claude-api-system-prompt-vs-user-message.md)
- ~~Deno가 뭐지? Supabase Edge Functions에서 마주친 런타임 정리~~
  → 발행: [what-is-deno-and-supabase-edge-functions.md](./data/blog/what-is-deno-and-supabase-edge-functions.md)
- ~~Supabase 카카오·구글 로그인 — id_token audience 검증 실패와 redirect URI 누락 두 함정~~
  → 발행: [supabase-social-login-multiple-keys.md](./data/blog/supabase-social-login-multiple-keys.md)
- ~~Claude Code 부서별 세션이 git 명령어를 어김 — CLAUDE.md를 작업 폴더에 두니 해결~~
  → 발행: [claude-code-instructions-placement-by-working-dir.md](./data/blog/claude-code-instructions-placement-by-working-dir.md)

### 2026-05-07
- ~~Claude API 스트리밍 공부 — TTFT가 핵심, 이벤트 라이프사이클, Tool Use 스트리밍의 차이~~
  → 발행: [claude-api-streaming-ttft-and-events.md](./data/blog/claude-api-streaming-ttft-and-events.md)

### 2026-05-14
- ~~바이브 코딩 AI 세션 관리 전략 — 공통 지침은 루트 CLAUDE.md, 특화 지침은 작업 폴더 CLAUDE.md로 분리~~
  → 발행: [ai-session-management-common-vs-specialized.md](./data/blog/ai-session-management-common-vs-specialized.md)
- ~~Tool Use 학습 — calculator/날씨/시간 도구, 메시지 흐름, 에이전트 루프로 다중 도구 자동 선택~~
  → 발행: [claude-api-tool-use-and-agent-loop.md](./data/blog/claude-api-tool-use-and-agent-loop.md)

### 2026-05-15
- ~~Vision 학습 — base64/URL 두 방식, 토큰 비용, 작은 텍스트/다이어그램 한계, Haiku→Sonnet 모델 선택~~
  → 발행: [claude-api-vision-base64-url-and-model.md](./data/blog/claude-api-vision-base64-url-and-model.md)
