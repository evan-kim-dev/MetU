import "server-only";

import { TABLES } from "@/lib/constants";
import { normalizeCurrencyCode } from "@/lib/fx/currencies";
import { getOrSet } from "@/lib/server/cache";
import { todayIsoDate } from "@/lib/shared/dates";
import { getAgentAdmin } from "@/lib/agent/admin";

const OPEN_ER_URL = "https://open.er-api.com/v6/latest/USD";
const OPEN_ER_CACHE_KEY = "fx:open-er:usd";
const OPEN_ER_TTL_SEC = 6 * 3600;
const FETCH_TIMEOUT_MS = 5_000;
const QUOTE = "KRW";
const OPEN_ER_PROVIDER = "open.er-api";

/** Frankfurter ~30개 통화만 지원 (과거일 조회용). VND 등은 없음. */
function frankfurterBase(): string {
  const raw =
    process.env.FX_PROVIDER_BASE_URL?.replace(/\/$/, "") ??
    "https://api.frankfurter.dev/v1";
  return raw.endsWith("/v1") ? raw : `${raw}/v1`;
}

export type OpenErRatesPayload = {
  rates: Record<string, number>;
  rateDate: string;
  timeLastUpdateUtc?: string;
};

export type LiveKrwRate = {
  krw: number;
  source: "live" | "cached" | "last-known";
  rateDate: string;
};

function isoDateFromUtcLabel(label: string | undefined): string {
  if (!label) return todayIsoDate();
  const d = new Date(label);
  if (Number.isNaN(d.getTime())) return todayIsoDate();
  return d.toISOString().slice(0, 10);
}

async function fetchWithTimeout(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * open.er-api USD 피벗 한 번 호출. KRW 기준(/latest/KRW)은 쓰지 않음(정밀도 손실).
 * 1 X = rates.KRW / rates[X] 원.
 */
export async function fetchOpenErApiRates(): Promise<OpenErRatesPayload> {
  const res = await fetchWithTimeout(OPEN_ER_URL);
  if (!res.ok) throw new Error(`open-er-http-${res.status}`);
  const data = (await res.json()) as {
    result?: string;
    rates?: Record<string, number>;
    time_last_update_utc?: string;
  };
  if (data.result !== "success" || !data.rates) {
    throw new Error("open-er-invalid");
  }
  const krw = data.rates.KRW;
  if (!(typeof krw === "number") || !(krw > 0)) {
    throw new Error("open-er-no-krw");
  }
  return {
    rates: data.rates,
    rateDate: isoDateFromUtcLabel(data.time_last_update_utc),
    timeLastUpdateUtc: data.time_last_update_utc,
  };
}

export function krwPerUnitFromUsdPivot(
  rates: Record<string, number>,
  code: string
): number | null {
  if (code === "KRW") return 1;
  const krw = rates.KRW;
  if (!(typeof krw === "number") || !(krw > 0)) return null;
  if (code === "USD") return krw;
  const unitsPerUsd = rates[code];
  if (!(typeof unitsPerUsd === "number") || !(unitsPerUsd > 0)) return null;
  return krw / unitsPerUsd;
}

/** Best-effort: 오늘 날짜로 fx_rates upsert. 실패해도 무시. */
export async function persistOpenErRatesToFxTable(
  payload: OpenErRatesPayload
): Promise<void> {
  try {
    const admin = getAgentAdmin();
    if (!admin) return;
    const rateDate = payload.rateDate || todayIsoDate();
    const fetchedAt = new Date().toISOString();
    const rows: Array<{
      rate_date: string;
      base: string;
      quote: string;
      rate: number;
      provider: string;
      fetched_at: string;
    }> = [];

    for (const code of Object.keys(payload.rates)) {
      if (!normalizeCurrencyCode(code) || code === "KRW") continue;
      const rate = krwPerUnitFromUsdPivot(payload.rates, code);
      if (rate == null || !(rate > 0) || !Number.isFinite(rate)) continue;
      rows.push({
        rate_date: rateDate,
        base: code,
        quote: QUOTE,
        rate,
        provider: OPEN_ER_PROVIDER,
        fetched_at: fetchedAt,
      });
    }

    const CHUNK = 80;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      await admin
        .from(TABLES.fxRates)
        .upsert(slice, { onConflict: "rate_date,base,quote" });
    }
  } catch (err) {
    console.error("[fx] persistOpenErRates", err);
  }
}

