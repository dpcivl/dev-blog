"""`POST /api/stash` 를 고정한다 — 초안을 원고로 넘기는 한 번의 요청.

계획서(`server/scratch-ui/mockups/compose-plan.md` 1절) 가 이 요청에 거는 약속은
셋이다.

1. 한 요청이 파일 셋(`posts/<slug>.md` 새로 · `published/<메모>.md` 옮김 ·
   루트 `<메모>.md` 삭제)을 건드리지만 **커밋은 하나**다.
2. 중간에 실패해도 **메모가 두 곳에 남지 않는다.**
3. 다른 기기에서 먼저 바뀌었으면 **덮어쓰지 않고** 409 로 멈춘다.

2번과 3번은 값 하나가 맞고 틀리는 문제가 아니라 **호출의 순서와 원자성**이라서
순수 함수만 보면 안 잡힌다. 그래서 아래 4절(`TestHandler`)이 `gh` 를 가짜로
갈아 끼우고 **어떤 호출이 어떤 순서로 나갔는지**를 본다.

구현을 읽지 않고 썼다. 구현과 맞닿는 가정은 이 파일 맨 위 「가짜 GitHub」 절에
모아 뒀다. 구현이 다른 계약을 쓰면 **그 절만** 고친다 (단언은 건드리지 않는다).
"""

import base64
import http.client
import io
import json
import re
from urllib.parse import parse_qs, unquote, urlsplit

import pytest

import scratch_service as svc


# ───────────────────────── 공용 값 ─────────────────────────

MEMO = "오케스트레이션-메모.md"
SLUG = "orchestration-notes"
READY = "<!-- ✅ 준비됨 (2026-10-30) -->"
POSTED = f"<!-- 📤 발행됨: ./data/blog/ko/{SLUG}.md (2026-10-31) -->"
BODY = "# 제목\n\n본문 첫 줄\n<!-- ✅ 준비됨 (2026-01-01) -->\n끝\n"
MANUSCRIPT = "---\ntitle: 원고\n---\n\n원고 본문\n"

MEMO_SHA = "a" * 40
OTHER_SHA = "b" * 40
HEAD_COMMIT = "c" * 40
BASE_TREE = "d" * 40
NEW_TREE = "e" * 40
NEW_COMMIT = "f" * 40
MOVED_SHA = "9" * 40  # 머리가 움직인 뒤의 메모 sha


# ───────────────────────── 1. SLUG_RE ─────────────────────────


class TestSlugRe:
    # 계획서의 정규식 `^[a-z0-9](?:[a-z0-9-]{1,78}[a-z0-9])?$` 은 문서에 적힌 의도
    # (한 글자 거부 · 두 글자부터 80자까지) 와 어긋난다. 선택 그룹이 최소 2자라
    # 길이 1 과 3~80 만 맞고, **한 글자는 받고 두 글자는 거부한다.**
    # 아래 기대값은 의도 쪽이다. 정규식을 `{0,78}` 로 고치면 맞는다.
    @pytest.mark.parametrize(
        "slug",
        [
            "ab",  # 두 글자가 하한이다
            "a1",
            "flutter-routing",
            "20261030-1",
            "a-b",
            "a--b",  # 연속 하이픈은 규칙이 막지 않는다
            "a" * 80,  # 상한
        ],
    )
    def test_받는_것(self, slug):
        assert svc.SLUG_RE.match(slug), slug

    @pytest.mark.parametrize(
        "slug",
        [
            "Hello",  # 대문자
            "helloWorld",
            "hello_world",  # 밑줄
            "hello world",  # 공백
            "hello\nworld",
            "a/b",  # 슬래시 — posts/ 밖으로 못 나가게
            "../x",
            "..",
            "a.b",  # 점
            "a.md",
            ".hidden",
            "-abc",  # 앞 하이픈
            "abc-",  # 뒤 하이픈
            "-",
            "a",  # 한 글자
            "",
            "a" * 81,  # 상한 초과
            "한글슬러그",
        ],
    )
    def test_거부하는_것(self, slug):
        assert not svc.SLUG_RE.match(slug), repr(slug)

    def test_끝_개행으로_우회할_수_없다(self):
        # `$` 는 끝 개행 앞에서도 맞는다. 경로에 개행이 섞이면 안 된다.
        # match 만 쓰면 뚫리므로 fullmatch 로 재도 거부해야 한다.
        assert not svc.SLUG_RE.fullmatch("abc\n")

    def test_NAME_RE_를_느슨하게_풀지_않았다(self):
        # 계획서: "의도된 제약이므로 느슨하게 풀지 말고 전용 검증을 따로 둔다"
        assert not svc.valid_name("posts/x.md")
        assert not svc.valid_name("published/x.md")


# ───────────────────────── 2. rewrite_ready_line ─────────────────────────


