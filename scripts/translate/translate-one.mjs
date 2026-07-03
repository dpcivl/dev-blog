import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./prompt.mjs";
import { validateAll } from "./validate.mjs";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const MAX_TOKENS = 8000;
// Pricing per 1M tokens (Sonnet 4.5)
const PRICE_IN = 3;
const PRICE_OUT = 15;
const PRICE_CACHE_WRITE = 3.75;
const PRICE_CACHE_READ = 0.3;

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

  const response = await client.messages.create({
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
  });

  const enContent = response.content
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("")
    .trim();

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
