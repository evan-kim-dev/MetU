import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeFxDisplayUnit, currencyDisplayMeta } from "@/lib/fx/currencies";

const getOrSet = vi.fn();
const resolveLiveKrwRate = vi.fn();

vi.mock("@/lib/server/cache", () => ({
  getOrSet: (...args: unknown[]) => getOrSet(...args),
}));

vi.mock("@/lib/fx/server", () => ({
  resolveLiveKrwRate: (...args: unknown[]) => resolveLiveKrwRate(...args),
}));

vi.mock("@/lib/agent/admin", () => ({
  getAgentAdmin: () => null,
}));

const SAMPLE_COUNTRIES = [
  {
    code: "JP",
    name: "일본",
    currency: "JPY",
    name_translations: { en: "Japan" },
  },
  {
    code: "VN",
    name: "베트남",
    currency: "VND",
    name_translations: { en: "Vietnam" },
  },
  {
    code: "TH",
    name: "태국",
    currency: "THB",
    name_translations: { en: "Thailand" },
  },
  {
    code: "PT",
    name: "포르투갈",
    currency: "EUR",
    name_translations: { en: "Portugal" },
  },
  {
    code: "US",
    name: "미국",
    currency: "USD",
    name_translations: { en: "United States" },
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.clearAllMocks();
});

beforeEach(() => {
  resolveLiveKrwRate.mockImplementation(async (code: string) => {
    const rates: Record<string, number> = {
      JPY: 8.47,
      VND: 0.05,
      THB: 41,
      USD: 1380,
      EUR: 1500,
    };
    const krw = rates[code];
    if (krw == null) return null;
    return { krw, source: "live", rateDate: "2026-10-30" };
  });

  getOrSet.mockImplementation(
    async (
      key: string,
      _ttl: number,
      fn: () => Promise<unknown>
    ) => {
      if (key === "fx:countries:ko") {
        return {
          value: SAMPLE_COUNTRIES,
          hit: "fresh",
          fetchedAt: new Date().toISOString(),
        };
      }
      const value = await fn();
      return { value, hit: "miss", fetchedAt: new Date().toISOString() };
    }
  );
});

describe("computeFxDisplayUnit", () => {
  it("JPY≈8.47 → 100, VND≈0.05 → 10000, THB≈41 → 10, USD → 1", () => {
    expect(computeFxDisplayUnit(8.47)).toBe(100);
    expect(computeFxDisplayUnit(0.05)).toBe(10_000);
    expect(computeFxDisplayUnit(41)).toBe(10);
    expect(computeFxDisplayUnit(1380)).toBe(1);
  });
});

describe("currencyDisplayMeta", () => {
  it("Intl 로 심볼·라벨을 만든다", () => {
    const jpy = currencyDisplayMeta("JPY");
    expect(jpy.symbol.length).toBeGreaterThan(0);
    expect(jpy.label.length).toBeGreaterThan(0);
  });
});

describe("resolveTripCurrency", () => {
  it("일본 → JPY unit 100", async () => {
    const { resolveTripCurrency } = await import(
      "@/lib/fx/resolve-trip-currency"
    );
    const r = await resolveTripCurrency({ country: "일본" });
    expect(r.code).toBe("JPY");
    expect(r.resolved).toBe(true);
    expect(r.unit).toBe(100);
  });

  it("베트남/다낭 → VND", async () => {
    const { resolveTripCurrency } = await import(
      "@/lib/fx/resolve-trip-currency"
    );
    const r = await resolveTripCurrency({ country: "베트남/다낭" });
    expect(r.code).toBe("VND");
    expect(r.resolved).toBe(true);
    expect(r.unit).toBe(10_000);
  });

  it("country 비어 있고 destination Danang → geocoding → VND", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("geocoding-api.open-meteo.com")) {
          return Response.json({
            results: [{ country_code: "VN", name: "다낭" }],
          });
        }
        throw new Error(`unexpected-fetch:${url}`);
      })
    );

    const { resolveTripCurrency } = await import(
      "@/lib/fx/resolve-trip-currency"
    );
    const r = await resolveTripCurrency({
      country: "",
      destination: "Danang",
    });
    expect(r.code).toBe("VND");
    expect(r.resolved).toBe(true);
  });

  it("둘 다 실패 → resolved:false USD", async () => {
    getOrSet.mockImplementation(
      async (key: string, _ttl: number, _fn: () => Promise<unknown>) => {
        if (key === "fx:countries:ko") {
          return {
            value: SAMPLE_COUNTRIES,
            hit: "fresh",
            fetchedAt: new Date().toISOString(),
          };
        }
        // geocode miss
        throw new Error("geocode-empty");
      }
    );

    const { resolveTripCurrency } = await import(
      "@/lib/fx/resolve-trip-currency"
    );
    const r = await resolveTripCurrency({
      country: "행성X",
      destination: "NowhereVille",
    });
    expect(r.code).toBe("USD");
    expect(r.resolved).toBe(false);
  });

  it("countries.json 캐시 재사용 — fetch 없이 fresh hit", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    getOrSet.mockImplementation(async (key: string) => {
      if (key === "fx:countries:ko") {
        return {
          value: SAMPLE_COUNTRIES,
          hit: "fresh",
          fetchedAt: new Date().toISOString(),
        };
      }
      throw new Error("no-geocode");
    });

    const { resolveTripCurrency } = await import(
      "@/lib/fx/resolve-trip-currency"
    );
    await resolveTripCurrency({ country: "일본" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
