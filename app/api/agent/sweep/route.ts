import { after } from "next/server";
import { NextResponse } from "next/server";

import { getAgentAdmin } from "@/lib/agent/admin";
import { processEvent } from "@/lib/agent/run";
import { requireCronSecret } from "@/lib/security/guard";

export const maxDuration = 60;

async function runSweep(): Promise<NextResponse> {
  const admin = getAgentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "server-misconfigured" }, { status: 503 });
  }

  const { data, error } = await admin.rpc("agent_sweep_candidates", {
    p_limit: 10,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (Array.isArray(data) ? data : [])
    .map((row) => (typeof row === "string" ? row : null))
    .filter((id): id is string => Boolean(id));

  after(async () => {
    for (const id of ids) {
      await processEvent(id);
    }
  });

  return NextResponse.json({ accepted: ids.length, ids }, { status: 202 });
}

/** Manual / after-ingest backlog drain. Prefer daily cron on Hobby. */
export async function GET(request: Request) {
  const auth = requireCronSecret(request);
  if (auth instanceof NextResponse) return auth;
  return runSweep();
}

export async function POST(request: Request) {
  const auth = requireCronSecret(request);
  if (auth instanceof NextResponse) return auth;
  return runSweep();
}
