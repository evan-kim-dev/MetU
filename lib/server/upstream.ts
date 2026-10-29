import "server-only";

export class UpstreamError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.name = "UpstreamError";
    this.status = status;
    this.code = code;
  }
}

export type FetchJsonOk<T> = { ok: true; data: T; status: number };
export type FetchJsonFail = {
  ok: false;
  reason: string;
  status?: number;
  code?: string;
};
export type FetchJsonResult<T> = FetchJsonOk<T> | FetchJsonFail;

function maskUrl(raw: string): string {
  try {
    const url = new URL(raw);
    for (const key of ["api_key", "apikey", "token", "access_token", "key"]) {
      if (url.searchParams.has(key)) url.searchParams.set(key, "[redacted]");
    }
    return url.toString();
  } catch {
    return raw.replace(
      /([?&](?:api_?key|token|access_token)=)[^&]*/gi,
      "$1[redacted]"
    );
  }
}

export async function fetchJson<T = unknown>(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | undefined;
    timeoutMs?: number;
    retries?: number;
    signal?: AbortSignal;
  } = {}
): Promise<FetchJsonResult<T>> {
  const method = options.method ?? "GET";
  const timeoutMs = options.timeoutMs ?? 10_000;
  const retries = Math.max(0, options.retries ?? 1);
  let lastReason = "unknown";

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onAbort, { once: true });

    try {
      const res = await fetch(url, {
        method,
        headers: options.headers,
        body: options.body,
        signal: controller.signal,
        cache: "no-store",
      });

      if (!res.ok) {
        lastReason = `http_${res.status}`;
        if (res.status >= 500 && attempt < retries) continue;
        console.warn("[upstream] failed", maskUrl(url), lastReason);
        return {
          ok: false,
          reason: lastReason,
          status: res.status,
          code: "upstream_http",
        };
      }

      const data = (await res.json()) as T;
      return { ok: true, data, status: res.status };
    } catch (err) {
      const aborted =
        (err instanceof Error && err.name === "AbortError") ||
        options.signal?.aborted ||
        controller.signal.aborted;
      lastReason = aborted ? "timeout" : "network";
      if (attempt < retries && !options.signal?.aborted) continue;
      console.warn("[upstream] failed", maskUrl(url), lastReason);
      return { ok: false, reason: lastReason, code: lastReason };
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
    }
  }

  console.warn("[upstream] failed", maskUrl(url), lastReason);
  return { ok: false, reason: lastReason };
}
