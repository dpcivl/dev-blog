# 구현 계획 — 초안 결정 → 구조 다시 짜기

목업: [compose.html](compose.html) · 설계 배경은 [README.md](README.md)

4단계로 나눈다. **1·2단계만 끝나도 혼자 쓸 수 있다** (저장은 되고 가져오기는 손으로
복사). 3단계가 이 화면의 값어치고, 4단계는 발행 쪽 연결이다.

---

## 1. 서버 — `POST /api/stash`

지금 서버가 다루는 경로는 **저장소 루트의 `.md` 뿐**이다. `NAME_RE`
([scratch_service.py:64](../../scratch_service.py)) 가 슬래시를 막아서 `posts/` 도
`published/` 도 못 쓴다. 의도된 제약이므로 **느슨하게 풀지 말고 전용 검증을 따로 둔다.**

```python
SLUG_RE  = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,78}[a-z0-9])?$")   # posts/<slug>.md
# published/<메모이름> 는 valid_name 을 통과한 이름만
```

한 번의 요청이 파일 셋을 건드린다.

| 파일 | 하는 일 |
| --- | --- |
| `posts/<slug>.md` | 새로 만든다 (이미 있으면 409) |
| `published/<메모>.md` | 초안을 옮긴다. 첫 줄 `<!-- ✅ 준비됨 … -->` 을 `<!-- 📤 발행됨: … -->` 로 **바꾼다** (둘 다 남기지 않는다 — CLAUDE.md 웹 에디터 절) |
| `<메모>.md` | 지운다 |

**⚠️ Contents API 로 하면 커밋이 세 개가 되고, 중간에 실패하면 메모가 두 곳에 남는다.**
`write_file` ([scratch_service.py](../../scratch_service.py)) 은 파일 하나짜리다. 여기서는
Git Data API 로 **한 커밋**에 끝낸다.

```
GET  /repos/{REPO}/git/ref/heads/{BRANCH}        → 현재 커밋
POST /repos/{REPO}/git/blobs            ×2       → 원고 · 옮긴 초안
POST /repos/{REPO}/git/trees  (base_tree, 셋)    → 삭제는 {path, sha: null}
POST /repos/{REPO}/git/commits
PATCH /repos/{REPO}/git/refs/heads/{BRANCH}      → fast-forward 만 (force 금지)
```

- 요청에 **메모의 blob sha** 를 같이 받아, 그 사이 다른 기기에서 바뀌었으면 거부한다
  (지금 저장이 하는 것과 같은 보호)
- `PATCH ref` 가 non-fast-forward 로 거부되면 그대로 409 로 올린다. 조용히 재시도하지 않는다
- `COMMIT_MESSAGES` 에 `"stash": "웹: {name} → 원고"` 추가
- **이미지는 안 옮긴다.** 원고가 `assets/<메모>/…` 를 그대로 가리키고, 블로그로 옮기는
  건 세션이 한다. 옮길 게 늘면 커밋이 커지고 실패 지점도 는다

**토큰 권한은 그대로다** — 같은 scratch 저장소 Contents 쓰기다. `deploy/README.md` 의
보안 표를 고칠 일이 없다.

## 2. 화면 — 모드와 덩어리

`server/scratch-ui/src/` 에 **`compose.js`** 를 새로 만들고, `app.js` 는 모드 전환만 맡는다.
(`pnpm scratch:build` 가 `src/app.js` 에서 따라 들어가는 것까지 묶는다. 배포 파일 수는
그대로 3개라 `deploy/README.md` 의 설치 절차는 안 바뀐다.)

- `.app` 에 `data-mode="draft|compose"`. 3열은 `grid-template-columns` 한 줄
- 덩어리 모델 `[{title, body}]` — 더하기 · `↑↓` · 지우기 · 뼈대 프리셋
- 보기 셋 (쓰기 · 개요 · 미리보기). 미리보기는 목업의 작은 렌더러로 충분하다
- **저장 안 한 글 보관을 덩어리 구조까지 넓힌다.** 지금 `scratch:draft:<name>` 은 본문
  문자열 하나다 ([app.js](../src/app.js)) → `scratch:compose:<name>` 에 덩어리 배열을 담는다

