import { NextResponse } from "next/server";
import { z } from "zod";

import { getAgentAdmin } from "@/lib/agent/admin";
import { readBodyLimited } from "@/lib/agent/body-limit";
import { assertTripMember } from "@/lib/agent/membership";
import { apiError, apiInternalError } from "@/lib/api/respond";
import { guardApi, rejectAnonymousWrite } from "@/lib/security/guard";

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
  const anon = rejectAnonymousWrite(guard.identity);
  if (anon) return anon;

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
    .select("id, trip_id, status")
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

  let reason = "manual_unmerge";
  const limited = await readBodyLimited(request, 4_096);
  if (!limited.ok) return limited.response;
  if (limited.text.trim()) {
    try {
      const body = JSON.parse(limited.text) as { reason?: string };
      if (typeof body.reason === "string" && body.reason.trim()) {
        reason = body.reason.trim().slice(0, 200);
      }
    } catch {
      return NextResponse.json({ error: "invalid-json" }, { status: 400 });
    }
  }

  const { data, error } = await admin.rpc("agent_unmerge_billed_krw", {
    p_actor: guard.identity.userId,
    p_expense_id: expenseId,
    p_reason: reason,
  });

  if (error) {
    const msg = error.message ?? "unmerge-failed";
    if (/forbidden/i.test(msg)) {
      return apiError("forbidden", 403, { log: msg });
    }
    if (/voided|not-found|no-snapshot/i.test(msg)) {
      return apiError(msg, 409, { log: msg });
    }
    return apiInternalError(msg);
  }

  return NextResponse.json({ ok: true, result: data });
}
