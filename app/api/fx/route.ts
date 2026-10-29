import { NextResponse } from "next/server";
import {
  FALLBACK_RATES,
  type FxCurrency,
} from "@/lib/fx/currencies";
import { resolveLiveKrwRate } from "@/lib/fx/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get("code") ?? "USD").toUpperCase() as FxCurrency;

  if (!(code in FALLBACK_RATES)) {
    return NextResponse.json({ error: "unsupported-currency" }, { status: 400 });
  }

  const { krw: live, source } = await resolveLiveKrwRate(code);

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