class TestRewriteReadyLine:
    def test_첫_줄_준비됨이_발행됨으로_바뀐다(self):
        out = svc.rewrite_ready_line(f"{READY}\n본문\n", POSTED)
        assert out == f"{POSTED}\n본문\n"

    def test_준비됨_줄이_남지_않는다(self):
        out = svc.rewrite_ready_line(f"{READY}\n본문\n", POSTED)
        assert "준비됨" not in out
        assert "✅" not in out

    def test_발행됨_줄은_한_번만_나온다(self):
        out = svc.rewrite_ready_line(f"{READY}\n본문\n", POSTED)
        assert out.count("발행됨") == 1

    def test_준비됨_줄이_없으면_맨_위에_발행됨_줄이_붙고_본문은_그대로다(self):
        text = "# 제목\n\n본문\n"
        out = svc.rewrite_ready_line(text, POSTED)
        assert out == f"{POSTED}\n{text}"

    def test_둘째_줄_이후의_준비됨_모양_줄은_건드리지_않는다(self):
        text = f"# 제목\n{READY}\n본문\n"
        out = svc.rewrite_ready_line(text, POSTED)
        assert out == f"{POSTED}\n{text}"
        assert READY in out  # 본문 속 인용이 지워지면 안 된다

    def test_첫_줄이_준비됨이고_본문_속에도_같은_줄이_있으면_첫_줄만_바뀐다(self):
        out = svc.rewrite_ready_line(f"{READY}\n앞\n{READY}\n뒤\n", POSTED)
        assert out == f"{POSTED}\n앞\n{READY}\n뒤\n"

    def test_날짜가_달라도_첫_줄_준비됨이면_바뀐다(self):
        out = svc.rewrite_ready_line("<!-- ✅ 준비됨 (2025-01-02) -->\n본문", POSTED)
        assert out == f"{POSTED}\n본문"

    def test_준비됨_주석_뒤에_같은_줄_글자가_있으면_그_글자가_살아남는다(self):
        # 본문이 첫 줄에 붙어 있는 메모. 줄을 통째로 갈아 끼우면 본문이 날아간다
        text = f"{READY} 본문이 같은 줄에 있다\n둘째 줄"
        out = svc.rewrite_ready_line(text, POSTED)
        assert "본문이 같은 줄에 있다" in out
        assert "둘째 줄" in out

    def test_같은_줄_글자가_있어도_머리줄은_맨_위에_붙는다(self):
        out = svc.rewrite_ready_line(f"{READY} 본문\n둘째 줄", POSTED)
        assert out.startswith(f"{POSTED}\n")

    @pytest.mark.parametrize("tail", ["x", " x", "\t본문", "  본문  "])
    def test_주석_뒤에_공백이_아닌_글자가_있으면_바꾸지_않는다(self, tail):
        out = svc.rewrite_ready_line(f"{READY}{tail}\n둘째 줄", POSTED)
        assert tail.strip() in out
        assert "둘째 줄" in out

    @pytest.mark.parametrize("tail", [" ", "   ", "\t", " \t "])
    def test_주석_뒤가_공백뿐이면_주석만_있는_줄로_본다(self, tail):
        out = svc.rewrite_ready_line(f"{READY}{tail}\n본문\n", POSTED)
        assert out == f"{POSTED}\n본문\n"
        assert "준비됨" not in out

    def test_빈_문자열이면_발행됨_줄만_남는다(self):
        out = svc.rewrite_ready_line("", POSTED)
        assert out.strip() == POSTED

    def test_준비됨_줄만_있고_본문이_없어도_바뀐다(self):
        out = svc.rewrite_ready_line(READY, POSTED)
        assert out.strip() == POSTED
        assert "준비됨" not in out

    def test_준비됨_줄과_개행뿐이어도_바뀐다(self):
        out = svc.rewrite_ready_line(READY + "\n", POSTED)
        assert out.strip() == POSTED

    def test_이미_발행됨_줄이_첫_줄이면_그_위에_또_붙인다(self):
        # 준비됨이 아닌 첫 줄은 본문이다. 지우지 않는다
        old = "<!-- 📤 발행됨: ./data/blog/ko/old.md (2026-01-01) -->"
        out = svc.rewrite_ready_line(f"{old}\n본문", POSTED)
        assert out == f"{POSTED}\n{old}\n본문"


# ───────────────────────── 2b. decode_blob ─────────────────────────


def _text(x):
    return x if isinstance(x, str) else x.decode("utf-8")


