import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultNotificationIdempotencyKey } from "@/lib/agent/ingest";
import { ingestNotificationPayload } from "@/lib/agent/ingest-notification";
import { SYNTHETIC_SMS } from "@/lib/ledger/sms/__fixtures__/sms";

const { createEventMock, pickMock } = vi.hoisted(() => ({
  createEventMock: vi.fn(),
  pickMock: vi.fn(),
}));

vi.mock("@/lib/agent/ingest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/agent/ingest")>();
  return { ...actual, createEvent: createEventMock };
});
vi.mock("@/lib/agent/run", () => ({ processEvent: vi.fn() }));
vi.mock("@/lib/onboarding/agent-context", () => ({
  touchNotificationAt: vi.fn(async () => undefined),
  pickTripForReceivedAt: pickMock,
}));
vi.mock("next/server", () => ({ after: vi.fn() }));

describe("ingestNotificationPayload (source=sms_shortcut, app=메시지)", () => {
  beforeEach(() => {
    createEventMock.mockReset();
    createEventMock.mockResolvedValue({ ok: true, id: "evt-1", duplicate: false });
    pickMock.mockReset();
    pickMock.mockResolvedValue({
      tripId: null,
      rule: "none",
      reason: "no_trips",
    });
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
    expect(arg.result).not.toHaveProperty("preview");
  });
});

describe("ingestNotificationPayload — 여행 매칭 규칙 저장", () => {
  const base = {
    userId: "u1",
    tokenTripId: null,
    app: "카드앱",
    title: "결제",
    body: "승인 12,500원 스타벅스",
    receivedAt: "2026-07-15T12:31:00+09:00",
  };

  beforeEach(() => {
    createEventMock.mockReset();
    createEventMock.mockResolvedValue({ ok: true, id: "evt-1", duplicate: false });
    pickMock.mockReset();
  });

  it("rule=single 로 붙으면 status received + result.match.rule 저장 (자동 처리 예약)", async () => {
    pickMock.mockResolvedValue({ tripId: "trip-1", rule: "single" });
    const outcome = await ingestNotificationPayload(base);

    expect(outcome.status).toBe("received");
    expect(outcome.tripId).toBe("trip-1");
    expect(outcome.shouldProcess).toBe(true);
    expect(outcome.matchRule).toBe("single");
    const arg = createEventMock.mock.calls[0]![0] as {
      tripId: string;
      status: string;
      result: { match: { rule: string } };
    };
    expect(arg.tripId).toBe("trip-1");
    expect(arg.status).toBe("received");
    expect(arg.result.match.rule).toBe("single");
  });

  it("rule=near 도 match.rule 로 저장 (payload 가 아니라 result)", async () => {
    pickMock.mockResolvedValue({ tripId: "trip-1", rule: "near" });
    await ingestNotificationPayload(base);
    const arg = createEventMock.mock.calls[0]![0] as {
      payload: Record<string, unknown>;
      result: { match: { rule: string } };
    };
    expect(arg.result.match.rule).toBe("near");
    expect(arg.payload).not.toHaveProperty("match");
  });

  it("매칭 없음(none) → unassigned + 사유/제안 저장, 처리 예약 안 함", async () => {
    pickMock.mockResolvedValue({
      tripId: null,
      rule: "none",
      reason: "outside_window",
      suggest: {
        tripId: "trip-1",
        rule: "outside_window",
        destination: "도쿄",
        startDate: "2026-09-01",
        endDate: "2026-09-04",
        diffDays: 40,
      },
    });
    const outcome = await ingestNotificationPayload(base);

    expect(outcome.status).toBe("unassigned");
    expect(outcome.shouldProcess).toBe(false);
    expect(outcome.missReason).toBe("outside_window");
    const arg = createEventMock.mock.calls[0]![0] as {
      tripId: string | null;
      status: string;
      result: {
        reason: string;
        match: { rule: string };
        suggest: { tripId: string; rule: string };
      };
    };
    expect(arg.tripId).toBeNull();
    expect(arg.status).toBe("unassigned");
    expect(arg.result.reason).toBe("outside_window");
    expect(arg.result.match.rule).toBe("none");
    expect(arg.result.suggest).toMatchObject({
      tripId: "trip-1",
      rule: "outside_window",
    });
  });

  it("연결 코드가 여행에 묶여 있으면 매칭을 건너뛰고 match 를 저장하지 않는다(명시 배정)", async () => {
    const outcome = await ingestNotificationPayload({
      ...base,
      tokenTripId: "trip-token",
    });
    expect(pickMock).not.toHaveBeenCalled();
    expect(outcome.status).toBe("received");
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
