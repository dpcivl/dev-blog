#!/usr/bin/env python3
"""/stats 비밀번호를 브라우저에서 바꾼다.

왜 Python 인가 — 이 서버에는 Node 가 없다. 빌드는 CI 에서 하고 서버는 정적
파일만 서빙해 왔기 때문이다. 이 작은 일 하나 때문에 런타임을 하나 더 들이는
것보다, 이미 있고 통계 생성에도 쓰고 있는 Python 을 쓰는 쪽이 낫다.
(램이 412MB 뿐이다.)

상주하지 않는다. systemd 소켓 활성화로 요청이 올 때만 뜨고, 조용해지면
스스로 내려간다. 비밀번호는 몇 달에 한 번 바꾸는 것이라 그걸 위해 프로세스
하나를 상시로 물고 있을 이유가 없다.

nginx 의 basic auth 만으로는 부족하다 (2026-10-09 정정).

처음엔 "여기까지 온 요청은 현재 비밀번호를 아는 요청이니 다시 검사하지
않는다" 고 적었는데 틀렸다. basic auth 가 증명하는 건 **브라우저가 비밀번호를
기억하고 있다**는 것이지, **사람이 이 요청을 보내려 했다**는 게 아니다.
브라우저는 기억한 basic auth 를 다른 사이트에서 시작된 요청에도 붙인다.
그래서 로그인한 브라우저로 남의 페이지를 열면, 그 페이지의
<form enctype="text/plain"> 이 비밀번호를 바꿀 수 있었다 (CSRF). 로컬에서
재현했다 — 본문을 Content-Type 확인 없이 JSON 으로 읽었기 때문이다.

그래서 세 겹으로 막는다. 하나만 뚫려서는 바뀌지 않는다.

  1. Content-Type 이 application/json 이어야 한다. 남의 사이트의 폼은 이
     타입을 못 보낸다 (보내려면 사전 요청이 필요한데 여기는 CORS 를 안 연다)
  2. Origin 이 이 사이트여야 한다
  3. 현재 비밀번호를 다시 받는다. 위 둘이 어떻게든 뚫려도 공격자는 이걸
     모른다

⚠️ 이걸 만들면서 성질이 하나 바뀐다. 전에는 비밀번호가 새도 통계를 읽히는
   게 전부였는데, 이제 남이 비밀번호를 바꿔 주인을 잠글 수 있다. 그래서
   복구 경로를 반드시 남긴다 (deploy/README.md 참고):

     ssh -i ~/.ssh/blog-prod-key.pem ubuntu@parkhyo.in
     printf '%s' '<새비밀번호>' | sudo htpasswd -i -B /etc/nginx/.htpasswd-stats admin
"""

import json
import os
import socket
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FILE = os.environ.get("HTPASSWD_FILE", "/etc/nginx/.htpasswd-stats")
USER = os.environ.get("HTPASSWD_USER", "admin")
IDLE_SEC = float(os.environ.get("IDLE_SEC", "60"))
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "https://parkhyo.in")

# 비밀번호 규칙은 길이만 본다.
#
# 대문자·숫자·기호를 섞으라고 강요하지 않는 이유는, 그 규칙이 오히려 외우기
# 어려운 비밀번호를 만들어서 사람이 어딘가에 적어두게 만들기 때문이다.
# 작성자는 이미 두 번 잊었다. 길이가 더 안전하다.
MIN_LEN = 12
MAX_LEN = 200
MAX_BODY = 4096

_timer = None


def touch():
    """마지막 요청으로부터 IDLE_SEC 가 지나면 내려간다."""
    global _timer
    if _timer:
        _timer.cancel()
    _timer = threading.Timer(IDLE_SEC, lambda: os._exit(0))
    _timer.daemon = True
    _timer.start()


def check_password(pw: str) -> bool:
    """현재 비밀번호가 맞는지 본다. 파일은 건드리지 않는다.

    htpasswd -v 는 맞으면 0, 틀리면 3 으로 끝난다. 비밀번호는 여기서도
    명령줄이 아니라 표준 입력으로 넘긴다.
    """
    r = subprocess.run(
        ["htpasswd", "-v", "-i", FILE, USER],
        input=pw.encode(),
        capture_output=True,
        timeout=15,
    )
    return r.returncode == 0


def set_password(pw: str):
    """htpasswd 로 비밀번호를 바꾼다.

    -b 가 아니라 -i 를 쓴다. -b 는 비밀번호를 명령줄에 실어서 ps 출력과
    셸 히스토리에 평문이 남는다.
    """
    r = subprocess.run(
        ["htpasswd", "-i", "-B", FILE, USER],
        input=pw.encode(),
        capture_output=True,
        timeout=15,
    )
    if r.returncode != 0:
        raise RuntimeError(r.stderr.decode().strip() or f"htpasswd 종료 코드 {r.returncode}")


