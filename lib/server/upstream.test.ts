import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "@/lib/server/upstream";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchJson", () => {
  it("returns ok:false on timeout without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            const signal = init?.signal;
            if (!signal) return;
            if (signal.aborted) {
              reject(new DOMException("Aborted", "AbortError"));
              return;
            }
            signal.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true }
            );
          })
      )
    );
    const result = await fetchJson("https://example.com/x?api_key=secret", {
      timeoutMs: 30,
      retries: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("timeout");
  });

  it("returns ok:false on 5xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 503 }))
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await fetchJson("https://example.com/x?token=abc", {
      retries: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
    }
    const logged = warn.mock.calls.map((c) => String(c.join(" "))).join(" ");
    expect(logged).not.toContain("token=abc");
    expect(logged).toMatch(/\[redacted\]|failed/);
  });
});
