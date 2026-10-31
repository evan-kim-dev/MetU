import { describe, expect, it } from "vitest";
import { formatFxLine, FX_UNKNOWN_LABEL } from "@/lib/ledger/fx-display";

function row(p: Partial<Parameters<typeof formatFxLine>[0]>) {
  return {
    amount: 45000,
    currency: "JPY",
    fxRateToKrw: 9.12,
    fxRateDate: "2026-11-03",
    fxSource: "auto_daily" as const,
    fxIsFallback: false,
    krwAmount: 410400,
    ...p,
  };
}

describe("formatFxLine", () => {
  it("JPY: 0 소수 자리, 환율, 기준일", () => {
    const l = formatFxLine(row({}));
    expect(l.isForeign).toBe(true);
    expect(l.original).toBe("45,000 JPY");
    expect(l.rate).toBe("1 JPY = 9.12원");
    expect(l.rateDate).toBe("11/03 기준");
    expect(l.sourceLabel).toBe("일별 환율 자동 조회");
    expect(l.krw).toBe("₩410,400");
    expect(l.isFallback).toBe(false);
    expect(l.summary).toBe("45,000 JPY · 1 JPY = 9.12원 · 11/03 기준");
    expect(l.ariaLabel).toContain("환율 1 JPY = 9.12원");
    expect(l.ariaLabel).toContain("11월 3일 기준");
  });

  it("USD: 2 소수 자리", () => {
    const l = formatFxLine(
      row({ amount: 12.5, currency: "usd", fxRateToKrw: 1380, krwAmount: 17250 })
    );
    expect(l.original).toBe("12.50 USD");
    expect(l.rate).toBe("1 USD = 1,380원");
  });

  it("VND: 0 소수 자리, 1 미만 환율은 자릿수 확장", () => {
    const l = formatFxLine(
      row({
        amount: 500000,
        currency: "VND",
        fxRateToKrw: 0.0552,
        krwAmount: 27600,
      })
    );
    expect(l.original).toBe("500,000 VND");
    expect(l.rate).toBe("1 VND = 0.0552원");
  });

  it("KRW: 환율 줄 없음", () => {
    const l = formatFxLine(
      row({ amount: 9000, currency: "KRW", fxRateToKrw: 1, krwAmount: 9000 })
    );
    expect(l.isForeign).toBe(false);
    expect(l.rate).toBeNull();
    expect(l.rateDate).toBeNull();
    expect(l.isFallback).toBe(false);
  });

  it("fallback: 마지막 확인 환율", () => {
    const l = formatFxLine(row({ fxIsFallback: true }));
    expect(l.isFallback).toBe(true);
    expect(l.sourceLabel).toBe("마지막 확인 환율");
    expect(l.ariaLabel).toContain("정산 전에 확인");
  });

  it("현금 수동 환율 출처", () => {
    expect(formatFxLine(row({ fxSource: "cash_manual" })).sourceLabel).toBe(
      "직접 입력한 현금 환율"
    );
  });

  it.each([0, Number.NaN, -1])("환율 %s → 환율 미확인", (rate) => {
    const l = formatFxLine(row({ fxRateToKrw: rate }));
    expect(l.rate).toBe(FX_UNKNOWN_LABEL);
    expect(l.rateUnknown).toBe(true);
    expect(l.rateDate).toBeNull();
    expect(l.summary).toBe(`45,000 JPY · ${FX_UNKNOWN_LABEL}`);
  });

  it("기준일이 없거나 형식이 다르면 날짜 생략", () => {
    expect(formatFxLine(row({ fxRateDate: null })).rateDate).toBeNull();
    expect(formatFxLine(row({ fxRateDate: "bad" })).rateDate).toBeNull();
  });

  it("소수 금액은 통화 최소 단위로 표기", () => {
    expect(
      formatFxLine(row({ amount: 1234.567, currency: "USD" })).original
    ).toBe("1,234.57 USD");
    expect(formatFxLine(row({ amount: 100.4, currency: "JPY" })).original).toBe(
      "100 JPY"
    );
  });
});
