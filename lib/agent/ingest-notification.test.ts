import { describe, expect, it } from "vitest";

import { defaultNotificationIdempotencyKey } from "@/lib/agent/ingest";

describe("defaultNotificationIdempotencyKey", () => {
  it("is stable within the same minute", () => {
    const a = defaultNotificationIdempotencyKey({
      userId: "u1",
      app: "KB Pay",
      title: "결제",
      body: "승인 1원",
      receivedAt: "2026-10-30T12:34:10+09:00",
    });
    const b = defaultNotificationIdempotencyKey({
      userId: "u1",
      app: "KB Pay",
      title: "결제",
      body: "승인 1원",
      receivedAt: "2026-10-30T12:34:55+09:00",
    });
    expect(a).toBe(b);
  });

  it("changes when body changes", () => {
    const a = defaultNotificationIdempotencyKey({
      userId: "u1",
      app: "KB Pay",
      title: "결제",
      body: "MTU-TEST",
      receivedAt: "2026-10-30T12:00:00+09:00",
    });
    const b = defaultNotificationIdempotencyKey({
      userId: "u1",
      app: "KB Pay",
      title: "결제",
      body: "승인 1원",
      receivedAt: "2026-10-30T12:00:00+09:00",
    });
    expect(a).not.toBe(b);
  });
});
