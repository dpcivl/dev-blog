# 블로그 관측 로그

Vercel Analytics 스냅샷을 정기적으로 남긴다. 같은 지표를 반복 관측해서 성장 · 회귀 · 개선 효과를 감지하기 위함.

## 관측 주기

- **매 30일** 이 원칙 (Vercel Analytics 의 "Last 30 Days" 뷰 기준)
- 큰 변화 (SEO 개선 · 새 카테고리 · 대형 콘텐츠 발행) 직후에는 그 시점으로부터 30-60일 후 별도 관측
- 대시보드: [dev-blog · Vercel Analytics](https://vercel.com/dpcivl/dev-blog/analytics)

## 매번 기록하는 지표

| # | 지표 | 왜 보는가 |
|---|---|---|
| 1 | Visitors (30d) | 절대 성장 |
| 2 | Page Views (30d) | 절대 노출 |
| 3 | **Pages / Visitor** (계산: PV ÷ Visitors) | **탐색 UX 품질** — 커스텀 nav 가 일하는지 |
| 4 | Bounce Rate | 콘텐츠 · 첫 인상 |
| 5 | Top 5 pages | 무엇이 노출되고 있나 |
| 6 | Top referrers | 유입 채널 다양성 |
| 7 | Google 유입 절대값 | SEO 개선 효과 추적 |
| 8 | About 유입 | 채용용 트래픽 시그널 |
| 9 | 스파이크 이벤트 | 튀는 날 원인 → 콘텐츠 전략 힌트 |

## 로그

### 2026-07-10 · 첫 30일 스냅샷 (Jun 14 – Jul 10)

베이스라인. 이 시점 기준 SEO · Perf 개선 (오늘) 은 색인/캐시에 아직 반영 전.

**헤드라인**:

| 지표 | 값 | 판단 |
|---|---|---|
| Visitors | 168 | 일 평균 ~5.6 |
| Page Views | 1,304 | |
| **Pages / Visitor** | **7.8** | **매우 좋음** — 학습 블로그 평균 1.5–2.5 대비 3배+ |
| Bounce Rate | 45% | **좋음** — 블로그 평균 70–80% 대비 절반 |

**Top pages**:

- `/` — 101
- `/posts` — 23
- `/about` — 22 ← nav 링크 없음에도 direct URL 접근
- `/playground` — 19
- `/series` — 16

**Top referrers**:

- google.com — 14
- t.co (X) — 11
- hiring.saramin.co.kr — 9
- vercel.com — 8 (본인 접속 포함 가능성)
- saramin.co.kr — 1

**Direct/Unknown**: ≈125명 (168 − 43 = 리퍼러 안 잡힌 유입, RSS · 링크 직접 · 인앱 브라우저 등)

**주요 이벤트**:

- **6월 21일 스파이크 (15명, 일 평균의 ~3배)** — 원인 미확인. 다음 관측 시 그 날짜 페이지 필터로 확인 예정

**해석**:

- Pages/Visitor 7.8 → 시리즈 · 플레이그라운드 · 태그 nav 커스터마이징이 실제로 방문자를 여러 페이지로 이동시키고 있음
- About 22 방문 + 사람인 계열 리퍼러 10 명 → About 이 nav 에서 감춰졌음에도 **채용 담당자용 랜딩으로 정확히 작동 중**. "About 을 nav 에 노출해야 하나?" 결정에 데이터 근거 확보 (필요 없음)
- Google 14 는 SEO 개선 (JSON-LD 페이지 분기 · description · publisher · inLanguage) 반영 전 수치. 색인 반영에 2–4주 걸리므로 다음 관측치가 실제 효과

**개선 액션 (이 시점 실행)**:

- SEO 강화 · Perf 3종 (오늘 완료) → 색인/캐시 갱신 대기
- 포스트 하단 피드백 CTA 추가 (오늘 완료) → 방문자 상호작용 채널 확보

**다음 관측 (2026-08-10 예정) 시 비교 항목**:

- [ ] Visitors 168 → ? (자연 성장 추이)
- [ ] Google 14 → ? (SEO 개선 효과)
- [ ] Pages/Visitor 7.8 → ? (유지되나)
- [ ] Bounce 45% → ? (유지되나)
- [ ] 6월 21일 스파이크 원인 규명
- [ ] 피드백 CTA 실효성 (수신 이메일 · GitHub Issue 유입 수는 대시보드에 없음. 별도 카운트)

---

<!-- 여기서부터 append. 최신 관측이 위로. -->
