import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultNotificationIdempotencyKey } from "@/lib/agent/ingest";
import { ingestNotificationPayload } from "@/lib/agent/ingest-notification";
import { SYNTHETIC_SMS } from "@/lib/ledger/sms/__fixtures__/sms";

const { createEventMock } = vi.hoisted(() => ({
  createEventMock: vi.fn(),
}));

vi.mock("@/lib/agent/ingest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/agent/ingest")>();
  return { ...actual, createEvent: createEventMock };
});
vi.mock("@/lib/agent/run", () => ({ processEvent: vi.fn() }));
vi.mock("@/lib/onboarding/agent-context", () => ({
  touchNotificationAt: vi.fn(async () => undefined),
  pickTripForReceivedAt: vi.fn(async () => null),
}));
vi.mock("next/server", () => ({ after: vi.fn() }));

describe("ingestNotificationPayload (source=sms_shortcut, app=메시지)", () => {
  beforeEach(() => {
    createEventMock.mockReset();
    createEventMock.mockResolvedValue({ ok: true, id: "evt-1", duplicate: false });
  });

  it("keeps a 메시지 앱 card SMS body readable via the rule-parser preview", async () => {
    const outcome = await ingestNotificationPayload({
      userId: "u1",
      tokenTripId: null,
      app: "메시지",
      title: "",
      body: SYNTHETIC_SMS.lotteDomestic.text,
      receivedAt: "2026-03-01T12:31:00+09:00",
      source: "sms_shortcut",
    });

    expect(outcome.source).toBe("sms_shortcut");
    expect(outcome.status).toBe("unassigned");
    const arg = createEventMock.mock.calls[0]![0] as {
      source: string;
      payload: { app: string; body: string };
      result: { preview: { amount: number; currency: string; merchant: string } };
    };
    expect(arg.source).toBe("sms_shortcut");
    expect(arg.payload.app).toBe("메시지");
    expect(arg.payload.body).toBe(SYNTHETIC_SMS.lotteDomestic.text);
    expect(arg.result.preview.amount).toBe(12500);
    expect(arg.result.preview.currency).toBe("KRW");
    expect(arg.result.preview.merchant).toBe("스타벅스");
  });

  it("does not store an approval preview for OTP messages", async () => {
    await ingestNotificationPayload({
      userId: "u1",
      tokenTripId: null,
      app: "메시지",
      title: "",
      body: SYNTHETIC_SMS.negativeOtp.text,
      receivedAt: "2026-03-01T12:31:00+09:00",
      source: "sms_shortcut",
    });
    const arg = createEventMock.mock.calls[0]![0] as { result: unknown };
    expect(arg.result).toBeNull();
  });
});

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
