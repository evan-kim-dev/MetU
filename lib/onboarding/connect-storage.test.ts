// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONNECT_STORAGE_KEY,
  clearSnapshot,
  loadSnapshot,
  saveSnapshot,
} from "@/lib/onboarding/connect-storage";

describe("connect-storage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("saves without token prefixes", () => {
    saveSnapshot({
      phase: "code",
      platform: "ios",
      ios27: true,
      selectedApps: ["토스"],
      serverOk: false,
      deviceOk: false,
    });
    const raw = sessionStorage.getItem(CONNECT_STORAGE_KEY) ?? "";
    expect(raw).not.toMatch(/metu-/i);
    expect(raw).not.toMatch(/mtu_/i);
    expect(loadSnapshot()?.phase).toBe("code");
  });

  it("ignores corrupted JSON", () => {
    sessionStorage.setItem(CONNECT_STORAGE_KEY, "{not-json");
    expect(loadSnapshot()).toBeNull();
  });

  it("ignores storage exceptions", () => {
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    expect(() =>
      saveSnapshot({
        phase: "code",
        platform: "ios",
        ios27: true,
        selectedApps: [],
        serverOk: false,
        deviceOk: false,
      })
    ).not.toThrow();
    spy.mockRestore();
  });

  it("ignores version/shape mismatch", () => {
    sessionStorage.setItem(
      CONNECT_STORAGE_KEY,
      JSON.stringify({ phase: "nope", platform: "ios" })
    );
    expect(loadSnapshot()).toBeNull();
  });

  it("keeps verifyStartedAt / realOk and rejects a bad timestamp", () => {
    saveSnapshot({
      phase: "verify",
      platform: "ios",
      ios27: true,
      selectedApps: [],
      serverOk: false,
      deviceOk: false,
      realOk: false,
      verifyStartedAt: "2026-10-31T00:00:00.000Z",
    });
    expect(loadSnapshot()?.verifyStartedAt).toBe("2026-10-31T00:00:00.000Z");
    sessionStorage.setItem(
      CONNECT_STORAGE_KEY,
      JSON.stringify({
        phase: "verify",
        platform: "ios",
        ios27: true,
        selectedApps: [],
        serverOk: false,
        deviceOk: false,
        verifyStartedAt: "not-a-date",
      })
    );
    expect(loadSnapshot()).toBeNull();
  });

  it("clearSnapshot removes key", () => {
    saveSnapshot({
      phase: "verify",
      platform: "android",
      ios27: null,
      selectedApps: [],
      serverOk: true,
      deviceOk: false,
    });
    clearSnapshot();
    expect(loadSnapshot()).toBeNull();
  });
});
