import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const guardApi = vi.fn();
const from = vi.fn();
const insertTripToSupabase = vi.fn();
const ensureOwnerMember = vi.fn();
const addTripMember = vi.fn();
const listMembers = vi.fn();

vi.mock("@/lib/security/guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
  rejectAnonymousWrite: (identity: { kind?: string; isAnonymous?: boolean }) =>
    identity.kind === "user" && identity.isAnonymous === true
      ? Response.json({ error: "guest-readonly" }, { status: 403 })
      : null,
}));
vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: () => ({ ok: true }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ from }),
}));
vi.mock("@/lib/trips/supabase", () => ({
  insertTripToSupabase: (...args: unknown[]) => insertTripToSupabase(...args),
}));
vi.mock("@/lib/trips/destination-image", () => ({
  resolveDestinationImage: () => "/demo.png",
}));
vi.mock("@/lib/ledger/supabase", () => ({
  ensureOwnerMember: (...args: unknown[]) => ensureOwnerMember(...args),
  addTripMember: (...args: unknown[]) => addTripMember(...args),
  listMembers: (...args: unknown[]) => listMembers(...args),
}));

function mockFindTrips(
  rows: Array<{ id: string; destination: string; memo: string }>
) {
  const limit = vi.fn().mockResolvedValue({ data: rows, error: null });
  const order = vi.fn(() => ({ limit }));
  const eqDest = vi.fn(() => ({ order }));
  const eqUser = vi.fn(() => ({ eq: eqDest }));
  const select = vi.fn(() => ({ eq: eqUser }));
  from.mockReturnValue({ select });
}

describe("POST /api/agent/demo/seed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    guardApi.mockResolvedValue({ identity: { kind: "guest" } });
    listMembers.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("데모 모드가 꺼져 있으면 404 이고 세션 검사도 하지 않아요", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/agent/demo/seed", { method: "POST" })
    );
    expect(res.status).toBe(404);
    expect(guardApi).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("데모 모드가 켜져 있으면 기존 동작(게스트는 401)을 유지해요", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "1");
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/agent/demo/seed", { method: "POST" })
    );
    expect(res.status).toBe(401);
    expect(guardApi).toHaveBeenCalledTimes(1);
  });

  it("mingling 시나리오는 미연결 동행자 2명을 두고 멱등이에요", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "1");
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: "host-1", isAnonymous: false },
    });
    mockFindTrips([]);
    insertTripToSupabase.mockResolvedValue({ id: "trip-m1" });
    ensureOwnerMember.mockResolvedValue(undefined);
    addTripMember
      .mockResolvedValueOnce({ id: "m-minsu", displayName: "민수", userId: null })
      .mockResolvedValueOnce({ id: "m-jia", displayName: "지아", userId: null });
    listMembers
      .mockResolvedValueOnce([
        { id: "owner", displayName: "나", isOwner: true, userId: "host-1" },
        { id: "m-minsu", displayName: "민수", isOwner: false, userId: null },
        { id: "m-jia", displayName: "지아", isOwner: false, userId: null },
      ])
      .mockResolvedValueOnce([
        { id: "owner", displayName: "나", isOwner: true, userId: "host-1" },
        { id: "m-minsu", displayName: "민수", isOwner: false, userId: null },
        { id: "m-jia", displayName: "지아", isOwner: false, userId: null },
      ]);

    const { POST } = await import("./route");
    const first = await POST(
      new Request("http://localhost/api/agent/demo/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: "mingling" }),
      })
    );
    expect(first.status).toBe(200);
    const body1 = (await first.json()) as {
      tripId: string;
      reused: boolean;
      companions: Array<{ displayName: string; userId: string | null }>;
    };
    expect(body1.tripId).toBe("trip-m1");
    expect(body1.reused).toBe(false);
    expect(body1.companions).toHaveLength(2);
    expect(body1.companions.every((c) => c.userId === null)).toBe(true);
    expect(addTripMember).toHaveBeenCalledTimes(2);

    mockFindTrips([
      {
        id: "trip-m1",
        destination: "데모 여행 (밍글링)",
        memo: "[metu-demo:mingling] 데모",
      },
    ]);
    listMembers.mockResolvedValue([
      { id: "owner", displayName: "나", isOwner: true, userId: "host-1" },
      { id: "m-minsu", displayName: "민수", isOwner: false, userId: null },
      { id: "m-jia", displayName: "지아", isOwner: false, userId: null },
    ]);

    const second = await POST(
      new Request("http://localhost/api/agent/demo/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: "mingling" }),
      })
    );
    expect(second.status).toBe(200);
    const body2 = (await second.json()) as { tripId: string; reused: boolean };
    expect(body2.tripId).toBe("trip-m1");
    expect(body2.reused).toBe(true);
    expect(insertTripToSupabase).toHaveBeenCalledTimes(1);
  });
});
