import { after } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAgentAdmin } from "@/lib/agent/admin";
import { readJsonLimited } from "@/lib/agent/body-limit";
import { getAgentEventForUser } from "@/lib/agent/event-access";
import {
  assertTripMember,
  ensureOwnerMemberAdmin,
} from "@/lib/agent/membership";
import { processEvent } from "@/lib/agent/run";
import { pickTripForReceivedAt } from "@/lib/onboarding/agent-context";
import { parseReceivedAtMs } from "@/lib/onboarding/trip-window";
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

  const limited = await readJsonLimited(request, 4_096);
  if (!limited.ok) return limited.response;

  const parsed = BodySchema.safeParse(limited.json);
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

  // 본인 trip_members 행을 서버에서 보장 (실패해도 배정은 계속; processEvent 가 다시 시도).
  await ensureOwnerMemberAdmin(tripId, guard.identity.userId);

  // 사용자가 고른 여행이 알림 날짜와 맞지 않으면(near) 붙이되 자동 저장은 하지 않는다.
  // 날짜가 맞으면(exact) 기존처럼 처리한다. (더 보수적인 방향으로만 판단)
  const receivedMs = parseReceivedAtMs(
    owned.event.payload,
    owned.event.created_at
  );
  const pick = await pickTripForReceivedAt(
    guard.identity.userId,
    new Date(receivedMs)
  );
  const dateMatches = pick.exactTripIds?.includes(tripId) ?? false;

  const { error } = await admin
    .from("agent_events")
    .update({
      trip_id: tripId,
      status: "received",
      result: { match: { rule: dateMatches ? "exact" : "near" } },
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