class TestDecodeBlob:
    """1MB 가 넘는 파일은 Contents API 가 200 + `content: ""` + `encoding: "none"` 을
    준다. 이걸 빈 본문으로 받아들이면 `published/` 사본이 껍데기가 되고, 같은 커밋에서
    루트 메모가 지워진다 — 200 OK 로."""

    def test_base64_본문은_그대로_디코드된다(self):
        text = "# 제목\n\n한글 본문 ✅\n"
        enc = base64.b64encode(text.encode()).decode()
        out = svc.decode_blob({"content": enc, "encoding": "base64", "sha": MEMO_SHA})
        assert _text(out) == text

    def test_GitHub_가_줄바꿈을_섞어_준_base64_도_디코드된다(self):
        text = "가나다라마바사 " * 40
        enc = base64.b64encode(text.encode()).decode()
        wrapped = "\n".join(enc[i : i + 60] for i in range(0, len(enc), 60)) + "\n"
        out = svc.decode_blob({"content": wrapped, "encoding": "base64"})
        assert _text(out) == text

    def test_encoding_none_이면_빈_문자열을_돌려주지_않고_올린다(self):
        with pytest.raises(svc.GitHubError):
            svc.decode_blob(
                {"content": "", "encoding": "none", "size": 2_000_000, "sha": MEMO_SHA}
            )

    def test_encoding_none_이면_content_가_차_있어도_올린다(self):
        with pytest.raises(svc.GitHubError):
            svc.decode_blob({"content": "abc", "encoding": "none"})

    def test_encoding_키가_없어도_올린다(self):
        with pytest.raises(svc.GitHubError):
            svc.decode_blob({"content": "", "sha": MEMO_SHA})

    def test_알_수_없는_encoding_도_올린다(self):
        with pytest.raises(svc.GitHubError):
            svc.decode_blob({"content": "abc", "encoding": "utf-8"})


# ───────────────────────── 3. build_stash_tree ─────────────────────────


def _by_path(entries):
    return {e["path"]: e for e in entries}


class TestBuildStashTree:
    def tree(self, memo=MEMO, slug=SLUG):
        return svc.build_stash_tree(memo, slug, "M" * 40, "V" * 40)

    def test_항목이_셋이다(self):
        assert len(self.tree()) == 3

    def test_경로_셋이_계획서_표와_같다(self):
        assert set(_by_path(self.tree())) == {
            f"posts/{SLUG}.md",
            f"published/{MEMO}",
            MEMO,
        }

    def test_원고는_새_blob_으로_posts_아래에_들어간다(self):
        e = _by_path(self.tree())[f"posts/{SLUG}.md"]
        assert e == {
            "path": f"posts/{SLUG}.md",
            "mode": "100644",
            "type": "blob",
            "sha": "M" * 40,
        }

    def test_옮긴_초안은_published_아래로_간다(self):
        e = _by_path(self.tree())[f"published/{MEMO}"]
        assert e == {
            "path": f"published/{MEMO}",
            "mode": "100644",
            "type": "blob",
            "sha": "V" * 40,
        }

    def test_루트_메모는_sha_None_으로_지운다(self):
        e = _by_path(self.tree())[MEMO]
        assert e == {"path": MEMO, "mode": "100644", "type": "blob", "sha": None}

    def test_삭제_항목은_sha_키를_빼지_않고_None_으로_둔다(self):
        # GitHub 는 키가 없는 것과 null 을 다르게 본다. 키가 빠지면 422 다
        e = _by_path(self.tree())[MEMO]
        assert "sha" in e and e["sha"] is None

    def test_삭제는_하나뿐이다(self):
        assert sum(1 for e in self.tree() if e["sha"] is None) == 1

    def test_한글과_하이픈이_든_메모_이름도_경로가_맞다(self):
        memo = "항만-도메인-공부-2.md"
        by = _by_path(self.tree(memo=memo))
        assert f"published/{memo}" in by
        assert memo in by and by[memo]["sha"] is None

    def test_슬러그와_메모_이름이_경로에_뒤섞이지_않는다(self):
        by = _by_path(self.tree(memo="x.md", slug="y1"))
        assert set(by) == {"posts/y1.md", "published/x.md", "x.md"}


# ───────────────────────── 4. 가짜 GitHub ─────────────────────────
#
# 구현과 맞닿는 가정은 전부 이 절에 있다.
#   (a) `svc.gh(method, path, body=None)` 은 `(상태 코드, JSON)` 을 돌려준다
#       (함수 docstring 에 적힌 계약). 거절은 예외가 아니라 상태 코드로 온다.
#   (b) 핸들러는 `Handler.do_POST` 이고 `send_response` 로 응답한다.
#   (c) 교차 출처 거부(`Origin` 이 `svc.ALLOWED_ORIGIN` 이어야 한다) 와
#       토큰 없음(503, `svc.TOKEN`) 을 통과시켜 둔다.


