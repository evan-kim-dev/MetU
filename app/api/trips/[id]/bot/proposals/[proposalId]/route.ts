import { NextResponse } from "next/server";
import { z } from "zod";

import { readJsonLimited } from "@/lib/agent/body-limit";
import { TABLES } from "@/lib/constants";
import { guardApi } from "@/lib/security/guard";
import { createServerSupabase } from "@/lib/supabase/server";

const BodySchema = z.strictObject({
  decision: z.enum(["approved", "rejected"]),
});

type Ctx = { params: Promise<{ id: string; proposalId: string }> };

/**
 * 호스트만 봇 제안 승인/거절. 승인해도 금액은 계산하지 않고,
 * 확인함에서 분담 미리보기 등으로 이어가요 (장부 즉시 변경 없음).
 */
export async function POST(request: Request, ctx: Ctx) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  const { identity } = guard;
  if (identity.kind !== "user") {
    return NextResponse.json({ error: "login-required" }, { status: 401 });
  }

  const { id: tripId, proposalId } = await ctx.params;
  if (
    !z.string().uuid().safeParse(tripId).success ||
    !z.string().uuid().safeParse(proposalId).success
  ) {
    return NextResponse.json({ error: "bad-id" }, { status: 400 });
  }

  const limited = await readJsonLimited(request, 1_024);
  if (!limited.ok) return limited.response;
  const parsed = BodySchema.safeParse(limited.json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "no-supabase" }, { status: 503 });
  }

  const { data: trip } = await supabase
    .from(TABLES.trips)
    .select("user_id")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip || trip.user_id !== identity.userId) {
    return NextResponse.json({ error: "host-only" }, { status: 403 });
  }

  const { data: row, error } = await supabase
    .from(TABLES.tripBotProposals)
    .update({
      status: parsed.data.decision,
      decided_by: identity.userId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", proposalId)
    .eq("trip_id", tripId)
    .eq("status", "pending")
    .select("id, kind, payload, status")
    .maybeSingle();

  if (error) {
    console.error("[trip-bot-decide]", error.message);
    return NextResponse.json({ error: "update-failed" }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, proposal: row });
}