### ⚠️ CSP — 인라인 스타일을 못 쓴다

nginx 가 `style-src 'self' 'nonce-…'` 만 준다
([parkhyo.in.conf:573](../../../deploy/nginx/parkhyo.in.conf)). `'unsafe-inline'` 이 없으니
**마크업의 `style="…"` 속성이 막힌다.** 목업은 진행 막대에 `style="width:0%"` 를 썼다 —
실제 구현에서는 `<progress>` 로 바꾸고 모양은 `app.css` 에서 준다. 기존 `src/` 는 런타임
스타일을 하나도 안 쓴다. 그 규칙을 깨지 않는다.

## 3. 가져오기 — 이 화면의 값어치

목업은 **줄 단위 `◀`** 로 했는데, 산문에서 줄 경계는 자의적이다. 실제로는 **고른 만큼**
가져오는 쪽이 맞다.

- 오른쪽 초안은 **지금 쓰는 CodeMirror 를 읽기 전용**으로 그대로 쓴다
  (`setEditable(false)`). 마크다운 실시간 서식이 공짜로 따라온다
- `editor.js` 에 둘을 더한다 — `getSelectionText()` 와 `markPulled(from, to)`
- 고르면 뜨는 **「◀ 가져오기」** 버튼 + 단축키. 고른 데가 없으면 커서가 있는 줄
- 가져간 범위는 **데코레이션으로 흐리게**. `n / m` 진행률은 글자 수 기준으로 센다
- 초안의 `##` 줄은 덩어리 제목이 비어 있을 때 제목 자리로 (목업과 같다)

**문장을 만들지 않는다.** 원문 그대로 옮기고, 읽히게 고치는 건 왼쪽에서 사람이 한다.

## 4. 발행 쪽 연결 (문서)

- **CLAUDE.md 세션 시작 루틴** — 「준비됨」 찾는 줄 옆에 `src/scratch/posts/*.md` 를
  더한다. 원고가 있으면 보고하고 **처리할지 묻는다** (지금 준비됨과 같은 취급)
- **CLAUDE.md 웹 에디터 절** — 「초안 결정」과 원고 경로를 적는다. 원고를 집었을 때
  Claude 가 하는 일은 **구조를 다시 짜는 게 아니라** 보안 스크럽 · 이미지 변환 ·
  `pubDatetime` · `check:md` · mermaid 렌더 · 커밋이다. **본문에 손대지 않는다**
- **deploy/README.md** — 「발행은 하지 않는다」 문장을 「블로그에 직접 발행하지 않는다 —
  원고까지 만들고 멈춘다」로 다듬는다
- **blog-beyond-astropaper-what-i-added** 갱신 (CLAUDE.md 7번)

---

## 순서와 위험

```
1 서버  →  2 화면  →  3 가져오기  →  4 문서
            ↑ 여기까지면 혼자 쓸 수 있다
```

| 위험 | 어떻게 |
| --- | --- |
| 원고 저장이 중간에 깨져 메모가 두 곳에 남는다 | Git Data API 로 한 커밋 (1단계) |
| 두 기기에서 같은 메모를 건드린다 | 요청에 blob sha, ref 는 fast-forward 만 |
| 덩어리를 짜다 창을 닫는다 | `scratch:compose:<name>` 에 보관 |
| CSP 에 막혀 배포 후에야 깨진 걸 안다 | 로컬도 같은 CSP 로 돈다 (`DEV_CSP`) — 거기서 먼저 본다 |
| 배포가 CI 에 안 실린다 | 손으로 올린다. `deploy/README.md` 「scratch.parkhyo.in」 절 |
