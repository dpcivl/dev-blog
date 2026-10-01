#!/usr/bin/env python3
"""/stats 비밀번호를 브라우저에서 바꾼다.

왜 Python 인가 — 이 서버에는 Node 가 없다. 빌드는 CI 에서 하고 서버는 정적
파일만 서빙해 왔기 때문이다. 이 작은 일 하나 때문에 런타임을 하나 더 들이는
것보다, 이미 있고 통계 생성에도 쓰고 있는 Python 을 쓰는 쪽이 낫다.
(램이 412MB 뿐이다.)

상주하지 않는다. systemd 소켓 활성화로 요청이 올 때만 뜨고, 조용해지면
스스로 내려간다. 비밀번호는 몇 달에 한 번 바꾸는 것이라 그걸 위해 프로세스
하나를 상시로 물고 있을 이유가 없다.

인증은 하지 않는다 — nginx 가 이미 했다. 이 엔드포인트는 basic auth 로 막힌
location 안에 있어서, 여기까지 온 요청은 현재 비밀번호를 아는 요청이다.
같은 검사를 두 번 하면 틀릴 자리만 늘어난다.

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

        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return self._json(400, {"error": "요청 형식이 잘못됐습니다"})
        if length <= 0 or length > MAX_BODY:
            return self._json(400, {"error": "요청 형식이 잘못됐습니다"})

        try:
            pw = str(json.loads(self.rfile.read(length)).get("password", ""))
        except (ValueError, AttributeError):
            return self._json(400, {"error": "요청 형식이 잘못됐습니다"})

        if len(pw) < MIN_LEN:
            return self._json(400, {"error": f"{MIN_LEN}자 이상이어야 합니다"})
        if len(pw) > MAX_LEN:
            return self._json(400, {"error": f"{MAX_LEN}자를 넘을 수 없습니다"})
        # 해시된 뒤라 콜론은 파일을 안 깨뜨리지만 줄바꿈은 실제로 망가뜨린다
        if "\n" in pw or "\r" in pw:
            return self._json(400, {"error": "줄바꿈은 쓸 수 없습니다"})

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
