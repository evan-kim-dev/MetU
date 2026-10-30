import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetMemoryUsageSinkForTests,
  memoryUsageSink,
  resetUsageSinkForTests,
  startOfKstDayMs,
} from "@/lib/ai/usage";

describe("startOfKstDayMs", () => {
  it("returns a finite timestamp at KST midnight", () => {
    const start = startOfKstDayMs(Date.parse("2026-10-30T15:00:00Z"));
    expect(Number.isFinite(start)).toBe(true);
    expect(new Date(start).toISOString()).toContain("T15:00:00.000Z");
  });
});

describe("memoryUsageSink", () => {
  afterEach(() => {
    __resetMemoryUsageSinkForTests();
    resetUsageSinkForTests();
    vi.restoreAllMocks();
  });

  it("counts only today for the same user", async () => {
    await memoryUsageSink.record({
      userId: "u1",
      model: "m",
      purpose: "t",
      ok: true,
    });
    await memoryUsageSink.record({
      userId: "u2",
      model: "m",
      purpose: "t",
      ok: true,
    });
    expect(await memoryUsageSink.countToday("u1")).toBe(1);
    expect(await memoryUsageSink.countToday("u2")).toBe(1);
  });
});
