import { after } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildSmsPayload,
  createEvent,
  defaultSmsIdempotencyKey,
} from "@/lib/agent/ingest";
import { processEvent } from "@/lib/agent/run";
import { assertTripMember } from "@/lib/agent/membership";
import { pickTripForReceivedAt } from "@/lib/onboarding/agent-context";
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

  if (tripId) {
    const member = await assertTripMember(userId, tripId);
    if (!member) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  } else {
    tripId = await pickTripForReceivedAt(userId, receivedAt);
  }

  const created = await createEvent({
    userId,
    tripId,
    source: "share",
    kind: "text",
    payload,
    idempotencyKey: `${userId}:${idempotencyKey}`,
    status: tripId ? "received" : "unassigned",
  });

  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: 500 });
  }

  if (created.duplicate) {
    return NextResponse.json(
      { eventId: created.id, duplicate: true, status: tripId ? "received" : "unassigned" },
      { status: 200 }
    );
  }

  if (tripId) {
    after(() => {
      void processEvent(created.id);
    });
    return NextResponse.json(
      { eventId: created.id, status: "received", tripId },
      { status: 202 }
    );
  }

  return NextResponse.json(
    { eventId: created.id, status: "unassigned", tripId: null },
    { status: 200 }
  );
}
