// Auto-adds loading="lazy" and decoding="async" to <img> tags in blog posts.
//
// - First image gets loading="eager" (LCP candidate — likely a hero screenshot)
// - Subsequent images get loading="lazy"
// - decoding="async" for all → non-blocking image decode
//
// Applied via astro.config.ts as a rehype plugin. Runs on parsed HTML AST from
// markdown, so it catches both markdown ![]() and raw <img> tags.

export function rehypeImagePerf() {
  return tree => {
    let seenFirstImage = false;
    walk(tree, node => {
      if (node.type !== "element" || node.tagName !== "img") return;
      const p = (node.properties ??= {});
      if (!seenFirstImage) {
        // LCP candidate — download eagerly
        if (!p.loading) p.loading = "eager";
        if (!p.fetchpriority) p.fetchpriority = "high";
        seenFirstImage = true;
      } else {
        if (!p.loading) p.loading = "lazy";
      }
      if (!p.decoding) p.decoding = "async";
    });
  };
}

function walk(node, visitor) {
  visitor(node);
  const children = node.children;
  if (!children) return;
  for (const child of children) walk(child, visitor);
}
