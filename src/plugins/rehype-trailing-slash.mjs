// 글 본문의 내부 링크 끝에 / 를 붙인다 (2026-10-18~).
//
// 서버(nginx)는 / 없는 페이지 주소를 / 붙은 주소로 301 넘긴다. 본문에
// [이전 편](/posts/foo) 처럼 / 없이 걸린 링크가 518개 있었는데, 누를 때마다
// 왕복이 한 번 더 생겼다. 컴포넌트가 만드는 링크는 소스에서 고쳤고, 본문은
// 84편 원문을 고치는 대신 빌드 결과에서만 붙인다 — in-sight 글처럼 원문을
// 건드리면 안 되는 글이 있고, 과거 글은 소급하지 않기로 했다.
//
// 붙이는 건 "/" 로 시작하는 내부 페이지 주소뿐이다. 바깥 주소(//, https:),
// 파일(/rss.xml · .png), 이미 / 로 끝난 것은 그대로 둔다. #조각 · ?쿼리는
// / 뒤로 보낸다: /posts/foo#a → /posts/foo/#a

export function rehypeTrailingSlash() {
  return tree => {
    walk(tree, node => {
      if (node.type !== "element" || node.tagName !== "a") return;
      const href = node.properties?.href;
      if (typeof href !== "string") return;
      const fixed = withSlash(href);
      if (fixed !== href) node.properties.href = fixed;
    });
  };
}

export function withSlash(href) {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const cut = href.search(/[?#]/);
  const path = cut < 0 ? href : href.slice(0, cut);
  const rest = cut < 0 ? "" : href.slice(cut);
  if (path.endsWith("/")) return href;
  if (/\.[a-z0-9]+$/i.test(path.slice(path.lastIndexOf("/") + 1))) return href;
  return `${path}/${rest}`;
}

function walk(node, visitor) {
  visitor(node);
  const children = node.children;
  if (!children) return;
  for (const child of children) walk(child, visitor);
}
