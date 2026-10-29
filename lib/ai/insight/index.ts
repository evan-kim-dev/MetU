import "server-only";

import { createHash } from "node:crypto";
import { JSON_AI_MODES, type AiMode } from "@/lib/ai/contracts";
import { geminiText } from "@/lib/ai/gemini";
import { INSIGHT_MODES } from "@/lib/ai/insight/modes";
import {
  AiInputError,
  buildInsightSystem,
  sanitizeUserPrompt,
} from "@/lib/ai/insight/prompts";
import { getOrSet } from "@/lib/server/cache";

export type InsightResult = {
  content: string;
  source: "ai";
  validated: boolean;
  cached: boolean;
};

function cacheKey(mode: AiMode, system: string, prompt: string): string {
  const h = createHash("sha256")
    .update(mode)
    .update("\0")
    .update(system)
    .update("\0")
    .update(prompt)
    .digest("hex")
    .slice(0, 32);
  return `ai:${mode}:${h}`;
}

export async function runInsight(args: {
  mode: AiMode;
  prompt: string;
  system?: string;
  userId: string;
}): Promise<InsightResult> {
  const cfg = INSIGHT_MODES[args.mode];
  const prompt = sanitizeUserPrompt(args.prompt);
  const system = buildInsightSystem(args.mode, args.system);
  const wantJson = cfg.json || JSON_AI_MODES.has(args.mode);

  const invoke = async (): Promise<InsightResult> => {
    const res = await geminiText({
      model: cfg.model,
      system,
      input: prompt,
      purpose: `insight:${args.mode}`,
      userId: args.userId,
      json: wantJson,
    });
    if (!res.ok || !res.data) {
      throw new Error(res.ok === false ? res.error : "empty");
    }
    return {
      content: res.data,
      source: "ai",
      validated: true,
      cached: false,
    };
  };

  if (cfg.cacheTtlSec <= 0) {
    return invoke();
  }

  const key = cacheKey(args.mode, system, prompt);
  const cached = await getOrSet(key, cfg.cacheTtlSec, invoke, {
    staleIfError: true,
  });
  return {
    ...cached.value,
    cached: cached.hit === "fresh" || cached.hit === "stale",
  };
}

export { AiInputError, INSIGHT_MODES };
