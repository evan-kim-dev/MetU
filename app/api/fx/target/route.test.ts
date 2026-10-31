import { afterEach, describe, expect, it, vi } from "vitest";

const guardApi = vi.fn();
const resolveTripCurrency = vi.fn();

vi.mock("@/lib/security/guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
}));

vi.mock("@/lib/fx/resolve-trip-currency", () => ({
  resolveTripCurrency: (...args: unknown[]) => resolveTripCurrency(...args),
}));

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("GET /api/fx/target", () => {
  it("401 when guard rejects", async () => {
    const { NextResponse } = await import("next/server");
    guardApi.mockResolvedValue(
      NextResponse.json({ error: "unauthorized" }, { status: 401 })
    );

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/fx/target?country=%EC%9D%BC%EB%B3%B8")
    );
    expect(res.status).toBe(401);
    expect(resolveTripCurrency).not.toHaveBeenCalled();
  });

  it("200 with resolveTripCurrency payload", async () => {
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: "u1" },
      clientKey: "k",
    });
    resolveTripCurrency.mockResolvedValue({
      code: "JPY",
      symbol: "¥",
      label: "일본 엔",
      unit: 100,
      resolved: true,
    });

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/fx/target?country=%EC%9D%BC%EB%B3%B8")
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      code: string;
      unit: number;
      resolved: boolean;
    };
    expect(body.code).toBe("JPY");
    expect(body.unit).toBe(100);
    expect(body.resolved).toBe(true);
    expect(resolveTripCurrency).toHaveBeenCalledWith({
      country: "일본",
      destination: null,
    });
  });
});
