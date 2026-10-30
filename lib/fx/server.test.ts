import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getOrSet = vi.fn();
const maybeSingle = vi.fn();
const limit = vi.fn(() => ({ maybeSingle }));
const order = vi.fn(() => ({ limit }));
const eq2 = vi.fn(() => ({ order }));
const eq1 = vi.fn(() => ({ eq: eq2 }));
const select = vi.fn(() => ({ eq: eq1 }));
const upsert = vi.fn(async () => ({ error: null }));
const from = vi.fn(() => ({ select, upsert }));

vi.mock("@/lib/server/cache", () => ({
  getOrSet: (...args: unknown[]) => getOrSet(...args),
}));

vi.mock("@/lib/agent/admin", () => ({
  getAgentAdmin: () => ({ from }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.clearAllMocks();
});

beforeEach(() => {
  maybeSingle.mockResolvedValue({ data: null, error: null });
  getOrSet.mockImplementation(
    async (
      _key: string,
      _ttl: number,
      fn: () => Promise<unknown>
    ) => {
      const value = await fn();
      return { value, hit: "miss", fetchedAt: new Date().toISOString() };
    }
  );
});

describe("resolveLiveKrwRate / open.er USD pivot", () => {
  it("open.er 성공 시 JPY = rates.KRW / rates.JPY", async () => {
    const rates = { KRW: 1335, JPY: 150, USD: 1, AED: 3.67, VND: 25_000 };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("open.er-api.com")) {
          return Response.json({
            result: "success",
            rates,
            time_last_update_utc: "Fri, 30 Oct 2026 00:02:00 +0000",
          });
        }
        return new Response("no", { status: 500 });
      })
    );

    const { resolveLiveKrwRate, krwPerUnitFromUsdPivot } = await import(
      "./server"
    );
    const expected = krwPerUnitFromUsdPivot(rates, "JPY");
    const got = await resolveLiveKrwRate("JPY");
    expect(got).not.toBeNull();
    expect(got!.krw).toBeCloseTo(expected!, 6);
    expect(got!.source).toBe("live");
  });

  it("open.er 실패 + Frankfurter 성공", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("open.er-api.com")) {
          return new Response("fail", { status: 500 });
        }
        if (String(url).includes("frankfurter")) {
          return Response.json({
            amount: 1,
            base: "USD",
            date: "2026-10-30",
            rates: { KRW: 1335.27 },
          });
        }
        return new Response("no", { status: 500 });
      })
    );
    getOrSet.mockImplementation(async () => {
      throw new Error("open-er-down");
    });

    // When getOrSet throws without stale, resolveLiveKrwRate catches and tries Frankfurter.
    // Override: make getOpenErRatesCached fail by throwing from getOrSet and no stale.
    getOrSet.mockRejectedValue(new Error("cache-miss-and-fail"));

    const { resolveLiveKrwRate } = await import("./server");
    const got = await resolveLiveKrwRate("USD");
    expect(got).not.toBeNull();
    expect(got!.krw).toBeCloseTo(1335.27, 2);
    expect(got!.source).toBe("live");
    expect(got!.rateDate).toBe("2026-10-30");
  });

  it("둘 다 실패 + fx_rates last-known", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("fail", { status: 500 }))
    );
    getOrSet.mockRejectedValue(new Error("no-open-er"));
    maybeSingle.mockResolvedValue({
      data: { rate: 364.5, rate_date: "2026-10-28" },
      error: null,
    });

    const { resolveLiveKrwRate } = await import("./server");
    const got = await resolveLiveKrwRate("AED");
    expect(got).toEqual({
      krw: 364.5,
      source: "last-known",
      rateDate: "2026-10-28",
    });
  });

  it("전부 실패면 null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("fail", { status: 500 }))
    );
    getOrSet.mockRejectedValue(new Error("no-open-er"));
    maybeSingle.mockResolvedValue({ data: null, error: null });

    const { resolveLiveKrwRate } = await import("./server");
    const got = await resolveLiveKrwRate("USD");
    expect(got).toBeNull();
  });

  it("미지원 코드 거절 (normalize 실패)", async () => {
    const { resolveLiveKrwRate } = await import("./server");
    expect(await resolveLiveKrwRate("US")).toBeNull();
    expect(await resolveLiveKrwRate("USDT")).toBeNull();
    expect(await resolveLiveKrwRate("")).toBeNull();
  });
});
