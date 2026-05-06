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

- 바이브코딩을 하던 중 프론트엔드 측 개발을 담당하는 세션이 또 git 명령어를 사용했다. 
git 명령어는 코드 분석 관리 세션만 가능해야 하는데 지침을 지키지 않은 것이다. 
현재 지침은 CLAUDE.md가 루트 폴더에 있고 나머지는 각 부서 별로 폴더에 GUIDELINES.md를 둬서 부서 별 지침을 읽게 하는 방식이다. 
하지만 이렇게 하다 보니 세션을 다시 시작할 때마다 지침을 어기는 상황이 발생하여, CLAUDE.md에 전부 다 때려박아서 콘텍스트를 늘리지 않고 각 부서가 지침을 잘 지키도록 하는 방안이 없을까 찾아봤다. 
각 부서 폴더에 넣는 방식보다는 각 부서가 작업하는 폴더에 CLAUDE.md를 넣었다. 
예를 들어, fe 폴더에 있던 guidelines.md는 그대로 두고 프론트엔드 개발 세션에서 주로 작업하는 flutter 폴더나 flutter/lib 폴더에 CLAUDE.md를 작성해뒀다. 
결과는???

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
