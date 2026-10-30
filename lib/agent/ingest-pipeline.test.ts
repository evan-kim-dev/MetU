import { beforeEach, describe, expect, it, vi } from "vitest";

const createEvent = vi.fn();
const processEvent = vi.fn();
const after = vi.fn((fn: () => unknown) => {
  void fn();
});

vi.mock("next/server", () => ({
  after: (fn: () => unknown) => after(fn),
}));

vi.mock("@/lib/agent/ingest", () => ({
  createEvent: (...args: unknown[]) => createEvent(...args),
}));

vi.mock("@/lib/agent/run", () => ({
  processEvent: (...args: unknown[]) => processEvent(...args),
}));

describe("runIngest", () => {
  beforeEach(() => {
    createEvent.mockReset();
    processEvent.mockReset();
    after.mockClear();
  });

  it("schedules processEvent for fresh trip-bound inserts", async () => {
    createEvent.mockResolvedValue({ ok: true, id: "e1", duplicate: false });
    const { runIngest } = await import("@/lib/agent/ingest-pipeline");
    const out = await runIngest({
      userId: "u1",
      tripId: "t1",
      source: "paste",
      payload: { text: "x" },
      idempotencyKey: "k1",
    });
    expect(out.scheduled).toBe(true);
    expect(out.status).toBe("received");
    expect(processEvent).toHaveBeenCalledWith("e1");
  });

  it("does not schedule on duplicate", async () => {
    createEvent.mockResolvedValue({ ok: true, id: "e1", duplicate: true });
    const { runIngest } = await import("@/lib/agent/ingest-pipeline");
    const out = await runIngest({
      userId: "u1",
      tripId: "t1",
      source: "paste",
      payload: { text: "x" },
      idempotencyKey: "k1",
    });
    expect(out.scheduled).toBe(false);
    expect(processEvent).not.toHaveBeenCalled();
  });

  it("does not schedule when tripId is null", async () => {
    createEvent.mockResolvedValue({ ok: true, id: "e2", duplicate: false });
    const { runIngest } = await import("@/lib/agent/ingest-pipeline");
    const out = await runIngest({
      userId: "u1",
      tripId: null,
      source: "share",
      payload: { text: "x" },
      idempotencyKey: "k2",
    });
    expect(out.status).toBe("unassigned");
    expect(out.scheduled).toBe(false);
    expect(processEvent).not.toHaveBeenCalled();
  });
});
