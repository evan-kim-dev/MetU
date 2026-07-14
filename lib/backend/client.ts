import { getBackendUrl } from "@/lib/supabase/env";

export class BackendUnavailableError extends Error {
  constructor(message = "Backend unavailable") {
    super(message);
    this.name = "BackendUnavailableError";
  }
}

export class BackendTimeoutError extends BackendUnavailableError {
  constructor(message = "Backend request timed out") {
    super(message);
    this.name = "BackendTimeoutError";
  }
}

const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Server-side fetch to FastAPI.
 * @param timeoutMs Override (AI modes: pass 120_000–300_000). Default 60s.
 */
export async function backendFetch(
  path: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const base = getBackendUrl().replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchInit } = init ?? {};

  const timeoutSignal =
    typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(timeoutMs)
      : undefined;

  // Merge caller signal with timeout when both present
  let signal = fetchInit.signal ?? timeoutSignal;
  if (fetchInit.signal && timeoutSignal) {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    fetchInit.signal.addEventListener("abort", onAbort, { once: true });
    timeoutSignal.addEventListener("abort", onAbort, { once: true });
    signal = controller.signal;
  }

  try {
    return await fetch(url, {
      ...fetchInit,
      signal,
      headers: {
        "Content-Type": "application/json",
        ...(fetchInit.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (
      name === "TimeoutError" ||
      name === "AbortError" ||
      (error instanceof Error && /aborted|timeout/i.test(error.message))
    ) {
      throw new BackendTimeoutError(
        error instanceof Error ? error.message : "Backend timed out"
      );
    }
    throw new BackendUnavailableError(
      error instanceof Error ? error.message : "Backend fetch failed"
    );
  }
}
