import { beforeEach, describe, expect, it, vi } from "vitest";

const guardApi = vi.fn();
const runIngest = vi.fn();
const checkRateLimit = vi.fn();
const from = vi.fn();

vi.mock("@/lib/security/guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
}));
vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
}));
vi.mock("@/lib/agent/ingest-pipeline", () => ({
  runIngest: (...args: unknown[]) => runIngest(...args),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ from }),
}));
vi.mock("@/lib/agent/body-limit", () => ({
  readJsonLimited: async (req: Request) => {
    const json = await req.json();
    return { ok: true as const, json };
  },
}));

function mockTripQuery(tripId: string | null) {
  const limit = vi.fn().mockResolvedValue({
    data: tripId
      ? [
          {
            id: tripId,
            memo: "[metu-demo:osaka] 데모",
          },
        ]
      : [],
    error: null,
  });
  const order = vi.fn(() => ({ limit }));
  const eqDest = vi.fn(() => ({ order }));
  const eqUser = vi.fn(() => ({ eq: eqDest }));
  const select = vi.fn(() => ({ eq: eqUser }));
  from.mockReturnValue({ select });
}

describe("POST /api/agent/demo/notify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    checkRateLimit.mockReturnValue({ ok: true });
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: "user-1" },
    });
    mockTripQuery("trip-demo");
    runIngest.mockResolvedValue({
      result: { ok: true, id: "evt-1", duplicate: false },
      status: "received",
      tripId: "trip-demo",
      scheduled: true,
    });
  });

  it("rejects guest", async () => {
    guardApi.mockResolvedValue({ identity: { kind: "guest" } });
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/agent/demo/notify", {
        method: "POST",
        body: JSON.stringify({ step: 1 }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("rejects invalid step", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/agent/demo/notify", {
        method: "POST",
        body: JSON.stringify({ step: 99 }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns duplicate:true on same-minute re-call", async () => {
    runIngest.mockResolvedValue({
      result: { ok: true, id: "evt-1", duplicate: true },
      status: "received",
      tripId: "trip-demo",
      scheduled: false,
    });
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/agent/demo/notify", {
        method: "POST",
        body: JSON.stringify({ step: 1 }),
      })
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { duplicate: boolean; eventId: string };
    expect(json.duplicate).toBe(true);
    expect(json.eventId).toBe("evt-1");
    expect(runIngest).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "sim",
        tripId: "trip-demo",
        processIfTrip: true,
      })
    );
  });
});
