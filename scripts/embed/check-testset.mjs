// 테스트셋을 채점에 쓰기 전에 검사한다.
//
//   node scripts/embed/check-testset.mjs
//
// 왜 필요한가: 예전 측정에서 easy 문항 두 개를 두 모델 다 놓쳤는데,
// 원인이 모델이 아니라 질문의 오타였다. 채점 기준이 틀리면 모델을 아무리
// 재도 헛수고다. 그래서 재기 전에 테스트셋부터 본다.
//
// 검사 항목
//   1. slug 가 실제로 있는가 (오타 · 없어진 글)
//   2. 부정 문항이 정말 "없는 주제" 인가 (코퍼스에 낱말이 있으면 경고)
//   3. hard 문항이 정답 글의 제목을 베끼지 않았는가 (easy 는 겹쳐도 정상)
//   4. easy / hard 균형
//   5. id 중복

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const BLOG = "src/data/blog/ko";
const FILE = "scripts/embed/testset.jsonl";

// ── 읽기 ──
const raw = await readFile(FILE, "utf8");
const rows = [];
let lineNo = 0;
for (const line of raw.split("\n")) {
  lineNo++;
  const t = line.trim();
  if (!t || t.startsWith("//")) continue;
  try {
    rows.push({ ...JSON.parse(t), _line: lineNo });
  } catch {
    console.error(`❌ L${lineNo}: JSON 이 깨졌다 — ${t.slice(0, 60)}`);
    process.exit(1);
  }
}

// ── 코퍼스 ──
const files = (await readdir(BLOG)).filter(f => f.endsWith(".md"));
const slugs = new Set(files.map(f => f.replace(/\.md$/, "")));
const titles = new Map();
let corpus = "";
for (const f of files) {
  const text = await readFile(path.join(BLOG, f), "utf8");
  corpus += text.toLowerCase() + "\n";
  const m = text.match(/^title:\s*"?(.+?)"?\s*$/m);
  if (m) titles.set(f.replace(/\.md$/, ""), m[1]);
}

const norm = s => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const STOP = new Set([
  "어떻게", "왜", "무엇", "뭐", "어디", "언제", "관련", "대해", "대한", "있나요",
  "있어", "알려줘", "방법", "이유", "하나요", "하나", "되나", "되나요", "그런",
  "정도", "때", "것", "거", "수", "좀", "내가", "우리",
]);
const words = q =>
  q
    .split(/[\s,.?!·…"'"''()[\]]+/)
    .map(w => w.replace(/[은는이가을를의에서로와과도만]$/u, "") || w)
    .filter(w => norm(w).length >= 2 && !STOP.has(w));

// ── 검사 ──
const problems = [];
const warnings = [];
const seen = new Set();
let pos = 0, neg = 0, easy = 0, hard = 0, titleish = 0;

for (const r of rows) {
  const at = `L${r._line} ${r.id ?? "(id 없음)"}`;

  if (!r.id) problems.push(`${at}: id 가 없다`);
  else if (seen.has(r.id)) problems.push(`${at}: id 중복`);
  seen.add(r.id);

  if (!r.question?.trim()) problems.push(`${at}: question 이 비었다`);
  if (!Array.isArray(r.answer_sources))
    problems.push(`${at}: answer_sources 는 배열이어야 한다`);

  const isNeg = (r.answer_sources ?? []).length === 0;
  if (isNeg) {
    neg++;
    // 부정 문항인데 코퍼스에 낱말이 많이 있으면 진짜 부정이 아닐 수 있다
    const ws = words(r.question ?? "");
    const hit = ws.filter(w => corpus.includes(w.toLowerCase()));
    if (ws.length && hit.length === ws.length) {
      warnings.push(
        `${at}: 낱말이 전부 블로그에 있다 (${hit.join(" · ")}) — 정말 없는 주제인지 확인할 것`
      );
    }
  } else {
    pos++;
    for (const s of r.answer_sources) {
      if (!slugs.has(s)) problems.push(`${at}: slug 없음 — "${s}"`);
    }
    if (r.level === "easy") easy++;
    else if (r.level === "hard") hard++;
    else problems.push(`${at}: level 은 easy 또는 hard`);

    // 제목과 낱말이 겹치는지 본다.
    //
    // easy 는 "글에 있는 낱말을 쓴다" 가 정의라 겹치는 게 정상이다. 작성자가
    // "나라면 키워드로 검색한다" 고 해서 easy 를 키워드형으로 고쳐 쓴 뒤로는
    // 겹침이 오히려 실제 사용에 가깝다. 그래서 세기만 하고 경고하지 않는다.
    //
    // hard 에서 겹치면 라벨이 잘못 붙은 것이다 — 낱말을 피했어야 하는데
    // 안 피한 문항이므로 경고한다.
    for (const s of r.answer_sources) {
      const title = titles.get(s);
      if (!title) continue;
      const tw = new Set(words(title).map(norm));
      const qw = words(r.question).map(norm);
      const overlap = qw.filter(w => tw.has(w));
      if (qw.length < 2 || overlap.length / qw.length < 0.7) continue;
      const pct = Math.round((overlap.length / qw.length) * 100);
      if (r.level === "hard") {
        warnings.push(`${at}: hard 인데 정답 글 제목과 낱말이 ${pct}% 겹친다 — easy 로 옮기거나 낱말을 피해 다시 쓸 것`);
      } else {
        titleish++;
      }
    }
  }
}

// ── 보고 ──
console.log(`문항      긍정 ${pos} · 부정 ${neg} · 합계 ${rows.length}`);
console.log(`난이도    easy ${easy} · hard ${hard}`);
console.log(`제목겹침   easy ${titleish}개 (키워드 검색 흉내 — 정상)`);
console.log();

const want = [];
if (pos < 30) want.push(`긍정 ${30 - pos}개 더`);
if (neg < 15) want.push(`부정 ${15 - neg}개 더`);
if (hard < 15) want.push(`hard ${15 - hard}개 더`);
if (want.length) console.log(`📋 권장까지: ${want.join(" · ")}\n`);

if (problems.length) {
  console.log(`❌ 고쳐야 할 것 ${problems.length}개`);
  problems.forEach(p => console.log(`   ${p}`));
  console.log();
}
if (warnings.length) {
  console.log(`⚠️  확인해볼 것 ${warnings.length}개`);
  warnings.forEach(w => console.log(`   ${w}`));
  console.log();
}
if (!problems.length && !warnings.length) console.log("✅ 문제 없음");

process.exit(problems.length ? 1 : 0);
