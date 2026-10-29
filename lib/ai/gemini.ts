import "server-only";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { getUsageSink } from "@/lib/ai/usage";

export type GeminiModelKind = "fast" | "main";

export type GeminiOk<T> = {
  ok: true;
  data: T;
  model: string;
  ms: number;
  inputTokens?: number;
  outputTokens?: number;
};

export type GeminiErr = {
  ok: false;
  error: string;
  reason?: string;
  model?: string;
  ms?: number;
};

export type GeminiResult<T> = GeminiOk<T> | GeminiErr;

export type GeminiToolDef<TArgs = unknown> = {
  name: string;
  description: string;
  parameters: z.ZodType<TArgs>;
  run: (args: TArgs) => Promise<unknown> | unknown;
};

export type GeminiToolStep = {
  tool: string;
  input: unknown;
  output: unknown;
  ms: number;
  ok: boolean;
};

type InteractionLike = {
  id: string;
  output_text?: string;
  steps?: Array<{
    type: string;
    name?: string;
    id?: string;
    arguments?: Record<string, unknown>;
  }>;
  usage?: {
    total_input_tokens?: number;
    total_output_tokens?: number;
  };
};

type CreateParams = Record<string, unknown>;

export type GeminiInteractionsClient = {
  interactions: {
    create: (
      params: CreateParams,
      options?: { timeout?: number; abortSignal?: AbortSignal }
    ) => Promise<InteractionLike>;
  };
};

const MAX_INLINE_IMAGE_BYTES = 20 * 1024 * 1024;

let clientOverride: GeminiInteractionsClient | null = null;

export function setGeminiClientForTests(
  client: GeminiInteractionsClient | null
): void {
  clientOverride = client;
}

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name] ?? "");
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function modelName(kind: GeminiModelKind): string {
  if (kind === "main") {
    return (
      process.env.GEMINI_MODEL_MAIN?.trim() || "gemini-3.8-flash"
    );
  }
  return (
    process.env.GEMINI_MODEL_FAST?.trim() || "gemini-3.5-flash-lite"
  );
}

function thinkingLevel(kind: GeminiModelKind): string {
  if (kind === "main") {
    return process.env.GEMINI_THINKING_MAIN?.trim() || "low";
  }
  return process.env.GEMINI_THINKING_FAST?.trim() || "minimal";
}

function timeoutMs(): number {
  return envInt("GEMINI_TIMEOUT_MS", 25_000);
}

function maxRetries(): number {
  return envInt("GEMINI_MAX_RETRIES", 2);
}

function dailyCap(): number {
  return envInt("AGENT_DAILY_LLM_CALLS", 200);
}

function getApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key || null;
}

function getClient(): GeminiInteractionsClient | null {
  if (clientOverride) return clientOverride;
  const key = getApiKey();
  if (!key) return null;
  const ai = new GoogleGenAI({ apiKey: key });
  return ai as unknown as GeminiInteractionsClient;
}

function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const raw = z.toJSONSchema(schema) as Record<string, unknown>;
  // Gemini rejects some meta keys; keep a plain JSON Schema object.
  const { $schema: _s, ...rest } = raw;
  return rest;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(err: unknown): boolean {
  const status =
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof (err as { status: unknown }).status === "number"
      ? (err as { status: number }).status
      : null;
  if (status === 429 || (status !== null && status >= 500)) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /\b429\b|rate.?limit|unavailable|timeout|5\d\d/i.test(msg);
}

async function withRetries<T>(
  fn: (attempt: number) => Promise<T>
): Promise<T> {
  const retries = maxRetries();
  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      last = err;
      if (attempt >= retries || !isRetryableStatus(err)) throw err;
      await sleep(Math.min(4000, 400 * 2 ** attempt));
    }
  }
  throw last;
}

async function guardDaily(userId: string): Promise<GeminiErr | null> {
  const sink = getUsageSink();
  const used = await sink.countToday(userId);
  if (used >= dailyCap()) {
    return { ok: false, error: "daily_llm_cap" };
  }
  return null;
}

async function recordUsage(args: {
  userId: string;
  tripId?: string;
  model: string;
  purpose: string;
  ms: number;
  ok: boolean;
  inputTokens?: number;
  outputTokens?: number;
}): Promise<void> {
  try {
    await getUsageSink().record({
      userId: args.userId,
      tripId: args.tripId ?? null,
      model: args.model,
      purpose: args.purpose,
      inputTokens: args.inputTokens ?? null,
      outputTokens: args.outputTokens ?? null,
      ms: args.ms,
      ok: args.ok,
    });
  } catch {
    // usage logging must not break agent path
  }
}