class FakeGitHub:
    """한 저장소를 흉내낸다. 호출을 전부 `calls` 에 쌓는다."""

    WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

    def __init__(
        self,
        memo_text=f"{READY}\n{BODY}",
        memo_sha=MEMO_SHA,
        existing=(),
        patch_status=None,
        memo_large=False,
    ):
        self.memo_large = memo_large  # 1MB 넘는 파일 — Contents API 가 본문을 비워 준다
        self.memo_text = memo_text
        self.memo_sha = memo_sha
        self.existing = set(existing)  # 이미 있는 저장소 경로
        self.patch_status = patch_status
        self.calls = []  # (METHOD, path, body)
        self.blobs = {}  # sha → 내용(디코드된 문자열)
        self._n = 0

    # ---- 호출 ----
    def __call__(self, method, path, body=None, *args, **kwargs):
        if body is None:
            for v in list(args) + list(kwargs.values()):
                if isinstance(v, dict):
                    body = v
                    break
        method = method.upper()
        self.calls.append((method, path, body))
        return self._route(method, path, body)

    def _route(self, method, path, body):
        p = path.split("?")[0]
        if method == "GET":
            q = {k: v[0] for k, v in parse_qs(urlsplit(path).query).items()}
            return self._get(p, q)
        if method == "POST" and p.endswith("/git/blobs"):
            self._n += 1
            sha = f"{self._n:040x}"
            content = body["content"]
            if body.get("encoding") == "base64":
                content = base64.b64decode(content).decode("utf-8")
            self.blobs[sha] = content
            return 201, {"sha": sha}
        if method == "POST" and p.endswith("/git/trees"):
            return 201, {"sha": NEW_TREE}
        if method == "POST" and p.endswith("/git/commits"):
            return 201, {"sha": NEW_COMMIT}
        if method == "PATCH" and "/git/refs/" in p:
            if self.patch_status:
                return self.patch_status, {"message": "Update is not a fast forward"}
            return 200, {"object": {"sha": NEW_COMMIT}}
        if method in ("PUT", "DELETE") and "/contents/" in p:
            return 200, {"content": {"sha": "9" * 40}, "commit": {"sha": NEW_COMMIT}}
        raise AssertionError(f"가짜가 모르는 호출: {method} {path}")

    def _get(self, p, query=None):
        query = query or {}
        if "/git/ref/" in p or p.rstrip("/").endswith("/git/refs/heads/" + _branch()):
            return 200, {"ref": f"refs/heads/{_branch()}", "object": {"sha": HEAD_COMMIT}}
        if "/git/commits/" in p:
            return 200, {"sha": HEAD_COMMIT, "tree": {"sha": BASE_TREE}}
        if "/git/trees/" in p:
            ref = p.rsplit("/", 1)[-1]
            if ref not in (HEAD_COMMIT, BASE_TREE):
                self.memo_sha = MOVED_SHA  # 브랜치 이름으로 읽으면 움직인 뒤의 것이다
            tree = [
                {"path": MEMO, "mode": "100644", "type": "blob", "sha": self.memo_sha}
            ]
            tree += [
                {"path": e, "mode": "100644", "type": "blob", "sha": "7" * 40}
                for e in sorted(self.existing)
            ]
            return 200, {"sha": BASE_TREE, "tree": tree, "truncated": False}
        if "/git/blobs/" in p:
            return 200, {
                "sha": self.memo_sha,
                "encoding": "base64",
                "content": base64.b64encode(self.memo_text.encode()).decode(),
            }
        if "/contents/" in p:
            rel = p.split("/contents/", 1)[1]
            rel = unquote(rel)
            if rel == MEMO:
                # 머리 커밋 sha 로 읽을 때만 "그 시점" 의 메모를 준다. 브랜치 이름이나
                # ref 없이 읽으면 그 사이 다른 기기가 고친 뒤의 메모를 준다.
                if query.get("ref") == HEAD_COMMIT:
                    sha, text = self.memo_sha, self.memo_text
                else:
                    sha, text = MOVED_SHA, "다른 기기에서 고친 뒤의 본문\n"
                if self.memo_large:
                    # 실제 GitHub: 200 + content "" + encoding "none" (1~100MB)
                    return 200, {
                        "type": "file",
                        "path": MEMO,
                        "sha": sha,
                        "size": 2_000_000,
                        "encoding": "none",
                        "content": "",
                    }
                return 200, {
                    "type": "file",
                    "path": MEMO,
                    "sha": sha,
                    "encoding": "base64",
                    "content": base64.b64encode(text.encode()).decode(),
                }
            if rel in self.existing:
                return 200, {"type": "file", "path": rel, "sha": "7" * 40}
            return 404, {"message": "Not Found"}
        raise AssertionError(f"가짜가 모르는 GET: {p}")

    # ---- 조회 ----
    def writes(self):
        return [c for c in self.calls if c[0] in self.WRITE_METHODS]

    def find(self, method, suffix):
        return [c for c in self.calls if c[0] == method and c[1].split("?")[0].endswith(suffix)]

    def index(self, method, suffix):
        for i, c in enumerate(self.calls):
            if c[0] == method and c[1].split("?")[0].endswith(suffix):
                return i
        return None

    def contents_writes(self):
        return [c for c in self.writes() if "/contents/" in c[1]]

    def patches(self):
        return [c for c in self.calls if c[0] == "PATCH"]


