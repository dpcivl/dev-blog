// mermaid 소스의 라벨만 한국어 → 영어로 옮긴다. 문법은 건드리지 않는다.
//
// 왜 따로 있나 (2026-11-14):
// 발행 절차는 이제 「번역 → 렌더」 순서라서 새 글의 다이어그램은 글과 함께
// 번역된다 (prompt.mjs 규칙 8). 이 스크립트는 **이미 발행된 글**을 위한
// 것이다. 그 글들은 원본이 없어 SVG 에서 되살렸고 (src/data/mermaid/restored/),
// 그 복원본의 라벨을 영어로 옮기는 데 쓴다.
//
// 쓰임:
//   node scripts/translate/mermaid-labels.mjs <입력디렉토리> <출력디렉토리> [--dry]
//
// 각 <hash>.mmd 마다, 그 해시를 참조하는 EN 글의 <img alt="…"> 를 함께 넘긴다.
// 이미 영어로 번역된 설명이라 용어를 본문과 맞추는 근거가 된다.

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { FALLBACK_OPTS } from "./translate-one.mjs";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MAX_TOKENS = 8000;
const PRICE_IN = 2;
const PRICE_OUT = 10;
const PRICE_CACHE_WRITE = 2.5;
const PRICE_CACHE_READ = 0.1;

const SYSTEM = `You translate the human-readable labels inside a mermaid diagram source from Korean to English. The diagram is from a Korean developer's learning blog; the English version of the post is published alongside it.

# Translate ONLY label text
- node labels, edge labels, subgraph titles
- sequenceDiagram: participant display names (after \`as\`), message text, Note text
- the \`%% alt: …\` accessibility comment

# Keep the mermaid SYNTAX byte-for-byte
- the diagram type line (flowchart LR, flowchart TD, sequenceDiagram, …)
- node ids and participant ids — NEVER rename them, even if they are Korean
- arrows and links: -->, ---, -.->, ==>, ->>, -->>, and the |"…"| label markers
- brackets and shapes: ["…"], {"…"}, (("…")), [("…")], [["…"]]
- \`subgraph\` / \`end\` / \`direction\` / \`style\` / \`classDef\` / \`class\` / \`participant\` / \`Note over\`
- indentation and line order
- \`<br/>\` line breaks — keep them where they are

# Keep these tokens as-is (do NOT translate)
- column / table / key names: line_id FK, equip_id FK, name, description
- Cypher relationship types and labels: USES, HAS_PART, TRIGGERED, Equipment, Alarm
- identifiers and sample values: abc123, 1536
- product and library names: Neo4j, Chroma, pandas, Redis, DataFrame, Series, JWT
- Korean personal names in sample data → transliterate (김철수 → Kim Chulsoo)

# Keep labels TERSE
A diagram's width comes from its longest label. A wordy English label makes the
whole diagram wide and it gets shrunk on phones. Prefer the short noun phrase
over a literal rendering: "맥락을 붙인다" → "Add context", not "Attach the
context to it".

Return ONLY the mermaid source. No code fences, no commentary.`;

function parseArgs() {
  const a = process.argv.slice(2);
  const dry = a.includes("--dry");
  const [inDir, outDir] = a.filter(x => !x.startsWith("--"));
  if (!inDir || !outDir) {
    console.error(
      "Usage: node scripts/translate/mermaid-labels.mjs <입력디렉토리> <출력디렉토리> [--dry]"
    );
    process.exit(1);
  }
  return { inDir, outDir, dry };
}

// EN 글에서 각 해시의 alt 를 모은다 (이미 영어로 번역된 설명).
async function collectAlts() {
  const out = {};
  const dir = "src/data/blog/en";
  for (const f of await fs.readdir(dir)) {
    if (!f.endsWith(".md")) continue;
    const body = await fs.readFile(path.join(dir, f), "utf8");
    const title = (body.match(/^title:\s*"?(.+?)"?\s*$/m) || [])[1] || "";
    const rx = /<img src="\/assets\/mermaid\/([0-9a-f]+)\.svg" alt="([^"]*)"/g;
    let m;
    while ((m = rx.exec(body)) !== null) {
      out[m[1]] = {
        alt: m[2]
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&#39;/g, "'"),
        post: f.replace(/\.md$/, ""),
        title,
      };
    }
  }
  return out;
}

