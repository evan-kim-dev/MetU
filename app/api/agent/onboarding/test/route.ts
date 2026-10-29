import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { getAgentAdmin } from "@/lib/agent/admin";
import { createEvent } from "@/lib/agent/ingest";
import {
  pickTripForAutomationTest,
  touchServerTestAt,
} from "@/lib/onboarding/agent-context";
import { guardApi } from "@/lib/security/guard";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const maxDuration = 30;

export async function POST(request: Request) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  if (guard.identity.kind !== "user") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rate = checkRateLimit(
    `onboarding-test:${guard.identity.userId}`,
    { limit: 5, windowMs: 60_000 }
  );
  if (!rate.ok) {
    return NextResponse.json(
      { error: "rate-limit-exceeded" },
      {
        status: 429,
        headers: rate.retryAfterSec
          ? { "Retry-After": String(rate.retryAfterSec) }
          : undefined,
      }
    );
  }

  const userId = guard.identity.userId;
  // Trip is optional — connection test only needs an event row.
  const tripId = await pickTripForAutomationTest(userId);

  const bucket = new Date().toISOString().slice(0, 16);
  const idempotencyKey = createHash("sha256")
    .update(`onboarding-server-test|${userId}|${bucket}`, "utf8")
    .digest("hex");

  const created = await createEvent({
    userId,
    tripId,
    source: "sim",
    kind: "text",
    payload: {
      app: "MetU",
      title: "연결 테스트",
      body: "MTU-TEST-SERVER",
      received_at: new Date().toISOString(),
    },
    idempotencyKey,
  });

  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: 500 });
  }

  const admin = getAgentAdmin();
  if (admin) {
    await admin
      .from("agent_events")
      .update({
        status: "done",
        result: { test: true, via: "server" },
        processed_at: new Date().toISOString(),
      })
      .eq("id", created.id)
      .eq("user_id", userId);
  }

  await touchServerTestAt(userId);

  return NextResponse.json({
    ok: true,
    eventId: created.id,
    duplicate: created.duplicate,
  });
}