def _branch():
    return getattr(svc, "BRANCH", "main")


class _Server:
    """BaseHTTPRequestHandler 가 `self.server` 에서 읽을 법한 것."""

    server_name = "test"
    server_port = 0


def _request(payload, *, raw=None, headers=None):
    """`Handler.do_POST` 를 소켓 없이 부른다. (상태 코드, 파싱된 본문) 을 돌려준다."""
    body = raw if raw is not None else json.dumps(payload, ensure_ascii=False).encode()
    h = object.__new__(svc.Handler)
    h.rfile = io.BytesIO(body)
    h.wfile = io.BytesIO()
    h.client_address = ("127.0.0.1", 0)
    h.server = _Server()
    h.request_version = "HTTP/1.1"
    h.command = "POST"
    h.path = "/api/stash"
    h.requestline = "POST /api/stash HTTP/1.1"
    h.close_connection = True
    msg = http.client.HTTPMessage()
    msg["Content-Type"] = "application/json"
    msg["Content-Length"] = str(len(body))
    msg["Host"] = "scratch.parkhyo.in"
    msg["Origin"] = svc.ALLOWED_ORIGIN  # 교차 출처 요청 거부를 통과시킨다
    for k, v in (headers or {}).items():
        del msg[k]  # 같은 이름을 덧붙이지 않고 바꾼다 (없으면 무시)
        if v is not None:  # None 이면 헤더를 뺀다
            msg[k] = v
    h.headers = msg
    h.log_message = lambda *a, **k: None
    h.log_request = lambda *a, **k: None
    h.do_POST()
    out = h.wfile.getvalue()
    head, _, rest = out.partition(b"\r\n\r\n")
    status = int(head.split(b" ", 2)[1])
    try:
        data = json.loads(rest.decode() or "null")
    except ValueError:
        data = rest.decode(errors="replace")
    return status, data


def _payload(**over):
    p = {"memo": MEMO, "sha": MEMO_SHA, "slug": SLUG, "content": MANUSCRIPT}
    p.update(over)
    return p


@pytest.fixture
def world(monkeypatch):
    """기본 세계: 준비됨 메모가 있고 `posts/<slug>.md` 는 없다."""

    def make(**kw):
        fake = FakeGitHub(**kw)
        monkeypatch.setattr(svc, "gh", fake)
        monkeypatch.setattr(svc, "TOKEN", "test-token")  # 없으면 503
        return fake

    return make


# ───────────────────────── 5. 핸들러 ─────────────────────────


