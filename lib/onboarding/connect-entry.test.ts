import { describe, expect, it } from "vitest";

import { shouldEnterConnectHub } from "@/lib/onboarding/connect-entry";

describe("shouldEnterConnectHub", () => {
  it("true when active token and done/partial", () => {
    expect(
      shouldEnterConnectHub({ hasActiveToken: true, status: "done" })
    ).toBe(true);
    expect(
      shouldEnterConnectHub({ hasActiveToken: true, status: "partial" })
    ).toBe(true);
  });

  it("false without token or when pending/skipped", () => {
    expect(
      shouldEnterConnectHub({ hasActiveToken: false, status: "done" })
    ).toBe(false);
    expect(
      shouldEnterConnectHub({ hasActiveToken: true, status: "pending" })
    ).toBe(false);
    expect(
      shouldEnterConnectHub({ hasActiveToken: true, status: "skipped" })
    ).toBe(false);
  });
});
