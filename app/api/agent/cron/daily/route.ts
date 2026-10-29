import { NextResponse } from "next/server";

import { runDailySettlementCron } from "@/lib/agent/handlers/settlement";
import { requireCronSecret } from "@/lib/security/guard";

export const maxDuration = 60;

/** Vercel Cron (daily) + optional pg_net backup. Auth: Bearer CRON_SECRET. */
export async function POST(request: Request) {
  const auth = requireCronSecret(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const settlement = await runDailySettlementCron();
    return NextResponse.json({
      ok: true,
      job: "daily",
      settlement,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[cron/daily]", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "daily-failed",
      },
      { status: 500 }
    );
  }
}