class TestHandlerHappyPath:
    def test_성공하면_200_이다(self, world):
        world()
        status, _ = _request(_payload())
        assert status == 200

    def test_쓰기_호출은_blob_둘_트리_커밋_ref_다섯_번뿐이다(self, world):
        fake = world()
        _request(_payload())
        w = [(m, p.split("?")[0].rsplit("/", 1)[-1]) for m, p, _ in fake.writes()]
        assert w == [
            ("POST", "blobs"),
            ("POST", "blobs"),
            ("POST", "trees"),
            ("POST", "commits"),
            ("PATCH", _branch()),
        ]

    def test_커밋이_하나다(self, world):
        fake = world()
        _request(_payload())
        assert len(fake.find("POST", "/git/commits")) == 1

    def test_Contents_API_로_쓰지_않는다(self, world):
        # 그게 쓰이면 커밋이 세 개가 된다. 이 테스트가 그걸 막는 울타리다
        fake = world()
        _request(_payload())
        assert fake.contents_writes() == []

    def test_ref_갱신에_force_가_없다(self, world):
        fake = world()
        _request(_payload())
        (_, path, body), = fake.patches()
        assert path.split("?")[0].endswith(f"/git/refs/heads/{_branch()}")
        assert body.get("force") is not True  # 키가 없거나 False 다

    def test_ref_는_한_번만_갱신하고_새_커밋을_가리킨다(self, world):
        fake = world()
        _request(_payload())
        assert len(fake.patches()) == 1
        assert fake.patches()[0][2]["sha"] == NEW_COMMIT

    def test_호출_순서는_blob_다음_트리_다음_커밋_다음_ref_다(self, world):
        fake = world()
        _request(_payload())
        i_blob = max(i for i, c in enumerate(fake.calls) if c[1].endswith("/git/blobs") and c[0] == "POST")
        i_tree = fake.index("POST", "/git/trees")
        i_commit = fake.index("POST", "/git/commits")
        i_patch = next(i for i, c in enumerate(fake.calls) if c[0] == "PATCH")
        assert i_blob < i_tree < i_commit < i_patch

    def test_트리는_첫_blob_보다_먼저_만들어지지_않는다(self, world):
        fake = world()
        _request(_payload())
        first_blob = fake.index("POST", "/git/blobs")
        assert first_blob < fake.index("POST", "/git/trees")

    def test_트리는_현재_커밋의_트리를_base_tree_로_쓴다(self, world):
        fake = world()
        _request(_payload())
        _, _, body = fake.find("POST", "/git/trees")[0]
        assert body["base_tree"] == BASE_TREE

    def test_커밋은_현재_헤드를_부모로_갖고_새_트리를_가리킨다(self, world):
        fake = world()
        _request(_payload())
        _, _, body = fake.find("POST", "/git/commits")[0]
        assert body["parents"] == [HEAD_COMMIT]
        assert body["tree"] == NEW_TREE

    def test_커밋_메시지는_COMMIT_MESSAGES_stash_형식이다(self, world):
        fake = world()
        _request(_payload())
        _, _, body = fake.find("POST", "/git/commits")[0]
        fmt = svc.COMMIT_MESSAGES["stash"]
        assert fmt == "웹: {name} → 원고"
        # name 이 `.md` 를 달고 오든 떼고 오든 형식은 같다
        assert body["message"] in {
            fmt.format(name=MEMO),
            fmt.format(name=MEMO[: -len(".md")]),
        }

    def test_트리_항목이_셋이고_경로가_맞다(self, world):
        fake = world()
        _request(_payload())
        _, _, body = fake.find("POST", "/git/trees")[0]
        assert set(_by_path(body["tree"])) == {
            f"posts/{SLUG}.md",
            f"published/{MEMO}",
            MEMO,
        }

    def test_트리의_루트_메모는_삭제다(self, world):
        fake = world()
        _request(_payload())
        _, _, body = fake.find("POST", "/git/trees")[0]
        e = _by_path(body["tree"])[MEMO]
        assert "sha" in e and e["sha"] is None

    def test_원고_blob_에는_요청의_content_가_그대로_들어간다(self, world):
        fake = world()
        _request(_payload())
        _, _, body = fake.find("POST", "/git/trees")[0]
        sha = _by_path(body["tree"])[f"posts/{SLUG}.md"]["sha"]
        assert fake.blobs[sha] == MANUSCRIPT

    def test_옮긴_초안_blob_은_준비됨_줄이_발행됨_줄로_바뀌어_있다(self, world):
        fake = world()
        _request(_payload())
        _, _, body = fake.find("POST", "/git/trees")[0]
        sha = _by_path(body["tree"])[f"published/{MEMO}"]["sha"]
        moved = fake.blobs[sha]
        first, _, rest = moved.partition("\n")
        assert first.startswith(f"<!-- 📤 원고로 옮김: posts/{SLUG}.md (")
        assert first.endswith(") -->")
        assert "발행됨" not in first  # 아직 발행된 게 없다
        assert rest == BODY  # 본문은 한 글자도 안 바뀐다
        assert "<!-- ✅ 준비됨 (2026-10-30) -->" not in moved  # 첫 줄의 것은 없다

    def test_옮긴_초안에_준비됨_줄이_첫_줄로_남지_않는다(self, world):
        fake = world()
        _request(_payload())
        _, _, body = fake.find("POST", "/git/trees")[0]
        sha = _by_path(body["tree"])[f"published/{MEMO}"]["sha"]
        assert not fake.blobs[sha].splitlines()[0].startswith("<!-- ✅")

    def test_준비됨_줄이_없던_메모도_옮겨지고_발행됨_줄이_붙는다(self, world):
        fake = world(memo_text=BODY)
        status, _ = _request(_payload())
        assert status == 200
        _, _, body = fake.find("POST", "/git/trees")[0]
        sha = _by_path(body["tree"])[f"published/{MEMO}"]["sha"]
        first, _, rest = fake.blobs[sha].partition("\n")
        assert first.startswith(f"<!-- 📤 원고로 옮김: posts/{SLUG}.md (")
        assert rest == BODY

    def test_이미지는_옮기지_않는다(self, world):
        fake = world()
        _request(_payload())
        _, _, body = fake.find("POST", "/git/trees")[0]
        assert not any(e["path"].startswith("assets/") for e in body["tree"])


