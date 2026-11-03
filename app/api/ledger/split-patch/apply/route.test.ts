import { beforeEach, describe, expect, it, vi } from "vitest";

import { sharesDigest } from "@/lib/ledger/split-patch";

const EXP = "22222222-2222-4222-8222-222222222222";
const KEY = "44444444-4444-4444-8444-444444444444";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const guardApi = vi.fn();
const rpc = vi.fn();
const tables: Record<string, { single?: unknown; list?: unknown }> = {};

vi.mock("@/lib/security/guard", () => ({
  guardApi: (...a: unknown[]) => guardApi(...a),
  rejectAnonymousWrite: (identity: { kind?: string; isAnonymous?: boolean }) =>
    identity.kind === "user" && identity.isAnonymous === true
      ? Response.json({ error: "guest-readonly" }, { status: 403 })
      : null,
}));
vi.mock("@/lib/agent/admin", () => ({
  getAgentAdmin: () => ({ rpc }),
}));
vi.mock("@/lib/ai/gemini", () => ({
  geminiStructured: vi.fn(),
  geminiText: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    from: (table: string) => {
      const t = tables[table] ?? {};
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = async () => ({ data: t.single ?? null, error: null });
      chain.then = (resolve: (v: unknown) => unknown) =>
        resolve({ data: t.list ?? [], error: null });
      return chain;
    },
  }),
}));

const CURRENT = { [A]: 10000, [B]: 10000, [C]: 10000 };

function patchOf(over: Record<string, unknown> = {}) {
  return {
    expenseId: EXP,
    exclude: [C],
    only: [],
    weights: [],
    itemExclusions: [],
    clarification: null,
    ...over,
  };
}

function body(over: Record<string, unknown> = {}) {
  return {
    patch: patchOf(),
    beforeDigest: sharesDigest(CURRENT),
    idempotencyKey: KEY,
    ...over,
  };
}

function req(b: unknown) {
  return new Request("http://localhost/api/ledger/split-patch/apply", {
    method: "POST",
    body: JSON.stringify(b),
  });
}

describe("POST /api/ledger/split-patch/apply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: "user-1" },
      clientKey: "k",
    });
    rpc.mockResolvedValue({
      data: { ok: true, already: false, historyId: "h-1" },
      error: null,
    });
    tables.trip_expenses = {
      single: {
        id: EXP,
        trip_id: "trip-1",
        krw_amount: 30000,
        status: "confirmed",
        split_type: "equal",
        label: "저녁",
        merchant: "이자카야",
        items: [],
      },
    };
    tables.trip_expense_shares = {
      list: [
        { member_id: A, share_krw: 10000 },
        { member_id: B, share_krw: 10000 },
        { member_id: C, share_krw: 10000 },
      ],
    };
    tables.trip_members = {
      list: [
        { id: A, display_name: "민수" },
        { id: B, display_name: "지영" },
        { id: C, display_name: "철수" },
      ],
    };
    tables.trip_expense_split_history = {};
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  it("게스트는 401, RPC 는 부르지 않는다", async () => {
    guardApi.mockResolvedValue({
      identity: { kind: "guest", nonce: "n" },
      clientKey: "k",
    });
    const { POST } = await import("./route");
    expect((await POST(req(body()))).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("검증 실패는 400: 클라이언트 분담액/금액 키, 잘못된 patch, uuid 아닌 키", async () => {
    const { POST } = await import("./route");
    for (const bad of [
      body({ shares: { [A]: 1, [B]: 29999 } }),
      body({ krwAmount: 100 }),
      body({ patch: { ...patchOf(), krw: 100 } }),
      body({ patch: { ...patchOf(), amount: 100 } }),
      body({ patch: patchOf({ only: [A] }) }),
      body({ idempotencyKey: "same" }),
      { patch: patchOf() },
    ]) {
      expect((await POST(req(bad))).status).toBe(400);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("서버가 계산한 분담만 RPC 로 넘긴다 (클라이언트 값 없음)", async () => {
    const { POST } = await import("./route");
    const res = await POST(req(body()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      already: false,
      historyId: "h-1",
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("agent_apply_split_patch", {
      p_actor: "user-1",
      p_expense_id: EXP,
      p_expected_before: CURRENT,
      p_split_type: "equal",
      p_shares: { [A]: 15000, [B]: 15000 },
      p_input_values: {},
      p_patch_kind: "exclude",
      p_idempotency_key: KEY,
    });
  });

  it("미리보기 이후 분담이 바뀌었으면(digest 불일치) 409, RPC 없음", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      req(body({ beforeDigest: sharesDigest({ [A]: 1, [B]: 29999 }) }))
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("conflict");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("같은 idempotencyKey 를 다시 보내면 RPC 없이 already 성공", async () => {
    tables.trip_expense_split_history = { single: { id: "h-1" } };
    const { POST } = await import("./route");
    const res = await POST(req(body({ beforeDigest: "stale" })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      already: true,
      historyId: "h-1",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("RPC 가 conflict 를 돌려주면 409", async () => {
    rpc.mockResolvedValue({ data: { ok: false, reason: "conflict" }, error: null });
    const { POST } = await import("./route");
    expect((await POST(req(body()))).status).toBe(409);
  });

  it("RPC 오류: forbidden 403 / voided 409 / 그 밖은 500 (내부 메시지 노출 없음)", async () => {
    const { POST } = await import("./route");
    rpc.mockResolvedValue({ data: null, error: { message: "forbidden" } });
    expect((await POST(req(body()))).status).toBe(403);
    rpc.mockResolvedValue({ data: null, error: { message: "voided" } });
    expect((await POST(req(body()))).status).toBe(409);
    rpc.mockResolvedValue({ data: null, error: { message: "db boom" } });
    const res = await POST(req(body()));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("db boom");
  });

  it("볼 수 없는 지출은 403 / 멤버가 아닌 id 는 422", async () => {
    const { POST } = await import("./route");
    expect(
      (await POST(req(body({ patch: patchOf({ exclude: ["ghost"] }) })))).status
    ).toBe(422);
    tables.trip_expenses = {};
    expect((await POST(req(body()))).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("취소된 지출은 409", async () => {
    tables.trip_expenses!.single = {
      ...(tables.trip_expenses!.single as object),
      status: "voided",
    };
    const { POST } = await import("./route");
    expect((await POST(req(body()))).status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("weights 는 비율 입력값과 ratio 로 넘긴다", async () => {
    const { POST } = await import("./route");
    await POST(
      req(
        body({
          patch: patchOf({
            exclude: [],
            weights: [{ memberId: A, weight: 2 }],
          }),
        })
      )
    );
    expect(rpc).toHaveBeenCalledWith(
      "agent_apply_split_patch",
      expect.objectContaining({
        p_split_type: "ratio",
        p_shares: { [A]: 15000, [B]: 7500, [C]: 7500 },
        p_input_values: { [A]: 2, [B]: 1, [C]: 1 },
        p_patch_kind: "weights",
      })
    );
  });
});
