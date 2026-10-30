import { NextResponse } from "next/server";
import { z } from "zod";

import { getAgentAdmin } from "@/lib/agent/admin";
import { assertTripMember } from "@/lib/agent/membership";
import { apiError, apiInternalError } from "@/lib/api/respond";
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

  const { id: expenseId } = await context.params;
  if (!IdSchema.safeParse(expenseId).success) {
    return NextResponse.json({ error: "bad-id" }, { status: 400 });
  }

  const admin = getAgentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "server-misconfigured" }, { status: 503 });
  }

  const { data: expense, error: loadErr } = await admin
    .from("trip_expenses")
    .select("id, trip_id, status, created_by")
    .eq("id", expenseId)
    .maybeSingle();

  if (loadErr) {
    return apiInternalError(loadErr.message);
  }
  if (!expense) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const tripId = expense.trip_id as string;
  const allowed = await assertTripMember(guard.identity.userId, tripId);
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let reason = "inbox_undo";
  try {
    const body = (await request.json()) as { reason?: string };
    if (typeof body.reason === "string" && body.reason.trim()) {
      reason = body.reason.trim().slice(0, 200);
    }
  } catch {
    /* optional body */
  }

  const { data, error } = await admin.rpc("agent_void_expense", {
    p_actor: guard.identity.userId,
    p_expense_id: expenseId,
    p_reason: reason,
  });

  if (error) {
    const msg = error.message ?? "void-failed";
    if (/forbidden/i.test(msg)) {
      return apiError("forbidden", 403, { log: msg });
    }
    return apiInternalError(msg);
  }

  return NextResponse.json({ ok: true, result: data });
}
