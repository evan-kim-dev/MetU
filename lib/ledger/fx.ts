import {
  FALLBACK_RATES,
  type FxCurrency,
} from "@/lib/fx/currencies";

export type FxSource = "auto_daily" | "cash_manual";

export interface FxQuote {
  rate: number;
  rateDate: string | null;
  source: FxSource;
  isFallback: boolean;
}

/**
 * L-5 에서 `/api/ledger/fx` 구현. 여기서는 얇은 클라이언트 + 타입만.
 * 실패 시 null (호출측에서 폴백).
 */
export async function getFxQuote(p: {
  tripId: string;
  currency: string;
  date: string;
  paymentMethod: "card" | "cash" | "transfer";
  payerMemberId: string;
}): Promise<FxQuote | null> {
  const code = p.currency.trim().toUpperCase();
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
    const data = (await res.json()) as Partial<FxQuote>;
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
  source: "live" | "fallback";
};

function normalizeCurrency(code: string): FxCurrency | "KRW" | null {
  const upper = code.trim().toUpperCase();
  if (upper === "KRW") return "KRW";
  if (upper in FALLBACK_RATES) return upper as FxCurrency;
  return null;
}

/** 브라우저: `/api/fx` BFF. KRW는 1. (기존 Step 5 호환) */
export async function getFxRateToKrw(currency: string): Promise<FxRateResult> {
  const code = normalizeCurrency(currency);
  if (code === "KRW") return { krw: 1, source: "live" };
  if (!code) {
    return { krw: FALLBACK_RATES.USD, source: "fallback" };
  }

  try {
    const res = await fetch(`/api/fx?code=${encodeURIComponent(code)}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("fx-http");
    const data = (await res.json()) as {
      krw?: number;
      source?: string;
    };
    const krw = Number(data.krw);
    if (!Number.isFinite(krw) || krw <= 0) throw new Error("fx-invalid");
    return {
      krw,
      source: data.source === "live" ? "live" : "fallback",
    };
  } catch {
    return { krw: FALLBACK_RATES[code], source: "fallback" };
  }
}
