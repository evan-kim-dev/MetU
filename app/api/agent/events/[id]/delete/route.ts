import { NextResponse } from "next/server";
import { z } from "zod";

import { getAgentAdmin } from "@/lib/agent/admin";
import { getAgentEventForUser } from "@/lib/agent/event-access";
import { apiInternalError } from "@/lib/api/respond";
import { guardApi, rejectAnonymousWrite } from "@/lib/security/guard";

export const maxDuration = 30;

const IdSchema = z.string().uuid();

/** 본인 agent_events 행 삭제. 가계부 지출은 지우지 않아요. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  if (guard.identity.kind !== "user") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const anon = rejectAnonymousWrite(guard.identity);
  if (anon) return anon;

  const { id: eventId } = await context.params;
  if (!IdSchema.safeParse(eventId).success) {
    return NextResponse.json({ error: "bad-id" }, { status: 400 });
  }

  const owned = await getAgentEventForUser(eventId, guard.identity.userId);
  if (!owned.ok) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }

  if (owned.event.status === "processing") {
    return NextResponse.json({ error: "busy" }, { status: 409 });
  }

  const admin = getAgentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "server-misconfigured" }, { status: 503 });
  }

  const { error } = await admin
    .from("agent_events")
    .delete()
    .eq("id", eventId)
    .eq("user_id", guard.identity.userId);

  if (error) {
    return apiInternalError(error.message);
  }

  return NextResponse.json({ ok: true });
}
