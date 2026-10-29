import { NextResponse } from "next/server";
import { TABLES } from "@/lib/constants";
import { getDailyFxQuote } from "@/lib/ledger/fx-server";
import { guardApi } from "@/lib/security/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { todayIsoDate } from "@/lib/shared/dates";

export const dynamic = "force-dynamic";

/** GET ?tripId&currency&date&paymentMethod&payerMemberId */
export async function GET(request: Request) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  if (guard.identity.kind === "guest") {
    return NextResponse.json({ error: "login-required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const tripId = url.searchParams.get("tripId")?.trim() ?? "";
  const currency = (url.searchParams.get("currency") ?? "KRW").toUpperCase();
  const date = url.searchParams.get("date")?.trim() || todayIsoDate();
  const method =
    url.searchParams.get("paymentMethod") ??
    url.searchParams.get("method") ??
    "card";
  const payerMemberId = url.searchParams.get("payerMemberId") ?? "";

  if (!tripId) {
    return NextResponse.json({ error: "tripId-required" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data: tripMeta, error } = await supabase.rpc("get_ledger_trip", {
    p_trip_id: tripId,
  });
  if (error || !tripMeta) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (currency === "KRW") {
    return NextResponse.json({
      rate: 1,
      rateDate: date,
      source: "auto_daily",
      isFallback: false,
    });
  }

  if (method === "cash") {
    if (payerMemberId) {
      const { data: cash } = await supabase
        .from(TABLES.tripCashRates)
        .select("krw_per_unit")
        .eq("trip_id", tripId)
        .eq("member_id", payerMemberId)
        .eq("currency", currency)
        .maybeSingle();
      if (cash?.krw_per_unit) {
        return NextResponse.json({
          rate: Number(cash.krw_per_unit),
          rateDate: date,
          source: "cash_manual",
          isFallback: false,
        });
      }
    }
    return NextResponse.json(
      {
        rate: null,
        rateDate: null,
        source: "cash_manual",
        isFallback: true,
        warning: "현금 환율을 입력하세요",
      },
      { status: 200 }
    );
  }

  const quote = await getDailyFxQuote({ currency, date });
  return NextResponse.json(quote);
}
