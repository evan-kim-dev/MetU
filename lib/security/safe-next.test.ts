import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/security/safe-next";

describe("safeNextPath", () => {
  it("allows internal paths", () => {
    expect(safeNextPath("/join/abc")).toBe("/join/abc");
    expect(safeNextPath("/trips/1/ledger")).toBe("/trips/1/ledger");
  });

  it("blocks open redirects", () => {
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("/\\evil")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("evil")).toBe("/");
  });
});
