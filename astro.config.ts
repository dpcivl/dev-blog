import { defineConfig, envField, fontProviders } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import { rehypeImagePerf } from "./src/plugins/rehype-image-perf.mjs";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerFileName } from "./src/utils/transformers/fileName";
import { SITE } from "./src/config";
import { getThinTagSlugs } from "./src/utils/thinTags";

// 글 1편짜리 태그 목록 — 빌드 시작 시 한 번만 계산 (sitemap filter 가 매 URL 마다 호출됨)
const thinTags = getThinTagSlugs();

// https://astro.build/config
export default defineConfig({
  site: SITE.website,
  // Inline all page-scoped CSS into <style> tags → 외부 CSS 요청 제거
  // (렌더링 차단 요소 하나 더 제거, FCP 개선)
  build: {
    inlineStylesheets: "always",
  },
  integrations: [
    sitemap({
      filter: page => {
        // Exclude portfolio (unlisted — accessible only via direct URL)
        if (page.includes("/portfolio")) return false;
        // 방문 통계는 basic auth 로 막혀 있고 noindex 다. sitemap 에 넣으면
        // "색인해라" 와 "하지 마라" 를 동시에 말하는 셈이 된다.
        if (page.includes("/stats")) return false;
        if (!SITE.showArchives && page.endsWith("/archives")) return false;

        // 글이 1편뿐인 태그 페이지는 sitemap 에서 제외한다.
        // sitemap 581개 중 390개가 태그 페이지였고 그중 90여 개가 글 하나짜리라,
        // 크롤러가 실제 글보다 얇은 목록 페이지를 더 많이 보게 되어 있었다.
        // 페이지 자체는 계속 생성한다 — 사이트 안에서 탐색에 쓰이므로.
        const tagMatch = page.match(/\/(en\/)?tags\/([^/]+)\/$/);
        if (tagMatch) {
          const lang = tagMatch[1] ? "en" : "ko";
          // 한글 태그는 sitemap URL 에서 퍼센트 인코딩되어 나온다
          // (`/tags/하드웨어/` → `/tags/%ED%95%98...`). 디코딩해야 slug 와 대조된다.
          let slug = tagMatch[2];
          try {
            slug = decodeURIComponent(slug);
          } catch {
            // 잘못된 인코딩이면 원본 그대로 대조 (걸러지지 않고 남을 뿐 빌드는 계속)
          }
          if (thinTags[lang].has(slug)) return false;
        }

        return true;
      },
    }),
  ],
  markdown: {
    remarkPlugins: [remarkToc, [remarkCollapse, { test: "Table of contents" }]],
    rehypePlugins: [
      // Auto lazy-load images beyond the first (LCP-safe).
      rehypeImagePerf,
    ],
    shikiConfig: {
      // For more themes, visit https://shiki.style/themes
      themes: { light: "min-light", dark: "night-owl" },
      defaultColor: false,
      wrap: false,
      transformers: [
        transformerFileName({ style: "v2", hideDot: false }),
        transformerNotationHighlight(),
        transformerNotationWordHighlight(),
        transformerNotationDiff({ matchAlgorithm: "v3" }),
      ],
    },
  },
  vite: {
    // eslint-disable-next-line
    // @ts-ignore
    // This will be fixed in Astro 6 with Vite 7 support
    // See: https://github.com/withastro/astro/issues/14030
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ["@resvg/resvg-js"],
    },
  },
  image: {
    responsiveStyles: true,
    layout: "constrained",
  },
  env: {
    schema: {
      PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
      PUBLIC_NAVER_SITE_VERIFICATION: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
    },
  },
  experimental: {
    preserveScriptOrder: true,
    fonts: [
      {
        name: "Google Sans Code",
        cssVariable: "--font-google-sans-code",
        provider: fontProviders.google(),
        fallbacks: ["monospace"],
        weights: [300, 400, 500, 600, 700],
        styles: ["normal", "italic"],
      },
    ],
  },
});
