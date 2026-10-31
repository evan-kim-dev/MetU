import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";

import { runIngest } from "@/lib/agent/ingest-pipeline";
import { readJsonLimited } from "@/lib/agent/body-limit";
import { apiInternalError } from "@/lib/api/respond";
import { TABLES } from "@/lib/constants";
import {
  DEMO_TRIP_DESTINATION,
  DEMO_TRIP_MEMO_TAG,
  demoScenarioStepCount,
  getDemoStep,
} from "@/lib/demo/scenario";
import { guardApi } from "@/lib/security/guard";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createServerSupabase } from "@/lib/supabase/server";

export const maxDuration = 60;

const BodySchema = z.object({
  step: z.number().int().min(1).max(20),
});

async function resolveDemoTripId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from(TABLES.trips)
    .select("id, memo")
    .eq("user_id", userId)
    .eq("destination", DEMO_TRIP_DESTINATION)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) return null;
  const hit = data.find(
    (row) =>
      typeof row.memo === "string" && row.memo.includes(DEMO_TRIP_MEMO_TAG)
  );
  return hit ? (hit.id as string) : null;
}

export async function POST(request: Request) {
  const startedAtMs = Date.now();
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  if (guard.identity.kind !== "user") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = guard.identity.userId;
  const rate = checkRateLimit(`demo-notify:${userId}`, {
    limit: 20,
    windowMs: 60_000,
  });
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

  const limited = await readJsonLimited(request, 4_096);
  if (!limited.ok) return limited.response;

  const parsed = BodySchema.safeParse(limited.json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation-failed", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const maxStep = demoScenarioStepCount();
  if (parsed.data.step > maxStep) {
    return NextResponse.json(
      { error: "invalid-step", maxStep },
      { status: 400 }
    );
  }

  const stepDef = getDemoStep(parsed.data.step);
  if (!stepDef) {
    return NextResponse.json({ error: "invalid-step" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const tripId = await resolveDemoTripId(supabase, userId);
  if (!tripId) {
    return NextResponse.json(
      { error: "demo-trip-missing", message: "먼저 데모 여행을 만들어 주세요." },
      { status: 404 }
    );
  }

  const bucket = new Date().toISOString().slice(0, 16);
  const idempotencyKey = createHash("sha256")
    .update(`demo-notify|${userId}|${parsed.data.step}|${bucket}`, "utf8")
    .digest("hex");

  const outcome = await runIngest({
    userId,
    tripId,
    source: "sim",
    kind: "text",
    payload: {
      app: "데모",
      title: `데모 알림 ${parsed.data.step}`,
      body: stepDef.text,
      received_at: stepDef.receivedAt,
    },
    idempotencyKey,
    processIfTrip: true,
  });

  if (!outcome.result.ok) {
    return apiInternalError(outcome.result.error);
  }

  return NextResponse.json({
    eventId: outcome.result.id,
    duplicate: outcome.result.duplicate,
    status: outcome.status,
    tripId,
    step: parsed.data.step,
    label: stepDef.label,
    startedAtMs,
    acceptedAtMs: Date.now(),
  });
}
