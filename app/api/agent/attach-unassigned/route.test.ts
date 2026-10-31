import { beforeEach, describe, expect, it, vi } from "vitest";

const TRIP = "22222222-2222-4222-8222-222222222222";

const guardApi = vi.fn();
const assertTripMember = vi.fn();
const ensureOwnerMemberAdmin = vi.fn();
const rpc = vi.fn();
const from = vi.fn();
const processEvent = vi.fn();
const afterMock = vi.fn((fn: () => unknown) => {
  void fn();
});

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: (fn: () => unknown) => afterMock(fn) };
});
vi.mock("@/lib/security/guard", () => ({
  guardApi: (...a: unknown[]) => guardApi(...a),
}));
vi.mock("@/lib/agent/membership", () => ({
  assertTripMember: (...a: unknown[]) => assertTripMember(...a),
  ensureOwnerMemberAdmin: (...a: unknown[]) => ensureOwnerMemberAdmin(...a),
}));
vi.mock("@/lib/agent/admin", () => ({
  getAgentAdmin: () => ({ rpc, from }),
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

function req(body: unknown) {
  return new Request("http://localhost/api/agent/attach-unassigned", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function mockRequeueRows(rows: Array<{ id: string }>) {
  const limit = vi.fn().mockResolvedValue({ data: rows, error: null });
  const order = vi.fn(() => ({ limit }));
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = order;
  from.mockReturnValue(chain);
}

describe("POST /api/agent/attach-unassigned", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: "user-1" },
    });
    assertTripMember.mockResolvedValue(true);
    ensureOwnerMemberAdmin.mockResolvedValue({ ok: true, memberId: "m1" });
    rpc.mockResolvedValue({ data: 0, error: null });
    mockRequeueRows([]);
  });

  it("게스트는 401", async () => {
    guardApi.mockResolvedValue({ identity: { kind: "guest" } });
    const { POST } = await import("./route");
    expect((await POST(req({ tripId: TRIP }))).status).toBe(401);
  });

  it("검증 실패(uuid 아님 / 날짜 형식 오류)는 400", async () => {
    const { POST } = await import("./route");
    expect((await POST(req({ tripId: "nope" }))).status).toBe(400);
    expect(
      (await POST(req({ tripId: TRIP, startDate: "내일" }))).status
    ).toBe(400);
  });

  it("멤버가 아니면 403, RPC 는 호출하지 않는다", async () => {
    assertTripMember.mockResolvedValue(false);
    const { POST } = await import("./route");
    expect((await POST(req({ tripId: TRIP }))).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("owner 멤버를 서버에서 보장한 뒤 RPC 를 부른다 (날짜 인자 없음)", async () => {
    const { POST } = await import("./route");
    const res = await POST(req({ tripId: TRIP }));
    expect(res.status).toBe(200);
    expect(ensureOwnerMemberAdmin).toHaveBeenCalledWith(TRIP, "user-1");
    expect(rpc).toHaveBeenCalledWith("agent_attach_unassigned", {
      p_user_id: "user-1",
      p_trip_id: TRIP,
    });
    expect(ensureOwnerMemberAdmin.mock.invocationCallOrder[0]).toBeLessThan(
      rpc.mock.invocationCallOrder[0]!
    );
  });

  it("클라이언트가 보낸 start/end 를 RPC 의 p_start/p_end 로 넘긴다", async () => {
    const { POST } = await import("./route");
    await POST(
      req({ tripId: TRIP, startDate: "2026-07-20", endDate: "2026-07-23" })
    );
    expect(rpc).toHaveBeenCalledWith("agent_attach_unassigned", {
      p_user_id: "user-1",
      p_trip_id: TRIP,
      p_start: "2026-07-20",
      p_end: "2026-07-23",
    });
  });

  it("endDate 만 있으면 보내지 않는다 (시작 없이 끝만으로 창을 만들지 않음)", async () => {
    const { POST } = await import("./route");
    await POST(req({ tripId: TRIP, endDate: "2026-07-23" }));
    expect(rpc).toHaveBeenCalledWith("agent_attach_unassigned", {
      p_user_id: "user-1",
      p_trip_id: TRIP,
    });
  });

  it("붙은 이벤트가 있으면 재처리를 예약한다", async () => {
    rpc.mockResolvedValue({ data: 2, error: null });
    mockRequeueRows([{ id: "e1" }, { id: "e2" }]);
    const { POST } = await import("./route");
    const res = await POST(req({ tripId: TRIP }));
    const json = (await res.json()) as { attached: number; requeued: number };
    expect(json).toMatchObject({ ok: true, attached: 2, requeued: 2 });
    await vi.waitFor(() => expect(processEvent).toHaveBeenCalledTimes(2));
  });

  it("RPC 오류는 500 (내부 메시지 노출 없음)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    rpc.mockResolvedValue({ data: null, error: { message: "db boom" } });
    const { POST } = await import("./route");
    const res = await POST(req({ tripId: TRIP }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("db boom");
  });
});
