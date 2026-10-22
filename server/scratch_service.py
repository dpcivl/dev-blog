#!/usr/bin/env python3
"""scratch.parkhyo.in — 비공개 scratch 저장소에 메모를 쓰는 API.

브라우저에서 메모를 쓰면 GitHub API 로 dpcivl/dev-blog-scratch 에 바로
커밋한다. 발행은 하지 않는다 — 다 쓴 메모에 「준비됨」 표시만 붙이고, 글로
만드는 건 Claude Code 세션에서 작성자가 검토하며 한다 (CLAUDE.md 11번).

왜 이렇게 좁게 만드나. 이 서비스가 생기기 전까지 서버는 GitHub 에 쓸 수 있는
자격 증명이 하나도 없었다. 이제 하나 생기는데, 그 범위를 이렇게 묶는다.

  - 토큰은 scratch 저장소 하나 · Contents 읽기/쓰기만 (fine-grained PAT)
  - 공개 블로그 저장소에는 닿지 않는다. 서버가 뚫려도 블로그에 글이 올라가지 않는다
  - 다루는 건 저장소 루트의 .md 와, 서버가 이름을 정한 assets/ 아래 이미지뿐이다

인증은 nginx 의 basic auth 가 한다. 다만 그것만으로는 부족하다는 걸 통계
비밀번호에서 배웠다 — 브라우저는 기억한 basic auth 를 다른 사이트에서 시작된
요청에도 붙인다. 그래서 쓰기 요청은 Content-Type 과 Origin 을 본다
(server/stats_password_service.py 와 같은 이유).

같은 메모를 맥북에서 로컬로 고치고 웹에서도 고칠 수 있다. 저장할 때 마지막으로
읽은 blob sha 를 같이 보내고, GitHub 가 그 사이 바뀐 걸 알아채면 거부한다.
조용히 덮어쓰지 않는다.

상주하지 않는다. systemd 소켓 활성화로 요청이 올 때 뜨고 조용하면 내려간다.
"""

import base64
import json
import os
import re
import secrets
import socket
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

REPO = os.environ.get("SCRATCH_REPO", "dpcivl/dev-blog-scratch")
BRANCH = os.environ.get("SCRATCH_BRANCH", "main")
TOKEN = os.environ.get("GITHUB_TOKEN", "").strip()
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "https://scratch.parkhyo.in")
IDLE_SEC = float(os.environ.get("IDLE_SEC", "300"))
# 로컬 시험용. 운영에서는 nginx 가 정적 파일을 낸다.
DEV_UI_DIR = os.environ.get("DEV_UI_DIR", "")

API = "https://api.github.com"
KST = timezone(timedelta(hours=9))

MAX_MEMO = 512 * 1024          # 메모 본문 (가장 큰 기존 메모가 186KB)
MAX_IMAGE = 8 * 1024 * 1024    # 이미지 (디코드 후)
MAX_BODY = MAX_IMAGE * 4 // 3 + 64 * 1024

# 메모 맨 윗줄. 이게 있으면 세션 시작 때 Claude 가 집어간다.
# 발행 뒤에 붙는 <!-- 📤 발행됨 … --> 과 같은 모양으로 맞췄다.
READY_PREFIX = "<!-- ✅ 준비됨"

# 저장소 루트의 .md 만. 슬래시가 없으니 published/ 나 상위 경로로 못 나간다.
# 공백은 막는다 — 이미지 경로 assets/<이름>/… 에 공백이 들어가면 마크다운
# ![](…) 가 거기서 끊긴다.
NAME_RE = re.compile(r"^[^/\\\s\x00-\x1f<>:\"|?*#%]{1,120}\.md$")
RESERVED = {"README.md"}

# 미리보기가 읽는 이미지. 저장소 루트의 이미지(VS Code 로 붙인 image.png 등)와
# 웹 에디터가 올린 assets/<메모>/<파일> 만. 그 밖의 파일은 내주지 않는다.
ASSET_RE = re.compile(
    r"^(?:assets/[^/\\\s\x00-\x1f<>:\"|?*#%]{1,120}/)?[^/\\\s\x00-\x1f<>:\"|?*#%]{1,120}\.(png|jpe?g|gif|webp)$",
    re.IGNORECASE,
)
ASSET_TYPES = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "gif": "image/gif", "webp": "image/webp"}

