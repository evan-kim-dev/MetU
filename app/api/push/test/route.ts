import { NextResponse } from "next/server";

import { sendPush } from "@/lib/push/send";
import { guardApi } from "@/lib/security/guard";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  if (guard.identity.kind !== "user") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rate = checkRateLimit(`push-test:${guard.clientKey}`, {
    limit: 3,
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

  await sendPush(guard.identity.userId, {
    title: "Met-U 테스트 알림",
    body: "웹 푸시가 연결됐어요.",
    url: "/profile",
    tag: "push-test",
  });

  return NextResponse.json({ ok: true });
}
