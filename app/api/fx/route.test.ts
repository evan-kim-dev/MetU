import { afterEach, describe, expect, it, vi } from "vitest";

const resolveLiveKrwRate = vi.fn();

vi.mock("@/lib/fx/server", () => ({
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

  it("503 fx-unavailable — 모든 환율 소스 실패 (형식은 유효)", async () => {
    resolveLiveKrwRate.mockResolvedValue(null);

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/fx?code=ZZZ")
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("fx-unavailable");
  });

  it("503 fx-unavailable", async () => {
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
