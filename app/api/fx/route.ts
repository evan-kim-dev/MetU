import { NextResponse } from "next/server";
import { normalizeCurrencyCode } from "@/lib/fx/currencies";
import { getOpenErRatesCached, resolveLiveKrwRate } from "@/lib/fx/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("code") ?? "USD").toUpperCase();
  const code = normalizeCurrencyCode(raw);

  if (!code || !/^[A-Z]{3}$/.test(code)) {
    return NextResponse.json(
      { error: "unsupported-currency" },
      { status: 400 }
    );
  }

  if (code !== "KRW") {
    try {
      const { payload } = await getOpenErRatesCached();
      // USD는 피벗 베이스라 rates에 없을 수 있음.
      if (code !== "USD" && !(code in payload.rates)) {
        return NextResponse.json(
          { error: "unsupported-currency" },
          { status: 400 }
        );
      }
    } catch {
      // open.er 실패 시 resolveLiveKrwRate 폴백(Frankfurter / last-known) 시도
    }
  }

  const resolved = await resolveLiveKrwRate(code);
  if (!resolved || !(resolved.krw > 0)) {
    return NextResponse.json({ error: "fx-unavailable" }, { status: 503 });
  }

  return NextResponse.json(
    {
      code,
      krw: resolved.krw,
      source: resolved.source,
      rateDate: resolved.rateDate,
      updatedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
