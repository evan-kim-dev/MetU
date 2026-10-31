import { NextResponse } from "next/server";
import { normalizeCurrencyCode } from "@/lib/fx/currencies";
import { resolveLiveKrwRate } from "@/lib/fx/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("code") ?? "USD").toUpperCase();
  const code = normalizeCurrencyCode(raw);

  if (!code) {
    return NextResponse.json(
      { error: "unsupported-currency" },
      { status: 400 }
    );
  }

  // 형식만 검증하고, open.er 미포함 통화는 Frankfurter / fx_rates last-known까지
  // resolveLiveKrwRate 폴백에 맡긴다 (선차단 400 금지).
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