class TestReadsMemoAtHeadCommit:
    """메모를 브랜치 이름이 아니라 **머리 커밋 sha** 로 읽는다.

    ref · 트리 · 메모가 한 시점이어야, 읽는 사이 머리가 움직여도 "메모가 두 곳에
    남는" 일이 없다. 브랜치 이름으로 읽으면 ref 는 옛 커밋인데 메모는 새 것이 되어
    sha 대조가 의미를 잃는다. 가짜 GitHub 도 머리 sha 가 아닌 방식으로 읽으면 움직인
    뒤의 메모(다른 sha)를 줘서, 그렇게 읽는 구현은 정상 요청이 409 로 깨진다.
    """

    def _memo_gets(self, fake):
        out = []
        for m, path, _ in fake.calls:
            if m != "GET":
                continue
            if unquote(path).split("?")[0].endswith("/" + MEMO):
                out.append(path)
        return out

    def test_메모를_읽는_GET_이_있다(self, world):
        fake = world()
        _request(_payload())
        assert self._memo_gets(fake), [c[1] for c in fake.calls]

    def test_메모를_읽는_경로에_머리_커밋_sha_가_들어_있다(self, world):
        fake = world()
        _request(_payload())
        for path in self._memo_gets(fake):
            assert HEAD_COMMIT in path, path

    def test_메모를_브랜치_이름으로_읽지_않는다(self, world):
        fake = world()
        _request(_payload())
        for path in self._memo_gets(fake):
            assert f"ref={_branch()}" not in path, path
            assert f"heads/{_branch()}" not in path, path

    def test_머리_커밋은_메모를_읽기_전에_잡는다(self, world):
        fake = world()
        _request(_payload())
        i_ref = next(
            i
            for i, c in enumerate(fake.calls)
            if c[0] == "GET" and ("/git/ref/" in c[1] or "/git/refs/" in c[1])
        )
        i_memo = next(
            i
            for i, c in enumerate(fake.calls)
            if c[0] == "GET" and c[1] in self._memo_gets(fake)
        )
        assert i_ref < i_memo


class TestLargeMemo:
    """메모가 1MB 를 넘으면 본문을 못 읽는다. 「전부 되거나 전부 안 된다」가 「사본이
    원본과 같다」를 보장하지는 않는다 — 빈 사본으로 커밋이 성공하면 원본만 사라진다."""

    def test_쓰기_호출이_하나도_나가지_않는다(self, world):
        fake = world(memo_large=True)
        _request(_payload())
        assert fake.writes() == []

    def test_오류_상태로_끝난다(self, world):
        world(memo_large=True)
        status, _ = _request(_payload())
        assert status >= 400

    def test_성공_응답을_주지_않는다(self, world):
        world(memo_large=True)
        status, _ = _request(_payload())
        assert status != 200

    def test_ref_갱신이_없다(self, world):
        fake = world(memo_large=True)
        _request(_payload())
        assert fake.patches() == []
        assert fake.find("POST", "/git/commits") == []

    def test_빈_사본이_blob_으로_올라가지_않는다(self, world):
        fake = world(memo_large=True)
        _request(_payload())
        assert fake.find("POST", "/git/blobs") == []


class TestWriteGuard:
    """새 경로에도 CSRF 가드가 걸린다. 거부되면 GitHub 를 한 번도 부르지 않는다."""

    @pytest.mark.parametrize(
        "origin",
        [
            "https://evil.example",
            "http://scratch.parkhyo.in",
            "https://scratch.parkhyo.in.evil.example",
            "null",
            "",
        ],
    )
    def test_Origin_이_허용된_것이_아니면_403(self, world, origin):
        fake = world()
        status, _ = _request(_payload(), headers={"Origin": origin})
        assert status == 403
        assert fake.calls == []

    def test_Origin_헤더가_없으면_403(self, world):
        fake = world()
        status, _ = _request(_payload(), headers={"Origin": None})
        assert status == 403
        assert fake.calls == []

    @pytest.mark.parametrize(
        "ctype",
        ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data"],
    )
    def test_Content_Type_이_json_이_아니면_415(self, world, ctype):
        fake = world()
        status, _ = _request(_payload(), headers={"Content-Type": ctype})
        assert status == 415
        assert fake.calls == []

    def test_Content_Type_이_없으면_415(self, world):
        fake = world()
        status, _ = _request(_payload(), headers={"Content-Type": None})
        assert status == 415
        assert fake.calls == []

    @pytest.mark.parametrize("token", ["", None])
    def test_토큰이_없으면_거부하고_GitHub_를_부르지_않는다(self, world, monkeypatch, token):
        fake = world()
        monkeypatch.setattr(svc, "TOKEN", token)
        status, _ = _request(_payload())
        assert status in (401, 403, 503)
        assert fake.calls == []

    def test_가드를_통과한_정상_요청은_200(self, world):
        # 위 거부들이 헤더 조립 실수 때문이 아님을 보인다
        world()
        status, _ = _request(_payload())
        assert status == 200