# 운영 nginx 와 같은 CSP. 로컬 시험에서도 걸어야 CodeMirror 가 CSP 아래에서
# 깨지는지 미리 안다.
DEV_CSP = (
    "default-src 'none'; script-src 'self'; style-src 'self' 'nonce-{nonce}'; img-src 'self' data: blob:; "
    "connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
)

IMAGE_TYPES = {
    "image/png": ("png", (b"\x89PNG\r\n\x1a\n",)),
    "image/jpeg": ("jpg", (b"\xff\xd8\xff",)),
    "image/gif": ("gif", (b"GIF87a", b"GIF89a")),
    "image/webp": ("webp", (b"RIFF",)),
}

COMMIT_MESSAGES = {
    "save": "웹: {name} 저장",
    "create": "웹: {name} 새로 만듦",
    "ready": "웹: {name} 준비됨",
    "unready": "웹: {name} 준비 취소",
}

_timer = None
_ready_cache = {}  # blob sha → 준비됨 여부. 내용이 같으면 sha 도 같다


def touch():
    """마지막 요청으로부터 IDLE_SEC 가 지나면 내려간다."""
    global _timer
    if _timer:
        _timer.cancel()
    _timer = threading.Timer(IDLE_SEC, lambda: os._exit(0))
    _timer.daemon = True
    _timer.start()


def log(msg):
    # 메모 본문과 토큰은 절대 남기지 않는다
    sys.stderr.write(f"[scratch] {msg}\n")


def valid_name(name):
    return (
        isinstance(name, str)
        and NAME_RE.match(name) is not None
        and not name.startswith(".")
        and ".." not in name
        and name not in RESERVED
    )


def repo_path(path):
    return f"/repos/{REPO}/contents/" + urllib.parse.quote(path)


