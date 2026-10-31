import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { getAgentAdmin } from "@/lib/agent/admin";
import { runIngest } from "@/lib/agent/ingest-pipeline";
import { touchServerTestAt } from "@/lib/onboarding/agent-context";
import { apiInternalError } from "@/lib/api/respond";
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
  // 서버 확인은 여행과 무관해요. 날짜를 무시하고 아무 여행에 붙이지 않고 tripId 는 항상 null.
  // 이 결과는 "폰 연결됨" 표시에 쓰지 않아요(source "sim" 은 연결 확인에서 제외).

  const bucket = new Date().toISOString().slice(0, 16);
  const idempotencyKey = createHash("sha256")
    .update(`onboarding-server-test|${userId}|${bucket}`, "utf8")
    .digest("hex");

  const outcome = await runIngest({
    userId,
    tripId: null,
    source: "sim",
    kind: "text",
    payload: {
      app: "MetU",
      title: "연결 테스트",
      body: "MTU-TEST-SERVER",
      received_at: new Date().toISOString(),
    },
    idempotencyKey,
    processIfTrip: false,
  });

  if (!outcome.result.ok) {
    return apiInternalError(outcome.result.error);
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
      .eq("id", outcome.result.id)
      .eq("user_id", userId);
  }

  await touchServerTestAt(userId);

  return NextResponse.json({
    ok: true,
    eventId: outcome.result.id,
    duplicate: outcome.result.duplicate,
  });
}
