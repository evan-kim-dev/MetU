import { afterEach, describe, expect, it, vi } from "vitest";

const getOpenErRatesCached = vi.fn();
const resolveLiveKrwRate = vi.fn();

vi.mock("@/lib/fx/server", () => ({
  getOpenErRatesCached: (...args: unknown[]) => getOpenErRatesCached(...args),
  resolveLiveKrwRate: (...args: unknown[]) => resolveLiveKrwRate(...args),
}));

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("GET /api/fx", () => {
  it("400 unsupported-currency — 잘못된 코드", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/fx?code=US")
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("unsupported-currency");
  });

  it("400 unsupported-currency — open.er rates에 없음", async () => {
    getOpenErRatesCached.mockResolvedValue({
      payload: {
        rates: { KRW: 1335, JPY: 150, USD: 1 },
        rateDate: "2026-10-30",
      },
      hit: "fresh",
    });

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/fx?code=ZZZ")
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("unsupported-currency");
  });

  it("503 fx-unavailable", async () => {
    getOpenErRatesCached.mockResolvedValue({
      payload: {
        rates: { KRW: 1335, USD: 1, AED: 3.67 },
        rateDate: "2026-10-30",
      },
      hit: "fresh",
    });
    resolveLiveKrwRate.mockResolvedValue(null);

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/fx?code=AED")
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("fx-unavailable");
  });

  it("200 with source and rateDate", async () => {
    getOpenErRatesCached.mockResolvedValue({
      payload: {
        rates: { KRW: 1335, USD: 1, JPY: 150 },
        rateDate: "2026-10-30",
      },
      hit: "fresh",
    });
    resolveLiveKrwRate.mockResolvedValue({
      krw: 8.9,
      source: "live",
      rateDate: "2026-10-30",
    });

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/fx?code=JPY")
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      code: string;
      krw: number;
      source: string;
      rateDate: string;
    };
    expect(body.code).toBe("JPY");
    expect(body.krw).toBeCloseTo(8.9, 5);
    expect(body.source).toBe("live");
    expect(body.rateDate).toBe("2026-10-30");
  });
});