class TestHandlerConflicts:
    def test_메모_sha_가_다르면_409_이다(self, world):
        # 그 사이 다른 기기에서 바뀐 경우
        world()
        status, _ = _request(_payload(sha=OTHER_SHA))
        assert status == 409

    def test_메모_sha_가_다르면_쓰기_호출이_하나도_없다(self, world):
        fake = world()
        _request(_payload(sha=OTHER_SHA))
        assert fake.writes() == []

    def test_posts_에_같은_슬러그가_이미_있으면_409_이다(self, world):
        world(existing={f"posts/{SLUG}.md"})
        status, _ = _request(_payload())
        assert status == 409

    def test_posts_에_이미_있으면_커밋도_ref_갱신도_없다(self, world):
        fake = world(existing={f"posts/{SLUG}.md"})
        _request(_payload())
        assert fake.find("POST", "/git/commits") == []
        assert fake.patches() == []
        assert fake.contents_writes() == []

    def test_published_에_같은_메모_이름이_이미_있으면_409_이다(self, world):
        # 덮어쓰면 옛 초안이 사라진다
        world(existing={f"published/{MEMO}"})
        status, _ = _request(_payload())
        assert status == 409

    def test_published_에_이미_있으면_커밋도_ref_갱신도_없다(self, world):
        fake = world(existing={f"published/{MEMO}"})
        _request(_payload())
        assert fake.find("POST", "/git/commits") == []
        assert fake.patches() == []
        assert fake.contents_writes() == []

    def test_published_에_이미_있으면_쓰기_호출이_하나도_없다(self, world):
        fake = world(existing={f"published/{MEMO}"})
        _request(_payload())
        assert fake.writes() == []

    def test_다른_슬러그의_원고가_있어도_막지_않는다(self, world):
        world(existing={"posts/other.md"})
        status, _ = _request(_payload())
        assert status == 200

    def test_ref_갱신이_non_fast_forward_로_거부되면_409_이다(self, world):
        world(patch_status=422)
        status, _ = _request(_payload())
        assert status == 409

    def test_ref_갱신이_거부돼도_재시도하지_않는다(self, world):
        fake = world(patch_status=422)
        _request(_payload())
        assert len(fake.patches()) == 1

    def test_ref_갱신이_거부돼도_Contents_API_로_돌려놓으려_하지_않는다(self, world):
        # 실패 뒤에 "수습" 쓰기가 나가면 그게 두 번째 커밋이다
        fake = world(patch_status=422)
        _request(_payload())
        assert fake.contents_writes() == []
        assert len(fake.find("POST", "/git/commits")) == 1

    def test_ref_갱신이_거부돼도_force_로_다시_시도하지_않는다(self, world):
        fake = world(patch_status=422)
        _request(_payload())
        assert all(not (b or {}).get("force") for _, _, b in fake.patches())


class TestHandlerRejectsBadInput:
    """잘못된 입력은 400 이고 GitHub 를 **한 번도 부르지 않는다.**"""

    @pytest.mark.parametrize(
        "slug",
        ["Hello", "a", "a_b", "a b", "a/b", "../x", "-ab", "ab-", "a.b", "a" * 81, "", None, 123],
    )
    def test_슬러그가_규칙을_어기면(self, world, slug):
        fake = world()
        status, _ = _request(_payload(slug=slug))
        assert status == 400
        assert fake.calls == []

    @pytest.mark.parametrize(
        "memo",
        [
            "README.md",
            "published/x.md",
            "../x.md",
            "x.txt",
            "x",
            "a b.md",
            ".md",
            "",
            None,
            ["x.md"],
        ],
    )
    def test_메모_이름이_valid_name_을_어기면(self, world, memo):
        fake = world()
        status, _ = _request(_payload(memo=memo))
        assert status == 400
        assert fake.calls == []

    @pytest.mark.parametrize(
        "content", ["", " ", "\n", " \n\t\n ", "\r\n", "\u3000"]
    )
    def test_content_가_비었거나_공백과_줄바꿈뿐이면(self, world, content):
        # 빈 원고를 posts/ 에 만들고 메모를 치워버리면 되돌릴 수 없다
        fake = world()
        status, _ = _request(_payload(content=content))
        assert status == 400
        assert fake.calls == []

    @pytest.mark.parametrize("content", [None, 123, ["a"], {"a": 1}, True])
    def test_content_가_문자열이_아니면(self, world, content):
        fake = world()
        status, _ = _request(_payload(content=content))
        assert status == 400
        assert fake.calls == []

    @pytest.mark.parametrize(
        "sha",
        [
            "",
            "abc",
            "a" * 39,
            "a" * 41,
            "g" * 40,  # hex 가 아니다
            "A" * 40 + "\n",
            None,
            123,
        ],
    )
    def test_sha_가_40자리_hex_가_아니면(self, world, sha):
        fake = world()
        status, _ = _request(_payload(sha=sha))
        assert status == 400
        assert fake.calls == []

    @pytest.mark.parametrize("key", ["memo", "sha", "slug", "content"])
    def test_필드가_빠지면(self, world, key):
        fake = world()
        p = _payload()
        del p[key]
        status, _ = _request(p)
        assert status == 400
        assert fake.calls == []

    def test_JSON_이_아닌_본문이면(self, world):
        fake = world()
        status, _ = _request(None, raw=b"not json")
        assert status == 400
        assert fake.calls == []

    def test_본문이_객체가_아니면(self, world):
        fake = world()
        status, _ = _request(["memo"], raw=b'["memo"]')
        assert status == 400
        assert fake.calls == []
