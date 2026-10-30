import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveLiveKrwRate = vi.fn();
const fetchFrankfurterKrwRate = vi.fn();

vi.mock("@/lib/fx/server", () => ({
  resolveLiveKrwRate: (...args: unknown[]) => resolveLiveKrwRate(...args),
  fetchFrankfurterKrwRate: (...args: unknown[]) =>
    fetchFrankfurterKrwRate(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getServiceSupabase: () => null,
}));

vi.mock("@/lib/shared/dates", () => ({
  todayIsoDate: () => "2026-10-31",
  addDays: (d: string, n: number) => {
    const date = new Date(`${d}T12:00:00`);
    date.setDate(date.getDate() + n);
    return date.toISOString().slice(0, 10);
  },
}));

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

beforeEach(() => {
  fetchFrankfurterKrwRate.mockResolvedValue(null);
  resolveLiveKrwRate.mockResolvedValue(null);
});

describe("getDailyFxQuote", () => {
  it("Frankfurter에 없는 통화(AED)는 rate 1이 아니라 open.er 값", async () => {
    fetchFrankfurterKrwRate.mockResolvedValue(null);
    resolveLiveKrwRate.mockResolvedValue({
      krw: 364.12,
      source: "live",
      rateDate: "2026-10-31",
    });

    const { getDailyFxQuote } = await import("./fx-server");
    const q = await getDailyFxQuote({ currency: "AED", date: "2026-10-31" });
    expect(q).not.toBeNull();
    expect(q!.rate).toBeCloseTo(364.12, 2);
    expect(q!.rate).not.toBe(1);
  });

  it("Frankfurter에 없는 통화(VND)는 open.er 값", async () => {
    fetchFrankfurterKrwRate.mockResolvedValue(null);
    resolveLiveKrwRate.mockResolvedValue({
      krw: 0.0534,
      source: "live",
      rateDate: "2026-10-31",
    });

    const { getDailyFxQuote } = await import("./fx-server");
    const q = await getDailyFxQuote({ currency: "VND", date: "2026-10-31" });
    expect(q).not.toBeNull();
    expect(q!.rate).toBeCloseTo(0.0534, 4);
    expect(q!.rate).not.toBe(1);
  });

  it("전부 실패 시 null (rate 1 금지)", async () => {
    fetchFrankfurterKrwRate.mockResolvedValue(null);
    resolveLiveKrwRate.mockResolvedValue(null);

    const { getDailyFxQuote } = await import("./fx-server");
    const q = await getDailyFxQuote({ currency: "AED", date: "2026-10-31" });
    expect(q).toBeNull();
  });

  it("KRW는 항등 1", async () => {
    const { getDailyFxQuote } = await import("./fx-server");
    const q = await getDailyFxQuote({ currency: "KRW", date: "2026-10-31" });
    expect(q).toEqual({
      rate: 1,
      rateDate: "2026-10-31",
      source: "auto_daily",
      isFallback: false,
    });
  });
});
