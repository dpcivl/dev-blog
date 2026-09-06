import eslintPluginAstro from "eslint-plugin-astro";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  { rules: { "no-console": "error" } },
  {
    // scripts/ 는 터미널에서 직접 돌리는 CLI 도구다. 진행 상황과 결과를
    // 콘솔로 알리는 게 이 파일들의 존재 이유라 no-console 을 적용하지 않는다.
    files: ["scripts/**/*.{js,mjs,ts}"],
    rules: { "no-console": "off" },
  },
  { ignores: ["dist/**", ".astro", "public/pagefind/**"] },
];
