import { NextResponse } from "next/server";
import { z } from "zod";

import {
  acceptSuggestion,
  dismissSuggestion,
} from "@/lib/agent/accept-suggestion";
import { readJsonLimited } from "@/lib/agent/body-limit";
import { guardApi } from "@/lib/security/guard";

const BodySchema = z.strictObject({
  decision: z.enum(["accepted", "dismissed"]),
});

type Ctx = { params: Promise<{ id: string; suggestionId: string }> };

/**
 * 호스트만 Suggestion 수락/거절.
 * settle 수락 시 settlement 스냅샷, rebalance 수락 시 daily_schedule 반영.
 * 게스트는 403 (정산 생성·일정 변경 금지). /s 읽기·송금은 기존 경로 유지.
 */
export async function POST(request: Request, ctx: Ctx) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  const { identity } = guard;
  if (identity.kind !== "user") {
    return NextResponse.json({ error: "login-required" }, { status: 401 });
  }

  const { id: tripId, suggestionId } = await ctx.params;
  if (
    !z.string().uuid().safeParse(tripId).success ||
    !z.string().uuid().safeParse(suggestionId).success
  ) {
    return NextResponse.json({ error: "bad-id" }, { status: 400 });
  }

  const limited = await readJsonLimited(request, 1_024);
  if (!limited.ok) return limited.response;
  const parsed = BodySchema.safeParse(limited.json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const result =
    parsed.data.decision === "accepted"
      ? await acceptSuggestion({
          actorUserId: identity.userId,
          tripId,
          suggestionId,
        })
      : await dismissSuggestion({
          actorUserId: identity.userId,
          tripId,
          suggestionId,
        });

  if (!result.ok) {
    const status =
      result.error === "host-only"
        ? 403
        : result.error === "not-found" || result.error === "not-open"
          ? 404
          : result.error === "login-required"
            ? 401
            : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    type: result.type,
    settlementId: result.settlementId ?? null,
  });
}
