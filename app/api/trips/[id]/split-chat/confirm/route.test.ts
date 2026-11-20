import { beforeEach, describe, expect, it, vi } from "vitest";

import { sharesDigest } from "@/lib/ledger/split-patch";

const TRIP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const THREAD = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EXP = "22222222-2222-4222-8222-222222222222";
const KEY = "44444444-4444-4444-8444-444444444444";
const MSG = "11111111-1111-4111-8111-111111111111";
const A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const USER = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const CURRENT = { [A]: 10000, [B]: 10000 };

const guardApi = vi.fn();
const rpc = vi.fn();
const ensureSplitThread = vi.fn();
const getSplitMessageById = vi.fn();
const insertAgentSplitMessage = vi.fn();
const loadSplitContext = vi.fn();
const findRequesterMember = vi.fn();
const historySingle = vi.fn();

vi.mock("@/lib/security/guard", () => ({
  guardApi: (...a: unknown[]) => guardApi(...a),
}));
vi.mock("@/lib/agent/admin", () => ({
  getAgentAdmin: () => ({ rpc }),
}));
vi.mock("@/lib/ai/gemini", () => ({
  geminiStructured: vi.fn(),
}));
vi.mock("@/lib/ledger/split-chat-server", () => ({
  ensureSplitThread: (...a: unknown[]) => ensureSplitThread(...a),
  getSplitMessageById: (...a: unknown[]) => getSplitMessageById(...a),
  insertAgentSplitMessage: (...a: unknown[]) => insertAgentSplitMessage(...a),
}));
vi.mock("@/lib/ledger/split-patch-server", () => ({
  loadSplitContext: (...a: unknown[]) => loadSplitContext(...a),
  findRequesterMember: (...a: unknown[]) => findRequesterMember(...a),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = async () => {
        if (table === "trip_members") {
          return { data: { id: "member-1" }, error: null };
        }
        if (table === "trip_expense_split_history") {
          return historySingle();
        }
        return { data: null, error: null };
      };
      return chain;
    },
  }),
}));

function previewMsg() {
  return {
    id: MSG,
    threadId: THREAD,
    senderKind: "agent" as const,
    senderUserId: null,
    senderName: "MetU AI",
    body: "이렇게 맞을까요?",
    payload: {
      type: "split_preview" as const,
      patch: {
        expenseId: EXP,
        exclude: [B],
        only: [],
        weights: [],
        itemExclusions: [],
        clarification: null,
      },
      beforeDigest: sharesDigest(CURRENT),
      summary: "민수 제외",
      idempotencyKey: KEY,
      expenseId: EXP,
      label: "저녁",
      before: [
        { memberId: A, name: "나", krw: 10000 },
        { memberId: B, name: "민수", krw: 10000 },
      ],
      after: [
        { memberId: A, name: "나", krw: 20000 },
        { memberId: B, name: "민수", krw: 0 },
      ],
      canGuestConfirm: false,
    },
    createdAt: "2026-11-20T00:00:00.000Z",
  };
}

function ctx() {
  return { params: Promise.resolve({ id: TRIP }) };
}

describe("POST /api/trips/[id]/split-chat/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: USER },
      clientKey: "k",
    });
    ensureSplitThread.mockResolvedValue({ ok: true, threadId: THREAD });
    getSplitMessageById.mockResolvedValue(previewMsg());
    historySingle.mockResolvedValue({ data: null, error: null });
    findRequesterMember.mockReturnValue({
      id: A,
      displayName: "나",
      userId: USER,
      isOwner: true,
    });
    loadSplitContext.mockResolvedValue({
      ok: true,
      ctx: {
        tripId: TRIP,
        label: "저녁",
        status: "confirmed",
        splitType: "equal",
        expense: {
          id: EXP,
          krwAmount: 20000,
          shares: CURRENT,
          items: [],
        },
        itemNames: [],
        members: [
          { id: A, displayName: "나", userId: USER, isOwner: true },
          { id: B, displayName: "민수", userId: "u2", isOwner: false },
        ],
      },
    });
    rpc.mockResolvedValue({
      data: { ok: true, already: false, historyId: "h-1" },
      error: null,
    });
    insertAgentSplitMessage.mockResolvedValue({
      id: "sys-1",
      threadId: THREAD,
      senderKind: "system",
      senderUserId: null,
      senderName: "시스템",
      body: "반영했어요",
      payload: null,
      createdAt: "2026-11-20T00:00:02.000Z",
    });
  });

  it("비로그인 401", async () => {
    guardApi.mockResolvedValue({
      identity: { kind: "guest", nonce: "n" },
      clientKey: "k",
    });
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        body: JSON.stringify({
          messageId: MSG,
          beforeDigest: sharesDigest(CURRENT),
          idempotencyKey: KEY,
        }),
      }),
      ctx()
    );
    expect(res.status).toBe(401);
  });

  it("확인 시 RPC apply 후 system 메시지", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        body: JSON.stringify({
          messageId: MSG,
          beforeDigest: sharesDigest(CURRENT),
          idempotencyKey: KEY,
        }),
      }),
      ctx()
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith(
      "agent_apply_split_patch",
      expect.objectContaining({
        p_actor: USER,
        p_expense_id: EXP,
        p_idempotency_key: KEY,
      })
    );
    expect(insertAgentSplitMessage).toHaveBeenCalled();
  });

  it("같은 키면 already", async () => {
    historySingle.mockResolvedValue({
      data: { id: "h-prior" },
      error: null,
    });
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        body: JSON.stringify({
          messageId: MSG,
          beforeDigest: sharesDigest(CURRENT),
          idempotencyKey: KEY,
        }),
      }),
      ctx()
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.already).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("게스트가 타인 exclude 하면 422", async () => {
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: USER, isAnonymous: true },
      clientKey: "k",
    });
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        body: JSON.stringify({
          messageId: MSG,
          beforeDigest: sharesDigest(CURRENT),
          idempotencyKey: KEY,
        }),
      }),
      ctx()
    );
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe("guest-self-only");
  });
});