// 문법이 보존됐는지 본다. 번역이 구조를 깨면 다이어그램이 달라진다.
export function checkStructure(ko, en) {
  const issues = [];
  const ids = s => [...s.matchAll(/^\s*([A-Za-z0-9가-힣_]+)[\[{(]/gm)].map(m => m[1]).sort();
  const arrows = s => (s.match(/-{2,3}>|-\.->|={2}>|->>|-->>/g) || []).length;
  const subs = s => (s.match(/^\s*subgraph\b/gm) || []).length;
  const ends = s => (s.match(/^\s*end\s*$/gm) || []).length;
  const brs = s => (s.match(/<br\/>/g) || []).length;
  const firstLine = s =>
    s.split("\n").find(l => l.trim() && !l.trim().startsWith("%%"))?.trim() || "";

  if (firstLine(ko) !== firstLine(en))
    issues.push(`다이어그램 종류/방향 줄이 달라졌다: "${firstLine(ko)}" → "${firstLine(en)}"`);
  const [a, b] = [ids(ko), ids(en)];
  if (JSON.stringify(a) !== JSON.stringify(b))
    issues.push(`노드 id 가 달라졌다: [${a}] → [${b}]`);
  if (arrows(ko) !== arrows(en))
    issues.push(`화살표 수가 달라졌다: ${arrows(ko)} → ${arrows(en)}`);
  if (subs(ko) !== subs(en) || ends(ko) !== ends(en))
    issues.push(`subgraph/end 수가 달라졌다: ${subs(ko)}/${ends(ko)} → ${subs(en)}/${ends(en)}`);
  if (brs(ko) !== brs(en))
    issues.push(`<br/> 수가 달라졌다: ${brs(ko)} → ${brs(en)}`);
  // 한글 잔존 검사는 **라벨만** 본다. 노드·서브그래프 id 는 한글이어도
  // 괜찮다 — 렌더 결과에 나타나지 않고, 바꾸면 엣지 선언과 어긋난다.
  // (실제 사례: subgraph 세션["Session — …"] — id 는 세션, 라벨은 영어)
  const labelText = [
    ...[...en.matchAll(/"([^"]*)"/g)].map(m => m[1]),           // ["…"] {"…"} |"…"|
    ...[...en.matchAll(/^\s*%%\s*alt:\s*(.+)$/gim)].map(m => m[1]),
    ...[...en.matchAll(/^\s*participant\s+\S+\s+as\s+(.+)$/gim)].map(m => m[1]),
    ...[...en.matchAll(/^\s*(?:Note\s+(?:over|left of|right of)\s+[^:]+|[^:\n]*?)\s*:\s*(.+)$/gim)].map(m => m[1]),
  ].join("\n");
  const left = (labelText.match(/[가-힣]+/g) || []).filter(t => t.length > 1);
  if (left.length) issues.push(`라벨에 한글이 남았다: ${[...new Set(left)].slice(0, 6).join(", ")}`);
  return issues;
}

async function main() {
  const { inDir, outDir, dry } = parseArgs();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY 가 없습니다. .env 를 확인하세요.");
    process.exit(1);
  }
  const client = new Anthropic({ apiKey });
  const alts = await collectAlts();
  const files = (await fs.readdir(inDir)).filter(f => f.endsWith(".mmd")).sort();
  if (!dry) await fs.mkdir(outDir, { recursive: true });

  let cost = 0;
  const problems = [];
  for (const f of files) {
    const hash = path.basename(f, ".mmd");
    const ko = await fs.readFile(path.join(inDir, f), "utf8");
    const ctx = alts[hash];

    const userMsg = [
      ctx
        ? `This diagram appears in the published English post "${ctx.title}" (${ctx.post}).\nIts English alt text, already translated, is given for terminology:\n<alt>\n${ctx.alt}\n</alt>\n`
        : "",
      `Translate the labels in this mermaid source:\n<mermaid>\n${ko}\n</mermaid>`,
    ].join("\n");

    const t0 = Date.now();
    const res = await client.beta.messages
      .stream({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        ...FALLBACK_OPTS,
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userMsg }],
      })
      .finalMessage();

    // fallback 모델까지 거절하면 본문이 비어 있다. 빈 파일을 쓰지 않고 넘어간다.
    if (res.stop_reason === "refusal") {
      console.log(`  → ${hash} ✗ 거절됨 (${res.stop_details?.category ?? "no category"}) — 파일 안 씀`);
      problems.push({ hash, issues: ["refused"] });
      continue;
    }

    let en = res.content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("")
      .trim();
    en = en.replace(/^```[a-z]*\n/i, "").replace(/\n```$/, "").trim() + "\n";

    const u = res.usage;
    const c =
      ((u.input_tokens || 0) * PRICE_IN +
        (u.output_tokens || 0) * PRICE_OUT +
        (u.cache_creation_input_tokens || 0) * PRICE_CACHE_WRITE +
        (u.cache_read_input_tokens || 0) * PRICE_CACHE_READ) /
      1e6;
    cost += c;

    const issues = checkStructure(ko, en);
    const mark = issues.length ? "✗" : "✓";
    console.log(
      `  → ${hash} ${mark} ${((Date.now() - t0) / 1000).toFixed(1)}s | $${c.toFixed(4)}${ctx ? "" : "  (alt 문맥 없음)"}`
    );
    issues.forEach(i => console.log(`      ! ${i}`));
    if (issues.length) problems.push({ hash, issues });

    if (!dry) await fs.writeFile(path.join(outDir, f), en, "utf8");
  }

  console.log(`\n== SUMMARY ==`);
  console.log(`  번역 ${files.length}건 — 문법 이상 ${problems.length}건`);
  console.log(`  총 비용 $${cost.toFixed(4)}`);
  if (problems.length) {
    console.log(`\n  손봐야 할 것:`);
    problems.forEach(p => console.log(`    ${p.hash}: ${p.issues.join(" / ")}`));
  }
}

// 직접 실행할 때만 돈다. import 하면 checkStructure 만 쓸 수 있다 (테스트용).
const invokedDirectly =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (invokedDirectly) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
