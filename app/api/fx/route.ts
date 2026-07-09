import { NextResponse } from "next/server";
import {
  FALLBACK_RATES,
  type FxCurrency,
} from "@/lib/fx/currencies";

async function fetchKrwRate(code: FxCurrency): Promise<number | null> {
  try {
    if (code === "USD") {
      const res = await fetch(
        "https://api.frankfurter.app/latest?from=USD&to=KRW",
        { cache: "no-store" }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { rates?: { KRW?: number } };
      return data.rates?.KRW ?? null;
    }

    const [fromUsd, codeToUsd] = await Promise.all([
      fetch("https://api.frankfurter.app/latest?from=USD&to=KRW", {
        cache: "no-store",
      }),
      fetch(`https://api.frankfurter.app/latest?from=${code}&to=USD`, {
        cache: "no-store",
      }),
    ]);

    if (!fromUsd.ok || !codeToUsd.ok) return null;
    const usdKrw = (await fromUsd.json()) as { rates?: { KRW?: number } };
    const codeUsd = (await codeToUsd.json()) as { rates?: { USD?: number } };
    const a = usdKrw.rates?.KRW;
    const b = codeUsd.rates?.USD;
    if (!a || !b) return null;
    return a * b;
  } catch {
    return null;
  }
}

async function fetchOpenErApi(code: FxCurrency): Promise<number | null> {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${code}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: string;
      rates?: { KRW?: number };
      time_last_update_utc?: string;
    };
    if (data.result !== "success") return null;
    return data.rates?.KRW ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get("code") ?? "USD").toUpperCase() as FxCurrency;

  if (!(code in FALLBACK_RATES)) {
    return NextResponse.json({ error: "unsupported-currency" }, { status: 400 });
  }

  const openEr = await fetchOpenErApi(code);
  const frankfurter = openEr == null ? await fetchKrwRate(code) : null;
  const live = openEr ?? frankfurter ?? FALLBACK_RATES[code];
  const source =
    openEr != null || frankfurter != null ? "live" : "fallback";

  return NextResponse.json(
    {
      code,
      krw: live,
      source,
      updatedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
