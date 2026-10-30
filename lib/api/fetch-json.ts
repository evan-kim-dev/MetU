import {
  toUserFacingError,
  type ErrorSource,
  type UserFacingError,
} from "@/lib/errors/user-message";

export type ApiFetchResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: UserFacingError; status: number };

const DEFAULT_TIMEOUT_MS = 15_000;

export async function apiFetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts?: { source?: ErrorSource; timeoutMs?: number }
): Promise<ApiFetchResult<T>> {
  const source: ErrorSource = opts?.source ?? "api";
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      ok: false,
      status: 0,
      error: toUserFacingError({ source: "network" }),
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (init?.signal) {
    if (init.signal.aborted) controller.abort();
    else {
      init.signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }

  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    clearTimeout(timer);

    let body: unknown = undefined;
    const text = await res.text();
    if (text.trim()) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = undefined;
      }
    }

    if (!res.ok) {
      if (res.status === 401 && source === "api" && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("metu:session-expired"));
      }
      return {
        ok: false,
        status: res.status,
        error: toUserFacingError({
          source,
          status: res.status,
          body,
          retryAfterHeader: res.headers.get("Retry-After"),
        }),
      };
    }

    return { ok: true, data: (body as T) ?? ({} as T), status: res.status };
  } catch (err) {
    clearTimeout(timer);
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 0,
      error: toUserFacingError({
        source: "network",
        message,
      }),
    };
  }
}
