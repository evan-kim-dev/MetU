import { normalizeCurrencyCode } from "@/lib/fx/currencies";

export type FxSource = "auto_daily" | "cash_manual";

export interface FxQuote {
  rate: number;
  rateDate: string | null;
  source: FxSource;
  isFallback: boolean;
}

/**
 * L-5 에서 `/api/ledger/fx` 구현. 여기서는 얇은 클라이언트 + 타입만.
 * 실패 시 null (호출측에서 수동 입력/안내).
 */
export async function getFxQuote(p: {
  tripId: string;
  currency: string;
  date: string;
  paymentMethod: "card" | "cash" | "transfer";
  payerMemberId: string;
}): Promise<FxQuote | null> {
  const code = normalizeCurrencyCode(p.currency);
  if (!code) return null;
  if (code === "KRW") {
    return {
      rate: 1,
      rateDate: p.date,
      source: "auto_daily",
      isFallback: false,
    };
  }

  try {
    const qs = new URLSearchParams({
      tripId: p.tripId,
      currency: code,
      date: p.date,
      paymentMethod: p.paymentMethod,
      payerMemberId: p.payerMemberId,
    });
    const res = await fetch(`/api/ledger/fx?${qs}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<FxQuote> & {
      rate?: number | null;
    };
    if (!(typeof data.rate === "number") || !(data.rate > 0)) return null;
    return {
      rate: data.rate,
      rateDate: data.rateDate ?? p.date,
      source: data.source === "cash_manual" ? "cash_manual" : "auto_daily",
      isFallback: Boolean(data.isFallback),
    };
  } catch {
    return null;
  }
}

export type FxRateResult = {
  krw: number;
  source: "live" | "cached" | "last-known";
  rateDate?: string;
};

/** 브라우저: `/api/fx` BFF. KRW는 1. 실패 시 null (상수 폴백 금지). */
export async function getFxRateToKrw(
  currency: string
): Promise<FxRateResult | null> {
  const code = normalizeCurrencyCode(currency);
  if (!code) return null;
  if (code === "KRW") return { krw: 1, source: "live" };

  try {
    const res = await fetch(`/api/fx?code=${encodeURIComponent(code)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      krw?: number;
      source?: string;
      rateDate?: string;
    };
    const krw = Number(data.krw);
    if (!Number.isFinite(krw) || krw <= 0) return null;
    const source =
      data.source === "cached"
        ? "cached"
        : data.source === "last-known"
          ? "last-known"
          : "live";
    return {
      krw,
      source,
      rateDate: data.rateDate,
    };
  } catch {
    return null;
  }
}
