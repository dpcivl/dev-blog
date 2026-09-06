export const SITE = {
  website: "https://parkhyo.in/",
  author: "박효인",
  profile: "https://github.com/dpcivl",
  desc: "학습 기록과 개발 경험을 정리하는 공간",
  title: "Park Hyoin",
  ogImage: "", // 빈 값 → src/pages/og.png.ts 의 동적 생성 사용
  lightAndDarkMode: true,
  postPerIndex: 8, // 홈의 "최근 기록" 표시 갯수
  featuredPostsPerIndex: 5, // (미사용) 홈 Featured 섹션 폐지 — featured 는 최근 기록에서 ★ 로 표시
  postPerPage: 4,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showBackButton: true, // show back button in post detail
  editPost: {
    enabled: true,
    text: "Edit page",
    url: "https://github.com/dpcivl/dev-blog/edit/main/",
  },
  dynamicOgImage: true,
  dir: "ltr", // "rtl" | "auto"
  lang: "ko", // html lang code. Set this empty and default will be "en"
  timezone: "Asia/Seoul", // Default global timezone (IANA format) https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
} as const;