function extractFunctionCalls(
  interaction: InteractionLike
): Array<{ id: string; name: string; arguments: Record<string, unknown> }> {
  const steps = interaction.steps ?? [];
  const out: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }> = [];
  for (const step of steps) {
    if (step.type !== "function_call") continue;
    if (!step.name || !step.id) continue;
    out.push({
      id: step.id,
      name: step.name,
      arguments: step.arguments ?? {},
    });
  }
  return out;
}

async function createInteraction(
  client: GeminiInteractionsClient,
  params: CreateParams
): Promise<InteractionLike> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    return await client.interactions.create(params, {
      timeout: timeoutMs(),
      abortSignal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function geminiText(args: {
  model: GeminiModelKind;
  system: string;
  input: string;
  purpose: string;
  userId: string;
  tripId?: string;
  /** Prefer JSON-only replies (no markdown fences). */
  json?: boolean;
  /** Optional inline images (receipt vision etc.). */
  images?: Array<{ mimeType: string; base64: string }>;
}): Promise<GeminiResult<string>> {
  const started = Date.now();
  const model = modelName(args.model);
  const client = getClient();
  if (!client) {
    return { ok: false, error: "no_api_key", model };
  }

  if (args.images?.length) {
    for (const img of args.images) {
      const bytes = Math.floor((img.base64.length * 3) / 4);
      if (bytes > MAX_INLINE_IMAGE_BYTES) {
        return { ok: false, error: "image_too_large", model };
      }
    }
  }

  const cap = await guardDaily(args.userId);
  if (cap) return { ...cap, model };

  const thinking = thinkingLevel(args.model);
  const system = args.json
    ? `${args.system}\n\n[출력] JSON만 출력하세요. 마크다운 코드펜스 금지.`
    : args.system;

  const input: string | Array<Record<string, unknown>> =
    args.images?.length
      ? [
          { type: "text", text: args.input },
          ...args.images.map((img) => ({
            type: "image",
            data: img.base64,
            mime_type: img.mimeType,
          })),
        ]
      : args.input;

  try {
    const interaction = await withRetries(() =>
      createInteraction(client, {
        model,
        store: false,
        system_instruction: system,
        input,
        response_format: args.json
          ? { type: "text", mime_type: "application/json" }
          : { type: "text" },
        generation_config: {
          thinking_level: thinking,
        },
      })
    );

    const text = interaction.output_text?.trim() ?? "";
    const ms = Date.now() - started;
    const inputTokens = interaction.usage?.total_input_tokens;
    const outputTokens = interaction.usage?.total_output_tokens;

    if (!text) {
      await recordUsage({
        userId: args.userId,
        tripId: args.tripId,
        model,
        purpose: args.purpose,
        ms,
        ok: false,
        inputTokens,
        outputTokens,
      });
      return { ok: false, error: "empty", model, ms };
    }

    await recordUsage({
      userId: args.userId,
      tripId: args.tripId,
      model,
      purpose: args.purpose,
      ms,
      ok: true,
      inputTokens,
      outputTokens,
    });

    return {
      ok: true,
      data: text,
      model,
      ms,
      inputTokens,
      outputTokens,
    };
  } catch (err) {
    const ms = Date.now() - started;
    await recordUsage({
      userId: args.userId,
      tripId: args.tripId,
      model,
      purpose: args.purpose,
      ms,
      ok: false,
    });
    return {
      ok: false,
      error: err instanceof Error ? err.message : "gemini_error",
      model,
      ms,
    };
  }
}

export async function geminiStructured<T>(args: {
  model: GeminiModelKind;
  system: string;
  input: string;
  schema: z.ZodType<T>;
  purpose: string;
  userId: string;
  tripId?: string;
}): Promise<GeminiResult<T>> {
  const started = Date.now();
  const model = modelName(args.model);
  const client = getClient();
  if (!client) {
    return { ok: false, error: "no_api_key", model };
  }

  const cap = await guardDaily(args.userId);
  if (cap) return { ...cap, model };

  const jsonSchema = zodToJsonSchema(args.schema);
  const thinking = thinkingLevel(args.model);

  const runOnce = async (extraHint?: string): Promise<GeminiResult<T>> => {
    const inputText = extraHint
      ? `${args.input}\n\n[Correction]\n${extraHint}`
      : args.input;

    const interaction = await withRetries(() =>
      createInteraction(client, {
        model,
        store: false,
        system_instruction: args.system,
        input: inputText,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: jsonSchema,
        },
        generation_config: {
          thinking_level: thinking,
        },
      })
    );

    const text = interaction.output_text?.trim() ?? "";
    const ms = Date.now() - started;
    const inputTokens = interaction.usage?.total_input_tokens;
    const outputTokens = interaction.usage?.total_output_tokens;

    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      await recordUsage({
        userId: args.userId,
        tripId: args.tripId,
        model,
        purpose: args.purpose,
        ms,
        ok: false,
        inputTokens,
        outputTokens,
      });
      return { ok: false, error: "invalid_json", model, ms };
    }

    const validated = args.schema.safeParse(parsed);
    if (!validated.success) {
      await recordUsage({
        userId: args.userId,
        tripId: args.tripId,
        model,
        purpose: args.purpose,
        ms,
        ok: false,
        inputTokens,
        outputTokens,
      });
      return {
        ok: false,
        error: "zod_failed",
        reason: validated.error.message,
        model,
        ms,
      };
    }

    await recordUsage({
      userId: args.userId,
      tripId: args.tripId,
      model,
      purpose: args.purpose,
      ms,
      ok: true,
      inputTokens,
      outputTokens,
    });

    return {
      ok: true,
      data: validated.data,
      model,
      ms,
      inputTokens,
      outputTokens,
    };
  };

  try {
    const first = await runOnce();
    if (first.ok) return first;
    if (first.error === "zod_failed" || first.error === "invalid_json") {
      const second = await runOnce(
        `이전 응답이 스키마와 맞지 않았습니다. JSON만 출력하고 스키마를 정확히 지키세요. 오류: ${first.reason ?? first.error}`
      );
      return second;
    }
    return first;
  } catch (err) {
    const ms = Date.now() - started;
    await recordUsage({
      userId: args.userId,
      tripId: args.tripId,
      model,
      purpose: args.purpose,
      ms,
      ok: false,
    });
    return {
      ok: false,
      error: err instanceof Error ? err.message : "gemini_error",
      model,
      ms,
    };
  }
}

