import { describe, expect, it } from "vitest";

import type { AutomationStatusEvent } from "@/lib/hooks/useAutomationStatus";
import {
  eventsSince,
  lastDeviceEvent,
  newestRealEvent,
} from "@/lib/onboarding/last-device-event";

function ev(
  over: Partial<AutomationStatusEvent> & { id: string }
): AutomationStatusEvent {
  return {
    status: "done",
    createdAt: "2026-10-31T12:00:00+09:00",
    source: "notification",
    tripId: null,
    textPreview: "",
    error: null,
    reason: null,
    ...over,
  };
}

describe("lastDeviceEvent", () => {
  it("returns null for empty list", () => {
    expect(lastDeviceEvent([])).toBeNull();
  });

  it("ignores server sim events (no fake success)", () => {
    expect(
      lastDeviceEvent([ev({ id: "s", source: "sim", isTest: true })])
    ).toBeNull();
  });

  it("picks the newest non-sim event, including device tests", () => {
    const got = lastDeviceEvent([
      ev({ id: "old", createdAt: "2026-10-31T10:00:00+09:00" }),
      ev({
        id: "test",
        createdAt: "2026-10-31T11:00:00+09:00",
        isTest: true,
        status: "ignored",
      }),
      ev({
        id: "sim",
        source: "sim",
        createdAt: "2026-10-31T12:00:00+09:00",
      }),
    ]);
    expect(got?.id).toBe("test");
  });
});

describe("eventsSince", () => {
  const started = "2026-10-31T00:00:00.000Z";

  it("확인 단계 진입 이전 이벤트는 제외해요", () => {
    const list = [
      ev({ id: "old", createdAt: "2026-10-30T23:59:59.000Z" }),
      ev({ id: "new", createdAt: "2026-10-31T00:00:05.000Z" }),
    ];
    expect(eventsSince(list, started).map((e) => e.id)).toEqual(["new"]);
  });

  it("기준 시각이 없으면 아무 것도 인정하지 않아요", () => {
    expect(eventsSince([ev({ id: "a" })], undefined)).toEqual([]);
  });
});

describe("newestRealEvent", () => {
  it("sim 과 MTU-TEST 를 제외한 최신 실제 알림만 골라요", () => {
    const list = [
      ev({ id: "sim", source: "sim", createdAt: "2026-10-31T00:00:09.000Z" }),
      ev({ id: "test", isTest: true, createdAt: "2026-10-31T00:00:08.000Z" }),
      ev({ id: "real-1", createdAt: "2026-10-31T00:00:05.000Z" }),
      ev({ id: "real-2", createdAt: "2026-10-31T00:00:07.000Z" }),
    ];
    expect(newestRealEvent(list)?.id).toBe("real-2");
  });

  it("실제 알림이 없으면 null", () => {
    expect(newestRealEvent([ev({ id: "t", isTest: true })])).toBeNull();
  });
});
