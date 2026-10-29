import { describe, expect, it } from "vitest";

import {
  computeAutomationState,
  detectPlatform,
} from "@/lib/onboarding/automation";

const NOW = 1_700_000_000_000;
const H = 60 * 60 * 1000;

describe("detectPlatform", () => {
  it("detects iOS", () => {
    expect(
      detectPlatform(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"
      )
    ).toBe("ios");
  });

  it("detects Android", () => {
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14) Mobile")).toBe(
      "android"
    );
  });

  it("detects desktop", () => {
    expect(
      detectPlatform(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
      )
    ).toBe("desktop");
  });
});

describe("computeAutomationState", () => {
  it("pending -> off", () => {
    expect(
      computeAutomationState({
        status: "pending",
        lastNotificationAt: null,
        hasActiveToken: true,
        activeTrip: true,
        now: NOW,
      })
    ).toBe("off");
  });

  it("skipped -> off", () => {
    expect(
      computeAutomationState({
        status: "skipped",
        hasActiveToken: true,
        activeTrip: true,
        now: NOW,
      })
    ).toBe("off");
  });

  it("done without token -> off", () => {
    expect(
      computeAutomationState({
        status: "done",
        hasActiveToken: false,
        activeTrip: true,
        now: NOW,
      })
    ).toBe("off");
  });

  it("partial -> unverified", () => {
    expect(
      computeAutomationState({
        status: "partial",
        hasActiveToken: true,
        activeTrip: false,
        now: NOW,
      })
    ).toBe("unverified");
  });

  it("done + active trip + stale notification -> silent", () => {
    expect(
      computeAutomationState({
        status: "done",
        hasActiveToken: true,
        activeTrip: true,
        lastNotificationAt: new Date(NOW - 25 * H).toISOString(),
        now: NOW,
        silenceHours: 24,
      })
    ).toBe("silent");
  });

  it("done + no active trip -> ok (not silent)", () => {
    expect(
      computeAutomationState({
        status: "done",
        hasActiveToken: true,
        activeTrip: false,
        lastNotificationAt: null,
        now: NOW,
      })
    ).toBe("ok");
  });

  it("done + active trip + fresh notification -> ok", () => {
    expect(
      computeAutomationState({
        status: "done",
        hasActiveToken: true,
        activeTrip: true,
        lastNotificationAt: new Date(NOW - 23 * H).toISOString(),
        now: NOW,
        silenceHours: 24,
      })
    ).toBe("ok");
  });

  it("exactly 24h boundary -> silent", () => {
    expect(
      computeAutomationState({
        status: "done",
        hasActiveToken: true,
        activeTrip: true,
        lastNotificationAt: new Date(NOW - 24 * H).toISOString(),
        now: NOW,
        silenceHours: 24,
      })
    ).toBe("silent");
  });
});
