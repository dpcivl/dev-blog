import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./prompt.mjs";
import { validateAll } from "./validate.mjs";
import { rewriteAnchors } from "./anchor-rewrite.mjs";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
// 살아있는 문서(blog-beyond-astropaper-what-i-added 등)가 계속 길어져서 8000 으로는
// 잘린다. 출력 토큰은 실제 사용분만 과금되므로 상한을 넉넉히 둔다.
const MAX_TOKENS = Number(process.env.TRANSLATE_MAX_TOKENS || 32000);
// Pricing per 1M tokens (Sonnet 5 intro pricing through 2026-08-31: $2/$10)
const PRICE_IN = 2;
const PRICE_OUT = 10;
const PRICE_CACHE_WRITE = 2.5; // 1.25x input
const PRICE_CACHE_READ = 0.2;  // 0.1x input

/**
 * Translate a single Korean markdown file to English.
 * @param {object} opts
 * @param {string} opts.koPath - Absolute path to KR .md file
 * @param {string} opts.enPath - Absolute path to write EN .md file
 * @param {Anthropic} opts.client - Anthropic client
 * @param {boolean} [opts.dryRun=false] - If true, don't write file, just print
 * @returns {Promise<{ok: boolean, issues: string[], usage: object, cost: number}>}
 */
export async function translateOne({ koPath, enPath, client, dryRun = false }) {
  const koContent = await fs.readFile(koPath, "utf8");

  // 스트리밍으로 받는다 — max_tokens 가 크면 SDK 가 non-streaming 요청을
  // "Streaming is required (10분 초과 가능)" 으로 거부한다.
  const response = await client.messages
    .stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
      messages: [
        {
          role: "user",
          content: `Translate the following Korean markdown blog post to English. Return only the translated markdown, starting with the YAML frontmatter block.

<post>
${koContent}
</post>`,
        },
      ],
    })
    .finalMessage();

  // 출력 상한에 걸리면 응답이 문장 중간에서 끊긴다. 그대로 쓰면 EN 포스트가
  // 반쪽짜리로 발행되므로 여기서 멈춘다 (validator 경고만으로는 놓친다).
  if (response.stop_reason === "max_tokens") {
    throw new Error(
      `translation truncated: hit max_tokens (${MAX_TOKENS}). ` +
        `Raise TRANSLATE_MAX_TOKENS or split the post. File not written: ${enPath}`
    );
  }

  const rawEnContent = response.content
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("")
    .trim();

  // Post-process: rewrite KR anchor slugs to EN heading slugs on internal links.
  // The model preserves anchors verbatim (per prompt.mjs), so cross-post links
  // land on the KR anchor which doesn't exist on the EN page.
  const blogDir = path.resolve(path.dirname(koPath), "..");
  const { content: enContent, rewrites } = await rewriteAnchors({
    enContent: rawEnContent,
    koContent,
    blogDir,
  });

  const validation = validateAll(koContent, enContent);

  const usage = response.usage || {};
  const cacheWrite = usage.cache_creation_input_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;
  const regularIn = usage.input_tokens || 0;
  const out = usage.output_tokens || 0;

  const cost =
    (cacheWrite * PRICE_CACHE_WRITE +
      cacheRead * PRICE_CACHE_READ +
      regularIn * PRICE_IN +
      out * PRICE_OUT) /
    1_000_000;

  if (!dryRun) {
    await fs.mkdir(path.dirname(enPath), { recursive: true });
    await fs.writeFile(enPath, enContent, "utf8");
  }

  return {
    ok: validation.ok,
    issues: validation.issues,
    usage: {
      cache_write: cacheWrite,
      cache_read: cacheRead,
      input: regularIn,
      output: out,
    },
    cost,
    content: enContent,
    anchorRewrites: rewrites,
  };
}

export function makeClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env in project root."
    );
  }
  return new Anthropic({ apiKey });
}