export async function getOpenErRatesCached(): Promise<{
  payload: OpenErRatesPayload;
  hit: "fresh" | "stale" | "miss";
}> {
  const result = await getOrSet(
    OPEN_ER_CACHE_KEY,
    OPEN_ER_TTL_SEC,
    async () => {
      const payload = await fetchOpenErApiRates();
      void persistOpenErRatesToFxTable(payload);
      return payload;
    },
    { staleIfError: true }
  );
  return { payload: result.value, hit: result.hit };
}

/**
 * Frankfurter 과거/최신 환율. ~30개 통화만 지원.
 * VERIFY: api.frankfurter.dev/v1 (구 api.frankfurter.app 은 301)
 */
export async function fetchFrankfurterKrwRate(
  code: string,
  dateOrLatest: string = "latest"
): Promise<{ rate: number; rateDate: string } | null> {
  const normalized = normalizeCurrencyCode(code);
  if (!normalized || normalized === "KRW") return null;
  const segment =
    dateOrLatest === "latest" ? "latest" : encodeURIComponent(dateOrLatest);
  const url = `${frankfurterBase()}/${segment}?from=${encodeURIComponent(normalized)}&to=${QUOTE}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      rates?: Record<string, number>;
      date?: string;
    };
    const rate = data.rates?.[QUOTE];
    const rateDate = data.date;
    if (!(typeof rate === "number") || rate <= 0 || !rateDate) return null;
    return { rate, rateDate };
  } catch {
    return null;
  }
}

async function readLastKnownFxRate(
  base: string
): Promise<{ rate: number; rateDate: string } | null> {
  const admin = getAgentAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from(TABLES.fxRates)
    .select("rate, rate_date")
    .eq("base", base)
    .eq("quote", QUOTE)
    .order("rate_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const rate = Number(data.rate);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return { rate, rateDate: data.rate_date as string };
}

/**
 * 라이브 KRW 환율.
 * 순서: open.er 캐시 → Frankfurter → fx_rates 최근 행(날짜 제한 없음) → null.
 * 상수 환율은 절대 반환하지 않음.
 */
export async function resolveLiveKrwRate(
  code: string
): Promise<LiveKrwRate | null> {
  const normalized = normalizeCurrencyCode(code);
  if (!normalized) return null;
  if (normalized === "KRW") {
    return { krw: 1, source: "live", rateDate: todayIsoDate() };
  }

  try {
    const { payload, hit } = await getOpenErRatesCached();
    const krw = krwPerUnitFromUsdPivot(payload.rates, normalized);
    if (krw != null && krw > 0) {
      return {
        krw,
        source: hit === "miss" ? "live" : "cached",
        rateDate: payload.rateDate,
      };
    }
  } catch (err) {
    console.error("[fx] open.er", err);
  }

  const frankfurter = await fetchFrankfurterKrwRate(normalized, "latest");
  if (frankfurter) {
    return {
      krw: frankfurter.rate,
      source: "live",
      rateDate: frankfurter.rateDate,
    };
  }

  const lastKnown = await readLastKnownFxRate(normalized);
  if (lastKnown) {
    return {
      krw: lastKnown.rate,
      source: "last-known",
      rateDate: lastKnown.rateDate,
    };
  }

  return null;
}

/** Cron/스냅샷용: open.er 호출 + fx_rates upsert (best-effort). */
export async function snapshotFxRates(): Promise<{ ok: boolean; count?: number }> {
  try {
    const payload = await fetchOpenErApiRates();
    await persistOpenErRatesToFxTable(payload);
    return { ok: true, count: Object.keys(payload.rates).length };
  } catch (err) {
    console.error("[fx] snapshotFxRates", err);
    return { ok: false };
  }
}
