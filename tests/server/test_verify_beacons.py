"""deploy/bin/verify-beacons — 같은 IP 가 글을 받아간 비콘만 남기는지 고정한다.

확장자 없는 실행 파일이라 경로로 직접 읽어 들인다.
IP 는 문서용 대역(RFC 5737)만 쓴다.
"""

import gzip
import importlib.machinery
import importlib.util
import os
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / "deploy" / "bin" / "verify-beacons"
_loader = importlib.machinery.SourceFileLoader("verify_beacons", str(SCRIPT))
_spec = importlib.util.spec_from_loader("verify_beacons", _loader)
vb = importlib.util.module_from_spec(_spec)
_loader.exec_module(vb)

READER = "192.0.2.10"
BOT_PAGE = "198.51.100.20"
BOT_BEACON = "203.0.113.30"


def access(ip, path, status=200, method="GET", t="14/Nov/2026:10:00:00 +0900"):
    return f'{ip} - - [{t}] "{method} {path} HTTP/2.0" {status} 512 "-" "Mozilla/5.0"\n'


def beacon(ip, path, t="14/Nov/2026:10:00:05 +0900", ref="-"):
    return f'{ip} - - [{t}] "POST {path} HTTP/1.1" 200 0 "{ref}" "Mozilla/5.0"\n'


def write(p: Path, text: str):
    p.write_text(text, encoding="utf-8")


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8") if p.exists() else ""


class TestFirstRun:
    def test_같은_IP가_글을_받아간_비콘만_남긴다(self, tmp_path):
        logs, out = tmp_path / "log", tmp_path / "out"
        logs.mkdir()
        write(logs / "access.log",
              access(READER, "/posts/a/") + access(BOT_PAGE, "/posts/b/"))
        write(logs / "beacon.log",
              beacon(READER, "/posts/a/")
              + beacon(BOT_BEACON, "/posts/b/", ref="https://www.aocr.org/"))

        ok, bad = vb.run(logs, out)

        assert (ok, bad) == (1, 1)
        assert READER in read(out / "verified.log")
        assert BOT_BEACON in read(out / "rejected.log")
        assert BOT_BEACON not in read(out / "verified.log")

    def test_304_재방문도_받아간_것으로_본다(self, tmp_path):
        logs, out = tmp_path / "log", tmp_path / "out"
        logs.mkdir()
        write(logs / "access.log", access(READER, "/posts/a/", status=304))
        write(logs / "beacon.log", beacon(READER, "/posts/a/"))
        assert vb.run(logs, out) == (1, 0)

    def test_다른_글을_받아간_것은_인정하지_않는다(self, tmp_path):
        logs, out = tmp_path / "log", tmp_path / "out"
        logs.mkdir()
        write(logs / "access.log", access(READER, "/tags/"))
        write(logs / "beacon.log", beacon(READER, "/posts/a/"))
        assert vb.run(logs, out) == (0, 1)

    def test_404_나_비콘_요청_자체는_페이지로_치지_않는다(self, tmp_path):
        logs, out = tmp_path / "log", tmp_path / "out"
        logs.mkdir()
        write(logs / "access.log",
              access(READER, "/posts/a/", status=404)
              + access(READER, "/b/posts/a/", method="POST", status=204))
        write(logs / "beacon.log", beacon(READER, "/posts/a/"))
        assert vb.run(logs, out) == (0, 1)

    def test_쿼리가_붙은_페이지_요청도_맞춘다(self, tmp_path):
        logs, out = tmp_path / "log", tmp_path / "out"
        logs.mkdir()
        write(logs / "access.log", access(READER, "/posts/a/?utm_source=x"))
        write(logs / "beacon.log", beacon(READER, "/posts/a/"))
        assert vb.run(logs, out) == (1, 0)

    def test_회전된_압축_로그까지_읽는다(self, tmp_path):
        logs, out = tmp_path / "log", tmp_path / "out"
        logs.mkdir()
        with gzip.open(logs / "access.log.2.gz", "wt") as f:
            f.write(access(READER, "/posts/old/"))
        write(logs / "access.log", "")
        with gzip.open(logs / "beacon.log.2.gz", "wt") as f:
            f.write(beacon(READER, "/posts/old/"))
        write(logs / "beacon.log", "")
        assert vb.run(logs, out) == (1, 0)


class TestIncremental:
    def test_두번째_실행은_새_줄만_본다(self, tmp_path):
        logs, out = tmp_path / "log", tmp_path / "out"
        logs.mkdir()
        write(logs / "access.log", access(READER, "/posts/a/"))
        write(logs / "beacon.log", beacon(READER, "/posts/a/"))
        assert vb.run(logs, out) == (1, 0)

        # nginx 처럼 같은 파일에 덧붙인다 (inode 유지)
        with open(logs / "access.log", "a") as f:
            f.write(access(READER, "/posts/b/"))
        with open(logs / "beacon.log", "a") as f:
            f.write(beacon(READER, "/posts/b/"))

        assert vb.run(logs, out) == (1, 0)
        assert read(out / "verified.log").count("\n") == 2

    def test_아직_쓰는_중인_마지막_줄은_다음에_읽는다(self, tmp_path):
        logs, out = tmp_path / "log", tmp_path / "out"
        logs.mkdir()
        write(logs / "access.log", access(READER, "/posts/a/"))
        whole = beacon(READER, "/posts/a/")
        write(logs / "beacon.log", whole[:20])
        assert vb.run(logs, out) == (0, 0)

        write(logs / "beacon.log", whole)  # 같은 파일, 줄이 완성됨
        assert vb.run(logs, out) == (1, 0)

    def test_회전되면_옛_파일의_꼬리와_새_파일을_둘_다_읽는다(self, tmp_path):
        logs, out = tmp_path / "log", tmp_path / "out"
        logs.mkdir()
        write(logs / "access.log", access(READER, "/posts/a/"))
        write(logs / "beacon.log", beacon(READER, "/posts/a/"))
        assert vb.run(logs, out) == (1, 0)

        # 회전 직전에 한 줄 더 들어오고
        with open(logs / "access.log", "a") as f:
            f.write(access(READER, "/posts/b/"))
        with open(logs / "beacon.log", "a") as f:
            f.write(beacon(READER, "/posts/b/"))
        # logrotate 가 이름을 바꾸고 새 파일을 연다
        os.rename(logs / "access.log", logs / "access.log.1")
        os.rename(logs / "beacon.log", logs / "beacon.log.1")
        write(logs / "access.log", access(READER, "/posts/c/"))
        write(logs / "beacon.log", beacon(READER, "/posts/c/"))

        assert vb.run(logs, out) == (2, 0)
        verified = read(out / "verified.log")
        assert verified.count("/posts/a/") == 1  # 이미 센 줄을 다시 세지 않는다
        assert "/posts/b/" in verified and "/posts/c/" in verified
