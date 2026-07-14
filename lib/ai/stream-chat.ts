/**
 * Consume FastAPI / Next SSE (`data: {json}\n\n`) from /ai/chat/stream
 * or a BFF that proxies it.
 */

export type AiStreamEvent =
  | { type: "meta"; cached?: boolean }
  | { type: "token"; t: string }
  | {
      type: "done";
      content: string;
      source?: string;
      cached?: boolean;
      validated?: boolean;
    }
  | { type: "error"; message: string };

export async function* readAiSseStream(
  res: Response
): AsyncGenerator<AiStreamEvent> {
  if (!res.body) {
    yield { type: "error", message: "empty-body" };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      for (const line of rawEvent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          yield JSON.parse(payload) as AiStreamEvent;
        } catch {
          // ignore malformed chunk
        }
      }
    }
  }
}

export async function collectStreamedContent(
  res: Response,
  onToken?: (token: string) => void
): Promise<{ content: string; cached: boolean } | null> {
  let content = "";
  let cached = false;
  let gotDone = false;

  for await (const ev of readAiSseStream(res)) {
    if (ev.type === "meta" && ev.cached) cached = true;
    if (ev.type === "token") {
      content += ev.t;
      onToken?.(ev.t);
    }
    if (ev.type === "done") {
      content = ev.content || content;
      cached = Boolean(ev.cached ?? cached);
      gotDone = true;
    }
    if (ev.type === "error") {
      return null;
    }
  }

  const trimmed = content.trim();
  if (!gotDone && !trimmed) return null;
  return { content: trimmed, cached };
}
