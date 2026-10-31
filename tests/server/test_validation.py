"""메모 이름 · 이미지 경로 검증을 고정한다.

이 셋은 서버가 외부 입력으로 받은 문자열을 저장소 경로로 쓰기 전에 거치는
유일한 관문이다. 느슨해지면 `../` 로 저장소 밖을 가리키거나 `published/`
아래를 덮어쓸 수 있다.

계획서(`server/scratch-ui/mockups/compose-plan.md`) 1단계가 `SLUG_RE` 를
새로 더하면서 이 규칙들 옆에 놓인다. **그때 NAME_RE 를 느슨하게 고치면
안 된다** 는 것이 여기 적힌 기대값이다.
"""

import scratch_service as svc


class TestValidName:
    def test_평범한_메모_이름을_받는다(self):
        assert svc.valid_name("flutter-routing.md")
        assert svc.valid_name("오케스트레이션.md")
        assert svc.valid_name("20261030-1.md")

    def test_확장자가_md_가_아니면_거부한다(self):
        assert not svc.valid_name("memo.txt")
        assert not svc.valid_name("memo")
        assert not svc.valid_name("memo.md.txt")

    def test_경로_구분자를_거부한다(self):
        assert not svc.valid_name("published/memo.md")
        assert not svc.valid_name("published\\memo.md")
        assert not svc.valid_name("../memo.md")
        assert not svc.valid_name("../../etc/passwd.md")

    def test_상위_경로_표기를_거부한다(self):
        # 슬래시가 없어도 ".." 가 들어가면 막는다
        assert not svc.valid_name("..md")
        assert not svc.valid_name("a..b.md")

    def test_숨김_파일을_거부한다(self):
        assert not svc.valid_name(".gitignore.md")
        assert not svc.valid_name(".md")

    def test_README_는_예약어다(self):
        # scratch 저장소에서 유일하게 main repo 가 추적하는 파일이다
        assert not svc.valid_name("README.md")

    def test_공백과_제어문자를_거부한다(self):
        # 공백이 든 이름은 웹 에디터로 열 수 없다. published/ 에 그런 메모가
        # 여섯 개 있지만(`항만도메인공부 - 1.md` 등) 거기는 애초에 API 가 닿지
        # 않는다. 루트에 공백 이름으로 메모를 새로 만들면 못 읽는다
        assert not svc.valid_name("항만도메인공부 - 1.md")
        assert not svc.valid_name("my memo.md")
        assert not svc.valid_name("memo\n.md")
        assert not svc.valid_name("memo\t.md")

    def test_URL_에서_뜻이_달라지는_글자를_거부한다(self):
        for bad in ["a#b.md", "a%2e.md", "a?b.md", "a*b.md", "a|b.md", "a:b.md"]:
            assert not svc.valid_name(bad), bad

    def test_문자열이_아니면_거부한다(self):
        assert not svc.valid_name(None)
        assert not svc.valid_name(123)
        assert not svc.valid_name(["memo.md"])

    def test_길이_상한은_120자다(self):
        assert svc.valid_name("가" * 117 + ".md")  # 117 + 3
        assert not svc.valid_name("가" * 121 + ".md")


class TestValidAsset:
    def test_저장소_루트_이미지를_받는다(self):
        assert svc.valid_asset("image.png")
        assert svc.valid_asset("image1.PNG")
        assert svc.valid_asset("사진.jpeg")

    def test_웹_에디터가_올린_경로를_받는다(self):
        assert svc.valid_asset("assets/메모이름/20261030-ab12.png")
        assert svc.valid_asset("assets/memo/x.webp")

    def test_중첩이_한_단계를_넘으면_거부한다(self):
        assert not svc.valid_asset("assets/a/b/c.png")

    def test_assets_가_아닌_폴더를_거부한다(self):
        assert not svc.valid_asset("published/a.png")
        assert not svc.valid_asset("../secret.png")
        assert not svc.valid_asset("assets/../../a.png")

    def test_이미지가_아닌_확장자를_거부한다(self):
        assert not svc.valid_asset("memo.md")
        assert not svc.valid_asset("a.svg")  # SVG 는 스크립트를 품을 수 있다
        assert not svc.valid_asset("a.html")

    def test_문자열이_아니면_거부한다(self):
        assert not svc.valid_asset(None)
        assert not svc.valid_asset(42)


class TestIsReady:
    def test_준비됨_표시를_첫줄에서_찾는다(self):
        assert svc.is_ready("<!-- ✅ 준비됨 (2026-10-30) -->\n본문")

    def test_둘째_줄에_있으면_아니다(self):
        assert not svc.is_ready("# 제목\n<!-- ✅ 준비됨 (2026-10-30) -->")

    def test_발행됨_표시는_준비됨이_아니다(self):
        assert not svc.is_ready("<!-- 📤 발행됨: ./data/blog/x.md (2026-10-30) -->")

    def test_빈_메모(self):
        assert not svc.is_ready("")
