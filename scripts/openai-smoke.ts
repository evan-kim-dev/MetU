/**
 * Live OpenAI smoke (manual). Does not print the API key.
 * Usage: npx tsx scripts/openai-smoke.ts
 * Requires OPENAI_API_KEY in env (or .env.local loaded manually).
 */
import OpenAI from "openai";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function loadDotEnvLocal() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnvLocal();

const apiKey = process.env.OPENAI_API_KEY?.trim();
if (!apiKey) {
  console.error("OPENAI_API_KEY missing — skip live smoke");
  process.exit(0);
}

const modelMain = process.env.OPENAI_MODEL_MAIN?.trim() || "gpt-4o";
const modelFast = process.env.OPENAI_MODEL_FAST?.trim() || "gpt-4o-mini";

const openai = new OpenAI({ apiKey });

async function main() {
  console.log(`fast model=${modelFast}`);
  const fast = await openai.chat.completions.create({
    model: modelFast,
    messages: [
      { role: "system", content: "Reply with one short word." },
      { role: "user", content: "ping" },
    ],
  });
  console.log("fast ok", Boolean(fast.choices[0]?.message?.content?.trim()));

  console.log(`main model=${modelMain}`);
  const mainRes = await openai.chat.completions.create({
    model: modelMain,
    messages: [
      { role: "system", content: "Reply with JSON only." },
      { role: "user", content: 'Return {"ok":true}' },
    ],
    response_format: { type: "json_object" },
  });
  const text = mainRes.choices[0]?.message?.content?.trim() ?? "";
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  console.log("main json ok", Boolean(parsed && typeof parsed === "object"));
}

main().catch((err) => {
  console.error("smoke failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
