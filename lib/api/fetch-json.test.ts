import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetchJson } from "@/lib/api/fetch-json";

describe("apiFetchJson", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns network error on non-JSON timeout/abort", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Failed to fetch");
      })
    );
    const res = await apiFetchJson("/api/x");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("network");
  });

  it("handles non-JSON body on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => "not-json",
        headers: new Headers(),
      }))
    );
    const res = await apiFetchJson<{ ok?: boolean }>("/api/x");
    expect(res.ok).toBe(true);
  });

  it("dispatches session-expired on 401 api", async () => {
    const dispatch = vi.fn();
    vi.stubGlobal("window", {
      dispatchEvent: dispatch,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: "unauthorized" }),
        headers: new Headers(),
      }))
    );
    const res = await apiFetchJson("/api/x", undefined, { source: "api" });
    expect(res.ok).toBe(false);
    expect(dispatch).toHaveBeenCalled();
  });
});
