import { NextResponse } from "next/server";
import { z } from "zod";

import { getAgentEventForUser } from "@/lib/agent/event-access";
import { getAgentAdmin } from "@/lib/agent/admin";
import { guardApi } from "@/lib/security/guard";

export const maxDuration = 60;

const IdSchema = z.string().uuid();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  if (guard.identity.kind !== "user") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: eventId } = await context.params;
  if (!IdSchema.safeParse(eventId).success) {
    return NextResponse.json({ error: "bad-id" }, { status: 400 });
  }

  const owned = await getAgentEventForUser(eventId, guard.identity.userId);
  if (!owned.ok) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }

  const admin = getAgentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "server-misconfigured" }, { status: 503 });
  }

  const { error } = await admin
    .from("agent_events")
    .update({
      status: "ignored",
      processed_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
