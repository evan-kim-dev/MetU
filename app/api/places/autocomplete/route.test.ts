import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("GET /api/places/autocomplete", () => {
  it("upstream 500 → 200 local and 인천 includes 서울", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("fail", { status: 500 })
      )
    );

    const { GET } = await import("./route");
    const res = await GET(
      new Request(
        "http://localhost/api/places/autocomplete?q=%EC%9D%B8%EC%B2%9C&mode=cities&limit=10"
      )
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      source: string;
      items: Array<{ name: string; matchedCode?: string }>;
    };
    expect(body.source).toBe("local");
    expect(body.items.some((i) => i.name === "서울")).toBe(true);
  });

  it("upstream timeout → 200 local", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const err = new Error("Aborted");
        err.name = "TimeoutError";
        throw err;
      })
    );

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/places/autocomplete?q=icn&mode=cities")
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { source: string };
    expect(body.source).toBe("local");
  });

  it("rejects empty q", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/places/autocomplete?q=")
    );
    expect(res.status).toBe(400);
  });
});
