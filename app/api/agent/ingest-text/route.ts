import { NextResponse } from "next/server";
import { z } from "zod";

import { readJsonLimited } from "@/lib/agent/body-limit";
import {
  buildSmsPayload,
  defaultSmsIdempotencyKey,
} from "@/lib/agent/ingest";
import { runIngest } from "@/lib/agent/ingest-pipeline";
import { assertTripMember } from "@/lib/agent/membership";
import { apiInternalError } from "@/lib/api/respond";
import {
  pickTripForReceivedAt,
  type TripPick,
} from "@/lib/onboarding/agent-context";
import { tripPickToResult } from "@/lib/onboarding/trip-match";
import { guardApi } from "@/lib/security/guard";

export const maxDuration = 60;

const BodySchema = z.object({
  text: z.string().min(1).max(2000),
  tripId: z.string().uuid().nullable().optional(),
  receivedAt: z.string().datetime({ offset: true }).optional(),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

/** Session-authenticated text ingest (share-target / paste without token). */
export async function POST(request: Request) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  if (guard.identity.kind !== "user") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limited = await readJsonLimited(request, 8_192);
  if (!limited.ok) return limited.response;

  const parsed = BodySchema.safeParse(limited.json);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation-failed" }, { status: 400 });
  }

  const userId = guard.identity.userId;
  const receivedAt = parsed.data.receivedAt ?? new Date().toISOString();
  const { payload, redacted } = buildSmsPayload({
    text: parsed.data.text,
    receivedAt,
  });

  const idempotencyKey =
    parsed.data.idempotencyKey ??
    defaultSmsIdempotencyKey(redacted, receivedAt);

  let tripId: string | null =
    parsed.data.tripId === undefined ? null : parsed.data.tripId;
  let pick: TripPick | null = null;

  if (tripId) {
    const member = await assertTripMember(userId, tripId);
    if (!member) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  } else {
    pick = await pickTripForReceivedAt(userId, receivedAt);
    tripId = pick.tripId;
  }

  const outcome = await runIngest({
    userId,
    tripId,
    source: "share",
    kind: "text",
    payload,
    idempotencyKey: `${userId}:${idempotencyKey}`,
    status: tripId ? "received" : "unassigned",
    // 날짜 규칙으로 붙인 경우만 match.rule 저장 (명시한 tripId 는 확정으로 본다).
    ...(pick ? { result: tripPickToResult(pick) } : {}),
  });

  if (!outcome.result.ok) {
    return apiInternalError(outcome.result.error);
  }

  if (outcome.result.duplicate) {
    return NextResponse.json(
      {
        eventId: outcome.result.id,
        duplicate: true,
        status: tripId ? "received" : "unassigned",
      },
      { status: 200 }
    );
  }

  if (tripId) {
    return NextResponse.json(
      { eventId: outcome.result.id, status: "received", tripId },
      { status: 202 }
    );
  }

  return NextResponse.json(
    { eventId: outcome.result.id, status: "unassigned", tripId: null },
    { status: 200 }
  );
}
