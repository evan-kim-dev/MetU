import { describe, expect, it } from "vitest";

import { gateLabel } from "@/lib/onboarding/gate-label";

describe("gateLabel", () => {
  it("maps known paths", () => {
    expect(gateLabel("/")).toBe("홈");
    expect(gateLabel("/trips")).toBe("내 여행");
    expect(gateLabel("/trips/new")).toBe("여행 만들기");
    expect(gateLabel("/trips/abc/ledger")).toBe("여행 가계부");
    expect(gateLabel("/agent")).toBe("가계부");
  });

  it("unknown internal path -> 원래 보려던 화면", () => {
    expect(gateLabel("/settings")).toBe("원래 보려던 화면");
  });

  it("rejects external urls", () => {
    expect(gateLabel("https://evil.com")).toBeNull();
    expect(gateLabel("//evil.com")).toBeNull();
  });

  it("does not echo raw path in label", () => {
    const label = gateLabel("/secret/path");
    expect(label).toBe("원래 보려던 화면");
    expect(label).not.toContain("/secret");
  });
});