export async function geminiVision<T>(args: {
  system: string;
  text?: string;
  images: Array<{ mimeType: string; base64: string }>;
  schema: z.ZodType<T>;
  purpose: string;
  userId: string;
  tripId?: string;
  model?: GeminiModelKind;
}): Promise<GeminiResult<T>> {
  const kind = args.model ?? "main";
  const started = Date.now();
  const model = modelName(kind);
  const client = getClient();
  if (!client) {
    return { ok: false, error: "no_api_key", model };
  }

  for (const img of args.images) {
    const bytes = Math.floor((img.base64.length * 3) / 4);
    if (bytes > MAX_INLINE_IMAGE_BYTES) {
      return { ok: false, error: "image_too_large", model };
    }
  }

  const cap = await guardDaily(args.userId);
  if (cap) return { ...cap, model };

  const jsonSchema = zodToJsonSchema(args.schema);
  const thinking = thinkingLevel(kind);
  const input: Array<Record<string, unknown>> = [];
  if (args.text?.trim()) {
    input.push({ type: "text", text: args.text.trim() });
  }
  for (const img of args.images) {
    input.push({
      type: "image",
      data: img.base64,
      mime_type: img.mimeType,
    });
  }

  try {
    const interaction = await withRetries(() =>
      createInteraction(client, {
        model,
        store: false,
        system_instruction: args.system,
        input,
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: jsonSchema,
        },
        generation_config: {
          thinking_level: thinking,
        },
      })
    );

    const text = interaction.output_text?.trim() ?? "";
    const ms = Date.now() - started;
    const inputTokens = interaction.usage?.total_input_tokens;
    const outputTokens = interaction.usage?.total_output_tokens;

    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      await recordUsage({
        userId: args.userId,
        tripId: args.tripId,
        model,
        purpose: args.purpose,
        ms,
        ok: false,
        inputTokens,
        outputTokens,
      });
      return { ok: false, error: "invalid_json", model, ms };
    }

    const validated = args.schema.safeParse(parsed);
    if (!validated.success) {
      await recordUsage({
        userId: args.userId,
        tripId: args.tripId,
        model,
        purpose: args.purpose,
        ms,
        ok: false,
        inputTokens,
        outputTokens,
      });
      return {
        ok: false,
        error: "zod_failed",
        reason: validated.error.message,
        model,
        ms,
      };
    }

    await recordUsage({
      userId: args.userId,
      tripId: args.tripId,
      model,
      purpose: args.purpose,
      ms,
      ok: true,
      inputTokens,
      outputTokens,
    });

    return {
      ok: true,
      data: validated.data,
      model,
      ms,
      inputTokens,
      outputTokens,
    };
  } catch (err) {
    const ms = Date.now() - started;
    await recordUsage({
      userId: args.userId,
      tripId: args.tripId,
      model,
      purpose: args.purpose,
      ms,
      ok: false,
    });
    return {
      ok: false,
      error: err instanceof Error ? err.message : "gemini_error",
      model,
      ms,
    };
  }
}

