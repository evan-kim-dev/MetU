import { after, NextResponse } from "next/server";
import { z } from "zod";

import { getAgentEventForUser } from "@/lib/agent/event-access";
import { getAgentAdmin } from "@/lib/agent/admin";
import { processEvent } from "@/lib/agent/run";
import { apiInternalError } from "@/lib/api/respond";
import { guardApi } from "@/lib/security/guard";

export const maxDuration = 60;

const IdSchema = z.string().uuid();

const RETRYABLE = new Set(["failed", "needs_review", "ignored"]);

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

  if (!RETRYABLE.has(owned.event.status)) {
    return NextResponse.json({ error: "bad-status" }, { status: 409 });
  }

  const admin = getAgentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "server-misconfigured" }, { status: 503 });
  }

  const { error } = await admin
    .from("agent_events")
    .update({
      status: "received",
      error: null,
      locked_at: null,
      processed_at: null,
    })
    .eq("id", eventId);

  if (error) {
    return apiInternalError(error.message);
  }

  after(() => processEvent(eventId));

  return NextResponse.json({ ok: true, queued: true });
}
