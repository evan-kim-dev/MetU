import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn(async () => ({ error: null }));
const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select, upsert }));

vi.mock("@/lib/agent/admin", () => ({
  getAgentAdmin: () => ({ from }),
}));

describe("getOrSet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingle.mockResolvedValue({ data: null });
  });

  it("miss calls fn once and upserts", async () => {
    const { getOrSet } = await import("@/lib/server/cache");
    const fn = vi.fn(async () => ({ n: 1 }));
    const res = await getOrSet("k1", 60, fn);
    expect(res.hit).toBe("miss");
    expect(res.value).toEqual({ n: 1 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalled();
  });

  it("fresh hit does not call fn", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        key: "k2",
        value: { n: 2 },
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    });
    const { getOrSet } = await import("@/lib/server/cache");
    const fn = vi.fn(async () => ({ n: 99 }));
    const res = await getOrSet("k2", 60, fn);
    expect(res.hit).toBe("fresh");
    expect(res.value).toEqual({ n: 2 });
    expect(fn).toHaveBeenCalledTimes(0);
  });

  it("staleIfError returns expired value when fn throws", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        key: "k3",
        value: { n: 3 },
        fetched_at: new Date(Date.now() - 120_000).toISOString(),
        expires_at: new Date(Date.now() - 60_000).toISOString(),
      },
    });
    const { getOrSet } = await import("@/lib/server/cache");
    const fn = vi.fn(async () => {
      throw new Error("upstream");
    });
    const res = await getOrSet("k3", 60, fn, { staleIfError: true });
    expect(res.hit).toBe("stale");
    expect(res.value).toEqual({ n: 3 });
  });
});
