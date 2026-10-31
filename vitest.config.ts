import { defineConfig } from "vitest/config";

// 테스트는 tests/ 안에만 둔다. Astro 컴포넌트는 이 러너로 돌리지 않는다 —
// 지금 테스트하는 것은 발행 검사와 서버 쪽 순수 함수뿐이다.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.mjs"],
    exclude: ["node_modules/**", "dist/**", ".astro/**"],
  },
});
