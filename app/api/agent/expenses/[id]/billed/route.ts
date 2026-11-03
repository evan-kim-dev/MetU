import { NextResponse } from "next/server";
import { z } from "zod";

import { getAgentAdmin } from "@/lib/agent/admin";
import { readBodyLimited } from "@/lib/agent/body-limit";
import { assertTripMember } from "@/lib/agent/membership";
import { apiError, apiInternalError } from "@/lib/api/respond";
import {
  effectiveRate,
  formatDiffPct,
  marketDiffPct,
} from "@/lib/ledger/fx-merge";
import { guardApi, rejectAnonymousWrite } from "@/lib/security/guard";

export const maxDuration = 60;

const IdSchema = z.string().uuid();
const BodySchema = z.object({
  billedKrw: z.number().int().positive().max(100_000_000),
});

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

  const limited = await readBodyLimited(request, 4_096);
  if (!limited.ok) return limited.response;
  let billedKrw: number;
  try {
    const raw = JSON.parse(limited.text) as unknown;
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid-body" }, { status: 400 });
    }
    billedKrw = parsed.data.billedKrw;
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  const { data: expense, error: loadErr } = await admin
    .from("trip_expenses")
    .select("id, trip_id, status, amount, currency, krw_base, krw_amount")
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

  if (String(expense.currency ?? "").toUpperCase() === "KRW") {
    return NextResponse.json({ error: "not-foreign" }, { status: 409 });
  }

  const { data, error } = await admin.rpc("agent_apply_billed_krw", {
    p_actor: guard.identity.userId,
    p_expense_id: expenseId,
    p_billed_krw: billedKrw,
    p_source: "manual",
    p_event_id: null,
    p_foreign: null,
  });

  if (error) {
    const msg = error.message ?? "billed-failed";
    if (/forbidden/i.test(msg)) {
      return apiError("forbidden", 403, { log: msg });
    }
    if (/already-billed|voided|not-foreign|bad-/i.test(msg)) {
      return apiError(msg, 409, { log: msg });
    }
    return apiInternalError(msg);
  }

  const marketKrw = Number(
    (data as { market_krw?: number } | null)?.market_krw ??
      expense.krw_base ??
      expense.krw_amount ??
      0
  );
  const amount = Number(expense.amount ?? 0);
  const rate = effectiveRate(billedKrw, amount);
  const diff = marketDiffPct(billedKrw, marketKrw);

  return NextResponse.json({
    ok: true,
    result: data,
    summary: {
      billedKrw,
      marketKrw,
      effectiveRate: rate,
      marketDiffPct: diff,
      marketDiffLabel: diff == null ? null : formatDiffPct(diff),
    },
  });
}
