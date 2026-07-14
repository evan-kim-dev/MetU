/**
 * Unified Next→FastAPI AI chat client.
 * Prefer this over raw backendFetch("/ai/chat") in BFF modules.
 */

import {
  BackendUnavailableError,
  backendFetch,
} from "@/lib/backend/client";
import type { AiChatResponse, AiMode } from "@/lib/ai/contracts";

export type AiChatResult = {
  content: string;
  source: string;
  validated: boolean;
  cached: boolean;
};

export class AiChatError extends Error {
  readonly code: "unavailable" | "http" | "empty" | "fallback";

  constructor(code: AiChatError["code"], message: string) {
    super(message);
    this.name = "AiChatError";
    this.code = code;
  }
}

export async function aiChat(params: {
  mode: AiMode;
  system: string;
  prompt: string;
}): Promise<AiChatResult> {
  let res: Response;
  try {
    res = await backendFetch("/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        system: params.system,
        prompt: params.prompt,
        mode: params.mode,
      }),
    });
  } catch (error) {
    if (error instanceof BackendUnavailableError) {
      throw new AiChatError("unavailable", error.message);
    }
    throw error;
  }

  if (!res.ok) {
    throw new AiChatError("http", `ai-chat-http-${res.status}`);
  }

  const data = (await res.json()) as AiChatResponse;
  const content = data.content?.trim();
  if (!content) {
    throw new AiChatError("empty", "ai-chat-empty");
  }
  if (data.source !== "ai") {
    throw new AiChatError("fallback", "ai-chat-fallback-source");
  }

  return {
    content,
    source: data.source,
    validated: Boolean(data.validated),
    cached: Boolean(data.cached),
  };
}

/** Soft wrapper — returns null instead of throwing (legacy silent-fallback style). */
export async function aiChatOrNull(params: {
  mode: AiMode;
  system: string;
  prompt: string;
}): Promise<AiChatResult | null> {
  try {
    return await aiChat(params);
  } catch (error) {
    if (
      error instanceof AiChatError ||
      error instanceof BackendUnavailableError
    ) {
      return null;
    }
    console.error("[aiChatOrNull]", error);
    return null;
  }
}
