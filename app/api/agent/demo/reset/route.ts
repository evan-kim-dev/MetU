import { NextResponse } from "next/server";

import { getAgentAdmin } from "@/lib/agent/admin";
import { apiInternalError } from "@/lib/api/respond";
import { TABLES } from "@/lib/constants";
import { isDemoModeEnabled } from "@/lib/demo/mode";
import { MINGLING_TRIP_MEMO_TAG } from "@/lib/demo/scenario";
import { guardApi, rejectAnonymousWrite } from "@/lib/security/guard";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const maxDuration = 30;

/**
 * 본인 소유 `[metu-demo:mingling]` 여행만 삭제.
 * trips CASCADE 로 members/expenses/agent_events 등이 함께 정리됨.
 */
export async function POST(request: Request) {
  if (!isDemoModeEnabled()) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  if (guard.identity.kind !== "user") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const anon = rejectAnonymousWrite(guard.identity);
  if (anon) return anon;

  const userId = guard.identity.userId;
  const rate = checkRateLimit(`demo-reset:${userId}`, {
    limit: 5,
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

  const admin = getAgentAdmin();
  if (!admin) {
    return apiInternalError(new Error("demo-reset-admin-unavailable"));
  }

  const { data, error } = await admin
    .from(TABLES.trips)
    .select("id, memo")
    .eq("user_id", userId)
    .limit(50);

  if (error) {
    return apiInternalError(error);
  }

  const ids = (data ?? [])
    .filter(
      (row) =>
        typeof row.memo === "string" &&
        row.memo.includes(MINGLING_TRIP_MEMO_TAG)
    )
    .map((row) => row.id as string);

  if (ids.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  const { error: delError, count } = await admin
    .from(TABLES.trips)
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .in("id", ids);

  if (delError) {
    return apiInternalError(delError);
  }

  return NextResponse.json({ deleted: count ?? ids.length });
}
