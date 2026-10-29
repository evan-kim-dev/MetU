import "server-only";

import { TABLES } from "@/lib/constants";
import {
  FALLBACK_RATES,
  type FxCurrency,
} from "@/lib/fx/currencies";
import { resolveLiveKrwRate } from "@/lib/fx/server";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { addDays, todayIsoDate } from "@/lib/shared/dates";
import type { FxQuote, FxSource } from "@/lib/ledger/fx";

const QUOTE = "KRW";
const PROVIDER = "frankfurter";
const TODAY_CACHE_TTL_HOURS = 6;
const NEAREST_PRIOR_MAX_DAYS = 7;

function fxProviderBase(): string {
  return (
    process.env.FX_PROVIDER_BASE_URL?.replace(/\/$/, "") ??
    "https://api.frankfurter.dev"
  );
}

function cacheTtlHours(rateDate: string, today: string): number {
  if (rateDate === today) return TODAY_CACHE_TTL_HOURS;
  const raw = process.env.FX_CACHE_TTL_HOURS;
  const n = raw ? Number(raw) : 720;
  return Number.isFinite(n) && n > 0 ? n : 720;
}

function isCacheFresh(
  fetchedAt: string,
  rateDate: string,
  today: string
): boolean {
  const ttlMs = cacheTtlHours(rateDate, today) * 3600 * 1000;
  return Date.now() - new Date(fetchedAt).getTime() < ttlMs;
}

type FrankfurterResponse = {
  amount?: number;
  base?: string;
  date?: string;
  rates?: Record<string, number>;
};

async function fetchFrankfurterRate(
  base: string,
  dateOrLatest: string
): Promise<{ rate: number; rateDate: string } | null> {
  const segment =
    dateOrLatest === "latest" ? "latest" : encodeURIComponent(dateOrLatest);
  const url = `${fxProviderBase()}/v1/${segment}?from=${encodeURIComponent(base)}&to=${QUOTE}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as FrankfurterResponse;
    const rate = data.rates?.[QUOTE];
    const rateDate = data.date;
    if (!(typeof rate === "number") || rate <= 0 || !rateDate) return null;
    return { rate, rateDate };
  } catch {
    return null;
  }
}

async function readCachedRate(
  base: string,
  rateDate: string
): Promise<{ rate: number; fetchedAt: string } | null> {
  const admin = getServiceSupabase();
  if (!admin) return null;
  const { data, error } = await admin
    .from(TABLES.fxRates)
    .select("rate, fetched_at")
    .eq("rate_date", rateDate)
    .eq("base", base)
    .eq("quote", QUOTE)
    .maybeSingle();
  if (error || !data) return null;
  const rate = Number(data.rate);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return {
    rate,
    fetchedAt: data.fetched_at as string,
  };
}

async function writeCachedRate(
  base: string,
  rateDate: string,
  rate: number
): Promise<void> {
  const admin = getServiceSupabase();
  if (!admin) return;
  await admin.from(TABLES.fxRates).upsert(
    {
      rate_date: rateDate,
      base,
      quote: QUOTE,
      rate,
      provider: PROVIDER,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "rate_date,base,quote" }
  );
}

async function readNearestPriorCache(
  base: string,
  onOrBefore: string
): Promise<{ rate: number; rateDate: string } | null> {
  const admin = getServiceSupabase();
  if (!admin) return null;
  const minDate = addDays(onOrBefore, -NEAREST_PRIOR_MAX_DAYS);
  const { data, error } = await admin
    .from(TABLES.fxRates)
    .select("rate, rate_date")
    .eq("base", base)
    .eq("quote", QUOTE)
    .lte("rate_date", onOrBefore)
    .gte("rate_date", minDate)
    .order("rate_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const rate = Number(data.rate);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return { rate, rateDate: data.rate_date as string };
}

function fallbackFromStatic(base: string): FxQuote | null {
  const code = base as FxCurrency;
  if (!(code in FALLBACK_RATES)) return null;
  const today = todayIsoDate();
  return {
    rate: FALLBACK_RATES[code],
    rateDate: today,
    source: "auto_daily",
    isFallback: true,
  };
}

async function fallbackLiveOrStatic(base: string): Promise<FxQuote | null> {
  const code = base as FxCurrency;
  if (code in FALLBACK_RATES) {
    const { krw, source } = await resolveLiveKrwRate(code);
    const today = todayIsoDate();
    return {
      rate: krw,
      rateDate: today,
      source: "auto_daily",
      isFallback: source === "fallback",
    };
  }
  return fallbackFromStatic(base);
}

/**
 * Daily FX (card/transfer). Uses Supabase fx_rates cache + Frankfurter provider.
 */
export async function getDailyFxQuote(p: {
  currency: string;
  date: string;
}): Promise<FxQuote> {
  const base = p.currency.trim().toUpperCase();
  const requestedDate = p.date.trim();
  const today = todayIsoDate();

  if (base === QUOTE) {
    return {
      rate: 1,
      rateDate: requestedDate,
      source: "auto_daily",
      isFallback: false,
    };
  }

  const isFuture = requestedDate > today;
  const lookupDate = isFuture ? "latest" : requestedDate;

  if (lookupDate !== "latest") {
    const cached = await readCachedRate(base, lookupDate);
    if (cached && isCacheFresh(cached.fetchedAt, lookupDate, today)) {
      return {
        rate: cached.rate,
        rateDate: lookupDate,
        source: "auto_daily",
        isFallback: false,
      };
    }
  }

  const live = await fetchFrankfurterRate(base, lookupDate);
  if (live) {
    void writeCachedRate(base, live.rateDate, live.rate);
    return {
      rate: live.rate,
      rateDate: live.rateDate,
      source: "auto_daily",
      isFallback: isFuture || live.rateDate !== requestedDate,
    };
  }

  if (!isFuture) {
    const nearest = await readNearestPriorCache(base, requestedDate);
    if (nearest) {
      return {
        rate: nearest.rate,
        rateDate: nearest.rateDate,
        source: "auto_daily",
        isFallback: nearest.rateDate !== requestedDate,
      };
    }
  }

  const fb = await fallbackLiveOrStatic(base);
  if (fb) return fb;

  return {
    rate: 1,
    rateDate: requestedDate,
    source: "auto_daily",
    isFallback: true,
  };
}

export type CashFxQuote = FxQuote & { source: FxSource };
