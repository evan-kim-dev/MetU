/**
 * Manual smoke for Gemini Interactions API.
 * Usage: npx tsx scripts/gemini-smoke.ts
 * Requires GEMINI_API_KEY in env (or .env.local loaded manually).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { GoogleGenAI } from "@google/genai";

function loadDotEnvLocal(): void {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadDotEnvLocal();

const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) {
  console.error("GEMINI_API_KEY missing — skip live smoke");
  process.exit(1);
}

const modelMain = process.env.GEMINI_MODEL_MAIN?.trim() || "gemini-3.8-flash";
const modelFast =
  process.env.GEMINI_MODEL_FAST?.trim() || "gemini-3.5-flash-lite";
const thinkMain = process.env.GEMINI_THINKING_MAIN?.trim() || "low";
const thinkFast = process.env.GEMINI_THINKING_FAST?.trim() || "minimal";

const ai = new GoogleGenAI({ apiKey });

const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function timed<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const t0 = Date.now();
  try {
    const result = await fn();
    console.log(`[ok] ${label} ${Date.now() - t0}ms`);
    return result;
  } catch (err) {
    console.error(`[fail] ${label} ${Date.now() - t0}ms`, err);
    throw err;
  }
}

async function structured(): Promise<void> {
  const interaction = await timed("structured", () =>
    ai.interactions.create({
      model: modelFast,
      store: false,
      system_instruction: "Return JSON only.",
      input: "What is 2+3? Respond as {\"sum\": number}",
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: {
          type: "object",
          properties: { sum: { type: "number" } },
          required: ["sum"],
        },
      },
      generation_config: { thinking_level: thinkFast },
    })
  );
  console.log({
    model: modelFast,
    thinking: thinkFast,
    text: interaction.output_text,
    usage: interaction.usage,
  });
}

async function vision(): Promise<void> {
  const interaction = await timed("vision", () =>
    ai.interactions.create({
      model: modelMain,
      store: false,
      system_instruction: "Describe the image briefly as JSON {\"desc\": string}.",
      input: [
        { type: "text", text: "What do you see?" },
        { type: "image", data: TINY_PNG_B64, mime_type: "image/png" },
      ],
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: {
          type: "object",
          properties: { desc: { type: "string" } },
          required: ["desc"],
        },
      },
      generation_config: { thinking_level: thinkMain },
    })
  );
  console.log({
    model: modelMain,
    thinking: thinkMain,
    text: interaction.output_text,
    usage: interaction.usage,
  });
}

async function tools(): Promise<void> {
  let interaction = await timed("tools-call", () =>
    ai.interactions.create({
      model: modelFast,
      store: false,
      system_instruction: "Use the add tool to compute sums.",
      input: "What is 7 + 8? Use the add tool.",
      tools: [
        {
          type: "function",
          name: "add",
          description: "Add two numbers",
          parameters: {
            type: "object",
            properties: {
              a: { type: "number" },
              b: { type: "number" },
            },
            required: ["a", "b"],
          },
        },
      ],
      generation_config: { thinking_level: thinkFast },
    })
  );

  const steps = interaction.steps ?? [];
  const calls = steps.filter((s) => s.type === "function_call");
  console.log({
    model: modelFast,
    steps: steps.map((s) => s.type),
    calls,
    usage: interaction.usage,
  });

  if (calls.length === 0) {
    console.warn("No function_call in first turn; text=", interaction.output_text);
    return;
  }

  const results = calls.map((c) => {
    const args = ("arguments" in c ? c.arguments : {}) as {
      a?: number;
      b?: number;
    };
    const sum = Number(args.a ?? 0) + Number(args.b ?? 0);
    return {
      type: "function_result" as const,
      name: "name" in c ? String(c.name) : "add",
      call_id: "id" in c ? String(c.id) : "",
      result: String(sum),
    };
  });

  interaction = await timed("tools-result", () =>
    ai.interactions.create({
      model: modelFast,
      store: false,
      previous_interaction_id: interaction.id,
      input: results,
      generation_config: { thinking_level: thinkFast },
    })
  );
  console.log({
    text: interaction.output_text,
    usage: interaction.usage,
  });
}

async function main(): Promise<void> {
  console.log("Gemini smoke starting…", { modelMain, modelFast, thinkMain, thinkFast });
  await structured();
  await vision();
  await tools();
  console.log("Gemini smoke done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
