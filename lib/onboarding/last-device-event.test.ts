import { describe, expect, it } from "vitest";

import type { AutomationStatusEvent } from "@/lib/hooks/useAutomationStatus";
import { lastDeviceEvent } from "@/lib/onboarding/last-device-event";

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
