import { NextResponse } from "next/server";
import { z } from "zod";

import { acceptSuggestion } from "@/lib/agent/accept-suggestion";
import { readJsonLimited } from "@/lib/agent/body-limit";
import {
  ensureOpenRebalanceSuggestion,
  previewTripRebalance,
} from "@/lib/agent/rebalance-preview";
import { TABLES } from "@/lib/constants";
import { guardApi, rejectAnonymousWrite } from "@/lib/security/guard";
import { createServerSupabase } from "@/lib/supabase/server";

const BodySchema = z.strictObject({
  action: z.enum(["preview", "apply"]),
});

type Ctx = { params: Promise<{ id: string }> };

/**
 * 여행 상세 「일정 확인하기」: 남은 예산·확정 지출 기준 일정 조정안.
 * preview — 계산만. apply — Suggestion 생성(필요 시) 후 수락해 daily_schedule 반영.
 * 호스트만. 게스트 403.
 */
export async function POST(request: Request, ctx: Ctx) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  const { identity } = guard;
  if (identity.kind !== "user") {
    return NextResponse.json({ error: "login-required" }, { status: 401 });
  }
  const anon = rejectAnonymousWrite(identity);
  if (anon) return anon;

  const { id: tripId } = await ctx.params;
  if (!z.string().uuid().safeParse(tripId).success) {
    return NextResponse.json({ error: "bad-trip" }, { status: 400 });
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
    .select("id, user_id")
    .eq("id", tripId)
    .maybeSingle();

  if (!trip) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
  if (String(trip.user_id) !== identity.userId) {
    return NextResponse.json({ error: "host-only" }, { status: 403 });
  }

  if (parsed.data.action === "preview") {
    const preview = await previewTripRebalance(tripId);
    if (!preview) {
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }
    return NextResponse.json({
      ok: true,
      action: "preview",
      ...preview,
      // 클라이언트에 estCost 배열은 필요하지만 수락은 서버 재검증 — 그대로 내려도 OK
    });
  }

  const ensured = await ensureOpenRebalanceSuggestion({
    tripId,
    actorUserId: identity.userId,
    replaceOpen: true,
  });
  if (!ensured.ok) {
    const status =
      ensured.error === "within-budget"
        ? 200
        : ensured.error === "trip-not-found"
          ? 404
          : 400;
    if (ensured.error === "within-budget") {
      return NextResponse.json({
        ok: true,
        action: "apply",
        applied: false,
        reason: "within-budget",
        preview: ensured.preview ?? null,
      });
    }
    return NextResponse.json({ error: ensured.error }, { status });
  }

  const accepted = await acceptSuggestion({
    actorUserId: identity.userId,
    tripId,
    suggestionId: ensured.suggestionId,
  });
  if (!accepted.ok) {
    const status =
      accepted.error === "host-only"
        ? 403
        : accepted.error === "not-found" || accepted.error === "not-open"
          ? 404
          : 400;
    return NextResponse.json({ error: accepted.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    action: "apply",
    applied: true,
    suggestionId: ensured.suggestionId,
    preview: ensured.preview,
  });
}
