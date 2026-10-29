import { after } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAgentAdmin } from "@/lib/agent/admin";
import { assertTripMember } from "@/lib/agent/membership";
import { processEvent } from "@/lib/agent/run";
import { bindOrphanAgentRowsToTrip } from "@/lib/onboarding/agent-context";
import { guardApi } from "@/lib/security/guard";

export const maxDuration = 60;

const BodySchema = z.object({
  tripId: z.string().uuid(),
});

/**
 * After the user creates a trip, attach previously unbound tokens/events
 * and re-queue parked "awaiting_trip" reviews.
 */
export async function POST(request: Request) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  if (guard.identity.kind !== "user") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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

  const userId = guard.identity.userId;
  const { tripId } = parsed.data;
  const member = await assertTripMember(userId, tripId);
  if (!member) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const bound = await bindOrphanAgentRowsToTrip(userId, tripId);

  const admin = getAgentAdmin();
  const requeueIds: string[] = [];
  if (admin) {
    const { data: parked } = await admin
      .from("agent_events")
      .select("id, result")
      .eq("user_id", userId)
      .eq("trip_id", tripId)
      .eq("status", "needs_review");

    const awaiting = (parked ?? []).filter((row) => {
      const result = row.result as { reason?: string } | null;
      return result?.reason === "awaiting_trip";
    });

    for (const row of awaiting) {
      if (typeof row.id !== "string") continue;
      const { error } = await admin
        .from("agent_events")
        .update({
          status: "received",
          result: null,
          processed_at: null,
          locked_at: null,
        })
        .eq("id", row.id);
      if (!error) requeueIds.push(row.id);
    }
  }

  if (requeueIds.length > 0) {
    after(() => {
      for (const id of requeueIds) {
        void processEvent(id);
      }
    });
  }

  return NextResponse.json({
    ok: true,
    tokensBound: bound.tokens,
    eventsBound: bound.events,
    requeued: requeueIds.length,
  });
}
