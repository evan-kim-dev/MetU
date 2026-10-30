import { after } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAgentAdmin } from "@/lib/agent/admin";
import { getAgentEventForUser } from "@/lib/agent/event-access";
import { assertTripMember } from "@/lib/agent/membership";
import { processEvent } from "@/lib/agent/run";
import { guardApi } from "@/lib/security/guard";

export const maxDuration = 60;

const IdSchema = z.string().uuid();
const BodySchema = z.object({
  tripId: z.string().uuid().nullable(),
});

/** Manually assign (or unassign) an owned event to a trip. */
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

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation-failed" }, { status: 400 });
  }

  const admin = getAgentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "server-misconfigured" }, { status: 503 });
  }

  const { tripId } = parsed.data;

  if (tripId === null) {
    const { error } = await admin
      .from("agent_events")
      .update({
        trip_id: null,
        status: "unassigned",
        result: { reason: "unassigned" },
        processed_at: null,
        locked_at: null,
        error: null,
      })
      .eq("id", eventId)
      .eq("user_id", guard.identity.userId);

    if (error) {
      return NextResponse.json({ error: "update-failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, tripId: null, status: "unassigned" });
  }

  const member = await assertTripMember(guard.identity.userId, tripId);
  if (!member) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error } = await admin
    .from("agent_events")
    .update({
      trip_id: tripId,
      status: "received",
      result: null,
      processed_at: null,
      locked_at: null,
      error: null,
    })
    .eq("id", eventId)
    .eq("user_id", guard.identity.userId);

  if (error) {
    return NextResponse.json({ error: "update-failed" }, { status: 500 });
  }

  after(() => processEvent(eventId));

  return NextResponse.json({ ok: true, tripId, status: "received" });
}
