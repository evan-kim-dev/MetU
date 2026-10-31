import { beforeEach, describe, expect, it, vi } from "vitest";

const TRIP = "22222222-2222-4222-8222-222222222222";
const EVENT = "33333333-3333-4333-8333-333333333333";

const guardApi = vi.fn();
const assertTripMember = vi.fn();
const ensureOwnerMemberAdmin = vi.fn();
const getAgentEventForUser = vi.fn();
const pickTripForReceivedAt = vi.fn();
const processEvent = vi.fn();
const eventUpdates: Array<Record<string, unknown>> = [];

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (fn: () => unknown) => {
      void fn();
    },
  };
});
vi.mock("@/lib/security/guard", () => ({
  guardApi: (...a: unknown[]) => guardApi(...a),
}));
vi.mock("@/lib/agent/membership", () => ({
  assertTripMember: (...a: unknown[]) => assertTripMember(...a),
  ensureOwnerMemberAdmin: (...a: unknown[]) => ensureOwnerMemberAdmin(...a),
}));
vi.mock("@/lib/agent/event-access", () => ({
  getAgentEventForUser: (...a: unknown[]) => getAgentEventForUser(...a),
}));
vi.mock("@/lib/onboarding/agent-context", () => ({
  pickTripForReceivedAt: (...a: unknown[]) => pickTripForReceivedAt(...a),
}));
vi.mock("@/lib/agent/run", () => ({
  processEvent: (...a: unknown[]) => processEvent(...a),
}));
vi.mock("@/lib/agent/body-limit", () => ({
  readJsonLimited: async (req: Request) => ({
    ok: true as const,
    json: await req.json(),
  }),
}));
vi.mock("@/lib/agent/admin", () => ({
  getAgentAdmin: () => ({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.update = (values: Record<string, unknown>) => {
        eventUpdates.push(values);
        return chain;
      };
      chain.eq = () => chain;
      chain.then = (resolve: (r: { error: null }) => unknown) =>
        Promise.resolve({ error: null }).then(resolve);
      return chain;
    },
  }),
}));

function req(body: unknown) {
  return new Request(`http://localhost/api/agent/events/${EVENT}/assign`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ id: EVENT }) };

describe("POST /api/agent/events/[id]/assign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    eventUpdates.length = 0;
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: "user-1" },
    });
    getAgentEventForUser.mockResolvedValue({
      ok: true,
      event: {
        id: EVENT,
        user_id: "user-1",
        trip_id: null,
        payload: { received_at: "2026-07-15T12:00:00+09:00" },
        created_at: "2026-07-15T03:00:00.000Z",
      },
    });
    assertTripMember.mockResolvedValue(true);
    ensureOwnerMemberAdmin.mockResolvedValue({ ok: true, memberId: "m1" });
    pickTripForReceivedAt.mockResolvedValue({
      tripId: TRIP,
      rule: "near",
      exactTripIds: [],
    });
  });

  it("멤버가 아니면 403", async () => {
    assertTripMember.mockResolvedValue(false);
    const { POST } = await import("./route");
    expect((await POST(req({ tripId: TRIP }), ctx)).status).toBe(403);
    expect(eventUpdates).toHaveLength(0);
  });

  it("owner 멤버를 서버에서 보장하고 배정 후 처리를 예약한다", async () => {
    const { POST } = await import("./route");
    const res = await POST(req({ tripId: TRIP }), ctx);
    expect(res.status).toBe(200);
    expect(ensureOwnerMemberAdmin).toHaveBeenCalledWith(TRIP, "user-1");
    expect(processEvent).toHaveBeenCalledWith(EVENT);
  });

  it("고른 여행이 알림 날짜와 맞지 않으면 match.rule=near 로 표시 (자동 저장 방지)", async () => {
    const { POST } = await import("./route");
    await POST(req({ tripId: TRIP }), ctx);
    expect(eventUpdates[0]).toMatchObject({
      trip_id: TRIP,
      status: "received",
      result: { match: { rule: "near" } },
    });
  });

  it("고른 여행이 날짜 창 안이면 match.rule=exact", async () => {
    pickTripForReceivedAt.mockResolvedValue({
      tripId: TRIP,
      rule: "exact",
      exactTripIds: [TRIP],
    });
    const { POST } = await import("./route");
    await POST(req({ tripId: TRIP }), ctx);
    expect(eventUpdates[0]).toMatchObject({
      result: { match: { rule: "exact" } },
    });
  });

  it("미할당으로 되돌리기(tripId null)는 매칭/멤버 보장을 하지 않는다", async () => {
    const { POST } = await import("./route");
    const res = await POST(req({ tripId: null }), ctx);
    expect(res.status).toBe(200);
    expect(ensureOwnerMemberAdmin).not.toHaveBeenCalled();
    expect(pickTripForReceivedAt).not.toHaveBeenCalled();
    expect(eventUpdates[0]).toMatchObject({ trip_id: null, status: "unassigned" });
  });
});
