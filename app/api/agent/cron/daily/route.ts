import { after } from "next/server";
import { NextResponse } from "next/server";

import { getAgentAdmin } from "@/lib/agent/admin";
import { runDailySettlementCron } from "@/lib/agent/handlers/settlement";
import { processEvent } from "@/lib/agent/run";
import { requireCronSecret } from "@/lib/security/guard";

export const maxDuration = 60;

async function runDailyJob(): Promise<NextResponse> {
  try {
    const settlement = await runDailySettlementCron();

    // Hobby allows one cron/day — fold sweep into daily.
    let sweepAccepted = 0;
    const admin = getAgentAdmin();
    if (admin) {
      const { data, error } = await admin.rpc("agent_sweep_candidates", {
        p_limit: 10,
      });
      if (!error) {
        const ids = (Array.isArray(data) ? data : [])
          .map((row) => (typeof row === "string" ? row : null))
          .filter((id): id is string => Boolean(id));
        sweepAccepted = ids.length;
        if (ids.length > 0) {
          after(async () => {
            for (const id of ids) {
              await processEvent(id);
            }
          });
        }
      } else {
        console.error("[cron/daily] sweep", error.message);
      }
    }

    return NextResponse.json({
      ok: true,
      job: "daily",
      settlement,
      sweepAccepted,
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

/** Vercel Cron calls GET. Manual / pg_net may use POST. Auth: Bearer CRON_SECRET. */
export async function GET(request: Request) {
  const auth = requireCronSecret(request);
  if (auth instanceof NextResponse) return auth;
  return runDailyJob();
}

export async function POST(request: Request) {
  const auth = requireCronSecret(request);
  if (auth instanceof NextResponse) return auth;
  return runDailyJob();
}
