import "server-only";

import { TABLES } from "@/lib/constants";
import {
  fetchFrankfurterKrwRate,
  resolveLiveKrwRate,
} from "@/lib/fx/server";
import { normalizeCurrencyCode } from "@/lib/fx/currencies";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { todayIsoDate } from "@/lib/shared/dates";
import type { FxQuote, FxSource } from "@/lib/ledger/fx";

const QUOTE = "KRW";
const PROVIDER = "frankfurter";
const TODAY_CACHE_TTL_HOURS = 6;

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
  rate: number,
  provider: string = PROVIDER
): Promise<void> {
  const admin = getServiceSupabase();
  if (!admin) return;
  await admin.from(TABLES.fxRates).upsert(
    {
      rate_date: rateDate,
      base,
      quote: QUOTE,
      rate,
      provider,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "rate_date,base,quote" }
  );
}

/** 해당일 이전 가장 가까운 fx_rates (날짜 제한 없음). */
async function readNearestPriorCache(
  base: string,
  onOrBefore: string
): Promise<{ rate: number; rateDate: string } | null> {
  const admin = getServiceSupabase();
  if (!admin) return null;
  const { data, error } = await admin
    .from(TABLES.fxRates)
    .select("rate, rate_date")
    .eq("base", base)
    .eq("quote", QUOTE)
    .lte("rate_date", onOrBefore)
    .order("rate_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const rate = Number(data.rate);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return { rate, rateDate: data.rate_date as string };
}

/**
 * Daily FX (card/transfer). Frankfurter(~30통화) → fx_rates 최근값 → open.er 라이브.
 * 전부 실패 시 null. 상수 rate 1 폴백 금지 (KRW 항등만 예외).
 */
export async function getDailyFxQuote(p: {
  currency: string;
  date: string;
}): Promise<FxQuote | null> {
  const base = normalizeCurrencyCode(p.currency);
  if (!base) return null;
  const requestedDate = p.date.trim();
  const today = todayIsoDate();

  if (base === QUOTE) {
    return {
      rate: 1,
      rateDate: requestedDate || today,
      source: "auto_daily",
      isFallback: false,
    };
  }

  const isFuture = requestedDate > today;
  const lookupDate = isFuture || !requestedDate ? "latest" : requestedDate;

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

  // Frankfurter: ~30개 통화만. AED/VND 등은 실패 → 다음 단계.
  const live = await fetchFrankfurterKrwRate(base, lookupDate);
  if (live) {
    void writeCachedRate(base, live.rateDate, live.rate);
    return {
      rate: live.rate,
      rateDate: live.rateDate,
      source: "auto_daily",
      isFallback: isFuture || live.rateDate !== requestedDate,
    };
  }

  if (!isFuture && requestedDate) {
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

  const resolved = await resolveLiveKrwRate(base);
  if (resolved && resolved.krw > 0) {
    return {
      rate: resolved.krw,
      rateDate: resolved.rateDate,
      source: "auto_daily",
      isFallback:
        resolved.source === "last-known" ||
        resolved.rateDate !== (requestedDate || today),
    };
  }

  return null;
}

export type CashFxQuote = FxQuote & { source: FxSource };