class Handler(BaseHTTPRequestHandler):
    server_version = "parkhyo-statspw"
    sys_version = ""

    def address_string(self):
        # 유닉스 소켓에서는 client_address 가 빈 문자열이라 기본 구현이
        # [0] 에서 터진다. 어차피 실제 주소는 nginx 가 갖고 있다.
        return "unix"

    def log_message(self, fmt, *args):
        # 비밀번호가 본문에 있으므로 요청 줄 외에는 아무것도 안 남긴다
        sys.stderr.write(f"[stats-pw] {fmt % args}\n")

    def _json(self, code, body):
        raw = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def do_POST(self):
        touch()
        if not self.path.startswith("/stats/api/password"):
            return self._json(404, {"error": "not found"})

        # 본문을 읽기 전에 거른다 — 남의 사이트에서 온 요청은 여기서 끝난다
        ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if ctype != "application/json":
            return self._json(415, {"error": "요청 형식이 잘못됐습니다"})
        if self.headers.get("Origin") != ALLOWED_ORIGIN:
            sys.stderr.write(f"[stats-pw] 거부: Origin={self.headers.get('Origin')!r}\n")
            return self._json(403, {"error": "다른 사이트에서 온 요청은 받지 않습니다"})

        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return self._json(400, {"error": "요청 형식이 잘못됐습니다"})
        if length <= 0 or length > MAX_BODY:
            return self._json(400, {"error": "요청 형식이 잘못됐습니다"})

        try:
            body = json.loads(self.rfile.read(length))
            pw = str(body.get("password", ""))
            current = str(body.get("current", ""))
        except (ValueError, AttributeError):
            return self._json(400, {"error": "요청 형식이 잘못됐습니다"})

        if not current:
            return self._json(400, {"error": "현재 비밀번호를 넣어주세요"})

        if len(pw) < MIN_LEN:
            return self._json(400, {"error": f"{MIN_LEN}자 이상이어야 합니다"})
        if len(pw) > MAX_LEN:
            return self._json(400, {"error": f"{MAX_LEN}자를 넘을 수 없습니다"})
        # 해시된 뒤라 콜론은 파일을 안 깨뜨리지만 줄바꿈은 실제로 망가뜨린다
        if "\n" in pw or "\r" in pw:
            return self._json(400, {"error": "줄바꿈은 쓸 수 없습니다"})

        # 새 비밀번호 규칙을 다 통과한 뒤에 확인한다. bcrypt 검증은 느리므로
        # 형식이 틀린 요청에는 쓰지 않는다
        try:
            if not check_password(current):
                sys.stderr.write("[stats-pw] 거부: 현재 비밀번호 불일치\n")
                return self._json(403, {"error": "현재 비밀번호가 틀렸습니다"})
        except Exception as e:  # noqa: BLE001
            sys.stderr.write(f"[stats-pw] 확인 실패: {e}\n")
            return self._json(500, {"error": "서버에서 확인하지 못했습니다"})

        try:
            set_password(pw)
        except Exception as e:  # noqa: BLE001 — 무엇이 터지든 밖으로는 안 흘린다
            sys.stderr.write(f"[stats-pw] 실패: {e}\n")
            return self._json(500, {"error": "서버에서 바꾸지 못했습니다"})

        sys.stderr.write(f"[stats-pw] {USER} 비밀번호 변경됨\n")
        self._json(200, {"ok": True})

    def do_GET(self):
        touch()
        self._json(405, {"error": "POST 만 받는다"})


class UnixHTTPServer(ThreadingHTTPServer):
    """유닉스 소켓용.

    systemd 유닛이 PrivateNetwork=true 라 AF_INET 소켓은 아예 못 만든다.
    socketserver 는 bind_and_activate=False 여도 생성자에서 소켓을 먼저
    만들기 때문에, address_family 를 안 맞추면 그 자리에서 터진다
    (OSError 97 Address family not supported by protocol).
    """

    address_family = socket.AF_UNIX


def main():
    if os.environ.get("LISTEN_FDS"):
        # systemd 가 이미 열어 listen 까지 해둔 소켓이 fd 3 으로 넘어온다.
        srv = UnixHTTPServer(None, Handler, bind_and_activate=False)
        srv.socket.close()          # 생성자가 만든 빈 소켓은 버린다
        srv.socket = socket.socket(fileno=3)
        sys.stderr.write(f"[stats-pw] 소켓 활성화로 기동 ({IDLE_SEC:.0f}초 조용하면 내려감)\n")
    else:
        # 손으로 돌려볼 때 (PrivateNetwork 없이)
        port = int(os.environ.get("PORT", "8788"))
        srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
        sys.stderr.write(f"[stats-pw] 듣는 중 127.0.0.1:{port}\n")

    touch()
    srv.serve_forever()


if __name__ == "__main__":
    main()