class GitHubError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def gh(method, path, body=None):
    """GitHub REST 호출. (상태 코드, JSON) 을 돌려준다."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method)
    req.add_header("Authorization", f"Bearer {TOKEN}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    req.add_header("User-Agent", "parkhyo-scratch")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            payload = json.loads(raw) if raw else None
        except ValueError:
            payload = None
        return e.code, payload


def gh_or_raise(method, path, body=None):
    """흔한 실패를 사람이 읽을 말로 바꾼다. 원인은 서버 로그에만 남긴다."""
    status, data = gh(method, path, body)
    if status in (200, 201):
        return data
    detail = (data or {}).get("message", "") if isinstance(data, dict) else ""
    log(f"GitHub {method} {status}: {detail[:200]}")
    if status == 401:
        raise GitHubError(503, "GitHub 토큰이 만료됐거나 잘못됐습니다. 서버의 /etc/parkhyo/scratch.env 를 확인하세요")
    if status == 403:
        raise GitHubError(503, "GitHub 가 거부했습니다. 토큰 권한(Contents 읽기/쓰기)이나 요청 한도를 확인하세요")
    if status == 404:
        raise GitHubError(404, "없는 메모입니다")
    if status in (409, 422):
        raise GitHubError(409, "conflict")
    raise GitHubError(502, f"GitHub 응답 {status}")


def gh_raw(path):
    """파일 내용을 바이트로 받는다 (contents API 의 raw 형식)."""
    url = API + repo_path(path) + "?ref=" + urllib.parse.quote(BRANCH)
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {TOKEN}")
    req.add_header("Accept", "application/vnd.github.raw")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    req.add_header("User-Agent", "parkhyo-scratch")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, r.read(MAX_IMAGE + 1)
    except urllib.error.HTTPError as e:
        return e.code, b""


def valid_asset(path):
    return isinstance(path, str) and ".." not in path and ASSET_RE.match(path) is not None


def decode_blob(data):
    return base64.b64decode(data.get("content", "")).decode("utf-8")


def is_ready(text):
    return text.startswith(READY_PREFIX)


def ready_of(sha):
    if sha in _ready_cache:
        return _ready_cache[sha]
    blob = gh_or_raise("GET", f"/repos/{REPO}/git/blobs/{sha}")
    ready = is_ready(decode_blob(blob))
    _ready_cache[sha] = ready
    return ready


def list_memos():
    tree = gh_or_raise("GET", f"/repos/{REPO}/git/trees/{urllib.parse.quote(BRANCH)}")
    files = [
        e for e in tree.get("tree", [])
        if e.get("type") == "blob" and valid_name(e.get("path", ""))
    ]
    # 준비됨 표시는 첫 줄이라 내용을 봐야 안다. 내용이 같으면 sha 가 같으므로
    # 한 번 본 건 다시 안 받는다.
    with ThreadPoolExecutor(max_workers=8) as pool:
        flags = list(pool.map(lambda e: ready_of(e["sha"]), files))
    memos = [
        {"name": e["path"], "sha": e["sha"], "size": e.get("size", 0), "ready": f}
        for e, f in zip(files, flags)
    ]
    memos.sort(key=lambda m: m["name"])
    return memos


def read_memo(name):
    data = gh_or_raise("GET", repo_path(name) + "?ref=" + urllib.parse.quote(BRANCH))
    text = decode_blob(data)
    return {"name": name, "content": text, "sha": data["sha"], "ready": is_ready(text)}


def write_file(path, raw_bytes, message, sha=None):
    body = {
        "message": message,
        "content": base64.b64encode(raw_bytes).decode("ascii"),
        "branch": BRANCH,
    }
    if sha:
        body["sha"] = sha
    data = gh_or_raise("PUT", repo_path(path), body)
    return data["content"]["sha"]


class Handler(BaseHTTPRequestHandler):
    server_version = "parkhyo-scratch"
    sys_version = ""

    def address_string(self):
        # 유닉스 소켓에서는 client_address 가 빈 값이라 기본 구현이 터진다
        return "unix" if not self.client_address else str(self.client_address[0])

    def log_message(self, fmt, *args):
        log(fmt % args)

    # ── 응답 ──
    def _json(self, code, body):
        raw = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def _fail(self, code, message):
        return self._json(code, {"error": message})

    # ── 요청 검사 ──
    def _write_guard(self):
        """쓰기 요청은 이 사이트에서, JSON 으로 온 것만 받는다."""
        ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if ctype != "application/json":
            self._fail(415, "요청 형식이 잘못됐습니다")
            return False
        if self.headers.get("Origin") != ALLOWED_ORIGIN:
            log(f"거부: Origin={self.headers.get('Origin')!r}")
            self._fail(403, "다른 사이트에서 온 요청은 받지 않습니다")
            return False
        return True

    def _body(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = -1
        if length <= 0 or length > MAX_BODY:
            self._fail(413 if length > MAX_BODY else 400, "요청이 너무 크거나 비었습니다")
            return None
        try:
            body = json.loads(self.rfile.read(length))
        except ValueError:
            self._fail(400, "요청 형식이 잘못됐습니다")
            return None
        if not isinstance(body, dict):
            self._fail(400, "요청 형식이 잘못됐습니다")
            return None
        return body

    def _route(self):
        return urllib.parse.urlsplit(self.path)

    # ── GET ──
    def do_GET(self):
        touch()
        url = self._route()
        if not url.path.startswith("/api/"):
            return self._dev_static(url.path)
        if not TOKEN:
            return self._fail(503, "서버에 GitHub 토큰이 없습니다. /etc/parkhyo/scratch.env 를 확인하세요")
        try:
            if url.path == "/api/memos":
                return self._json(200, {"memos": list_memos()})
            if url.path == "/api/memo":
                name = urllib.parse.parse_qs(url.query).get("name", [""])[0]
                if not valid_name(name):
                    return self._fail(400, "메모 이름이 올바르지 않습니다")
                return self._json(200, read_memo(name))
            if url.path == "/api/asset":
                path = urllib.parse.parse_qs(url.query).get("path", [""])[0]
                if not valid_asset(path):
                    return self._fail(400, "이미지 경로가 올바르지 않습니다")
                return self._asset(path)
        except GitHubError as e:
            return self._fail(e.status, str(e))
        except Exception as e:  # noqa: BLE001 — 무엇이 터지든 밖으로는 안 흘린다
            log(f"GET 실패: {type(e).__name__}: {e}")
            return self._fail(500, "서버에서 처리하지 못했습니다")
        return self._fail(404, "not found")

    def _asset(self, path):
        status, raw = gh_raw(path)
        if status == 404:
            return self._fail(404, "이미지가 없습니다")
        if status != 200:
            log(f"이미지 읽기 {status}: {path}")
            return self._fail(502, "이미지를 읽지 못했습니다")
        if len(raw) > MAX_IMAGE:
            return self._fail(413, "이미지가 너무 큽니다")
        ext = path.rsplit(".", 1)[1].lower()
        self.send_response(200)
        self.send_header("Content-Type", ASSET_TYPES[ext])
        self.send_header("Content-Length", str(len(raw)))
        # 파일 이름이 시각+난수라 내용이 안 바뀐다. (nginx 가 no-store 를 덮어써서
        # 실제로는 브라우저가 화면 안에서 blob 으로 들고 있는다 — live-preview.js)
        self.send_header("Cache-Control", "private, max-age=31536000, immutable")
        self.end_headers()
        self.wfile.write(raw)
        return None

    # ── PUT /api/memo : 저장 · 새로 만들기 ──
    def do_PUT(self):
        touch()
        if self._route().path != "/api/memo":
            return self._fail(404, "not found")
        if not self._write_guard():
            return None
        if not TOKEN:
            return self._fail(503, "서버에 GitHub 토큰이 없습니다")
        body = self._body()
        if body is None:
            return None

        name = body.get("name")
        content = body.get("content")
        sha = body.get("sha")
        reason = body.get("reason", "save")
        if not valid_name(name):
            return self._fail(400, "메모 이름이 올바르지 않습니다 (공백 · 슬래시 없이, .md 로 끝나게)")
        if not isinstance(content, str):
            return self._fail(400, "요청 형식이 잘못됐습니다")
        if sha is not None and not (isinstance(sha, str) and re.fullmatch(r"[0-9a-f]{40}", sha)):
            return self._fail(400, "요청 형식이 잘못됐습니다")
        if reason not in COMMIT_MESSAGES:
            return self._fail(400, "요청 형식이 잘못됐습니다")
        if (sha is None) != (reason == "create"):
            return self._fail(400, "요청 형식이 잘못됐습니다")

        # 저장소는 LF 로 통일돼 있다 (.gitattributes)
        text = content.replace("\r\n", "\n").replace("\r", "\n")
        raw = text.encode("utf-8")
        if len(raw) > MAX_MEMO:
            return self._fail(413, f"메모가 너무 깁니다 ({MAX_MEMO // 1024}KB 까지)")

        try:
            new_sha = write_file(name, raw, COMMIT_MESSAGES[reason].format(name=name), sha)
        except GitHubError as e:
            if e.status == 409:
                if reason == "create":
                    return self._fail(409, "같은 이름의 메모가 이미 있습니다")
                return self._fail(409, "다른 곳에서 이 메모가 바뀌었습니다. 내 글은 이 브라우저에 보관해뒀습니다 — 새로 불러온 뒤 다시 반영하세요")
            return self._fail(e.status, str(e))
        except Exception as e:  # noqa: BLE001
            log(f"PUT 실패: {type(e).__name__}: {e}")
            return self._fail(500, "서버에서 저장하지 못했습니다")

        _ready_cache[new_sha] = is_ready(text)
        log(f"{reason}: {name}")
        return self._json(200, {"name": name, "sha": new_sha, "ready": is_ready(text)})

    # ── POST /api/image : 이미지 올리기 ──
    def do_POST(self):
        touch()
        if self._route().path != "/api/image":
            return self._fail(404, "not found")
        if not self._write_guard():
            return None
        if not TOKEN:
            return self._fail(503, "서버에 GitHub 토큰이 없습니다")
        body = self._body()
        if body is None:
            return None

        memo = body.get("memo")
        mime = body.get("mime")
        if not valid_name(memo):
            return self._fail(400, "메모 이름이 올바르지 않습니다")
        if mime not in IMAGE_TYPES:
            return self._fail(415, "이미지는 png · jpg · gif · webp 만 됩니다")
        try:
            raw = base64.b64decode(body.get("data", ""), validate=True)
        except (ValueError, TypeError):
            return self._fail(400, "이미지를 읽지 못했습니다")
        if not raw:
            return self._fail(400, "이미지가 비었습니다")
        if len(raw) > MAX_IMAGE:
            return self._fail(413, f"이미지가 너무 큽니다 ({MAX_IMAGE // 1024 // 1024}MB 까지)")
        ext, magics = IMAGE_TYPES[mime]
        # 형식을 속인 파일은 받지 않는다. 비공개 저장소라도 이미지 칸에는 이미지만
        if not any(raw.startswith(m) for m in magics) or (ext == "webp" and raw[8:12] != b"WEBP"):
            return self._fail(415, "이미지 내용이 형식과 다릅니다")

        # 경로는 서버가 정한다. 요청자는 메모 이름만 고를 수 있다
        stem = memo[:-3]
        stamp = datetime.now(KST).strftime("%Y%m%d-%H%M%S")
        path = f"assets/{stem}/{stamp}-{secrets.token_hex(2)}.{ext}"
        try:
            write_file(path, raw, f"웹: {memo} 이미지 추가")
        except GitHubError as e:
            # 409 는 같은 경로가 이미 있다는 뜻인데, 경로에 난수가 붙어 있어
            # 사실상 안 일어난다. 일어나면 그냥 실패로 본다
            if e.status == 409:
                return self._fail(500, "이미지를 올리지 못했습니다. 다시 붙여넣어 보세요")
            return self._fail(e.status, str(e))
        except Exception as e:  # noqa: BLE001
            log(f"이미지 실패: {type(e).__name__}: {e}")
            return self._fail(500, "이미지를 올리지 못했습니다")

        log(f"image: {path} ({len(raw) // 1024}KB)")
        return self._json(200, {"path": path, "markdown": f"![]({path})"})

    # ── 로컬 시험용 정적 파일 ──
    def _dev_static(self, path):
        if not DEV_UI_DIR:
            return self._fail(404, "not found")
        files = {"/": "index.html", "/index.html": "index.html", "/app.js": "app.js", "/app.css": "app.css"}
        types = {"html": "text/html", "js": "text/javascript", "css": "text/css"}
        f = files.get(path)
        if not f:
            return self._fail(404, "not found")
        with open(os.path.join(DEV_UI_DIR, f), "rb") as fh:
            raw = fh.read()
        # nginx 의 sub_filter + $request_id 를 흉내 낸다
        nonce = secrets.token_hex(16)
        if f == "index.html":
            raw = raw.replace(b"__CSP_NONCE__", nonce.encode())
        self.send_response(200)
        self.send_header("Content-Security-Policy", DEV_CSP.format(nonce=nonce))
        self.send_header("Content-Type", types[f.rsplit(".", 1)[1]] + "; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)
        return None


class UnixHTTPServer(ThreadingHTTPServer):
    """유닉스 소켓용. 생성자가 소켓을 먼저 만들어서 패밀리를 맞춰둔다."""

    address_family = socket.AF_UNIX


def main():
    if os.environ.get("LISTEN_FDS"):
        # systemd 가 열어둔 소켓이 fd 3 으로 넘어온다
        srv = UnixHTTPServer(None, Handler, bind_and_activate=False)
        srv.socket.close()
        srv.socket = socket.socket(fileno=3)
        log(f"소켓 활성화로 기동 · {REPO}@{BRANCH} · 토큰 {'있음' if TOKEN else '없음'}")
    else:
        port = int(os.environ.get("PORT", "8790"))
        srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
        log(f"듣는 중 127.0.0.1:{port} · {REPO}@{BRANCH} · 토큰 {'있음' if TOKEN else '없음'}")
    touch()
    srv.serve_forever()


if __name__ == "__main__":
    main()