export async function geminiToolLoop(args: {
  system: string;
  input: string;
  tools: GeminiToolDef[];
  maxCalls?: number;
  purpose: string;
  userId: string;
  tripId?: string;
  model?: GeminiModelKind;
  onStep?: (step: GeminiToolStep) => void | Promise<void>;
}): Promise<GeminiResult<{ text: string; steps: GeminiToolStep[] }>> {
  const kind = args.model ?? "main";
  const started = Date.now();
  const model = modelName(kind);
  const client = getClient();
  if (!client) {
    return { ok: false, error: "no_api_key", model };
  }

  const cap = await guardDaily(args.userId);
  if (cap) return { ...cap, model };

  const maxCalls =
    args.maxCalls ??
    envInt("AGENT_MAX_TOOL_CALLS", 6);
  const thinking = thinkingLevel(kind);
  const toolByName = new Map(args.tools.map((t) => [t.name, t]));
  const sdkTools = args.tools.map((t) => ({
    type: "function" as const,
    name: t.name,
    description: t.description,
    parameters: zodToJsonSchema(t.parameters),
  }));

  const recorded: GeminiToolStep[] = [];
  let interaction: InteractionLike;
  let calls = 0;

  try {
    // Tool loops need store:true so previous_interaction_id works (Gemini Interactions API).
    interaction = await withRetries(() =>
      createInteraction(client, {
        model,
        store: true,
        system_instruction: args.system,
        input: args.input,
        tools: sdkTools,
        generation_config: {
          thinking_level: thinking,
        },
      })
    );

    while (true) {
      const fnCalls = extractFunctionCalls(interaction);
      if (fnCalls.length === 0) break;
      if (calls + fnCalls.length > maxCalls) {
        const ms = Date.now() - started;
        await recordUsage({
          userId: args.userId,
          tripId: args.tripId,
          model,
          purpose: args.purpose,
          ms,
          ok: false,
          inputTokens: interaction.usage?.total_input_tokens,
          outputTokens: interaction.usage?.total_output_tokens,
        });
        return {
          ok: false,
          error: "max_calls",
          reason: "max_calls",
          model,
          ms,
        };
      }

      const results: Array<Record<string, unknown>> = [];
      for (const call of fnCalls) {
        calls += 1;
        const def = toolByName.get(call.name);
        const stepStarted = Date.now();
        let output: unknown;
        let ok = true;
        try {
          if (!def) {
            ok = false;
            output = { error: `unknown_tool:${call.name}` };
          } else {
            const parsed = def.parameters.safeParse(call.arguments);
            if (!parsed.success) {
              ok = false;
              output = { error: "bad_args", detail: parsed.error.message };
            } else {
              output = await def.run(parsed.data);
            }
          }
        } catch (err) {
          ok = false;
          output = {
            error: err instanceof Error ? err.message : "tool_error",
          };
        }
        const step: GeminiToolStep = {
          tool: call.name,
          input: call.arguments,
          output,
          ms: Date.now() - stepStarted,
          ok,
        };
        recorded.push(step);
        await args.onStep?.(step);
        results.push({
          type: "function_result",
          name: call.name,
          call_id: call.id,
          result: typeof output === "string" ? output : JSON.stringify(output),
        });
      }

      interaction = await withRetries(() =>
        createInteraction(client, {
          model,
          store: true,
          previous_interaction_id: interaction.id,
          input: results,
          tools: sdkTools,
          generation_config: {
            thinking_level: thinking,
          },
        })
      );
    }

    const ms = Date.now() - started;
    const text = interaction.output_text?.trim() ?? "";
    await recordUsage({
      userId: args.userId,
      tripId: args.tripId,
      model,
      purpose: args.purpose,
      ms,
      ok: true,
      inputTokens: interaction.usage?.total_input_tokens,
      outputTokens: interaction.usage?.total_output_tokens,
    });

    return {
      ok: true,
      data: { text, steps: recorded },
      model,
      ms,
      inputTokens: interaction.usage?.total_input_tokens,
      outputTokens: interaction.usage?.total_output_tokens,
    };
  } catch (err) {
    const ms = Date.now() - started;
    await recordUsage({
      userId: args.userId,
      tripId: args.tripId,
      model,
      purpose: args.purpose,
      ms,
      ok: false,
    });
    return {
      ok: false,
      error: err instanceof Error ? err.message : "gemini_error",
      model,
      ms,
    };
  }
}
