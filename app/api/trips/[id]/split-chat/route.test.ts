import { beforeEach, describe, expect, it, vi } from "vitest";

const TRIP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const THREAD = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EXP = "22222222-2222-4222-8222-222222222222";
const A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const USER = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const guardApi = vi.fn();
const ensureSplitThread = vi.fn();
const listSplitChatMessages = vi.fn();
const insertUserSplitMessage = vi.fn();
const insertAgentSplitMessage = vi.fn();
const interpretSplitPatch = vi.fn();
const loadSplitContext = vi.fn();
const resolveLatestExpenseId = vi.fn();
const findRequesterMember = vi.fn();

vi.mock("@/lib/security/guard", () => ({
  guardApi: (...a: unknown[]) => guardApi(...a),
}));
vi.mock("@/lib/agent/admin", () => ({
  getAgentAdmin: () => ({ from: () => ({}) }),
}));
vi.mock("@/lib/ai/gemini", () => ({
  geminiStructured: vi.fn(),
}));
vi.mock("@/lib/ledger/split-chat-server", () => ({
  ensureSplitThread: (...a: unknown[]) => ensureSplitThread(...a),
  listSplitChatMessages: (...a: unknown[]) => listSplitChatMessages(...a),
  insertUserSplitMessage: (...a: unknown[]) => insertUserSplitMessage(...a),
  insertAgentSplitMessage: (...a: unknown[]) => insertAgentSplitMessage(...a),
}));
vi.mock("@/lib/ledger/split-patch-server", () => ({
  interpretSplitPatch: (...a: unknown[]) => interpretSplitPatch(...a),
  loadSplitContext: (...a: unknown[]) => loadSplitContext(...a),
  resolveLatestExpenseId: (...a: unknown[]) => resolveLatestExpenseId(...a),
  findRequesterMember: (...a: unknown[]) => findRequesterMember(...a),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    from: () => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = async () => ({
        data: { id: "member-1" },
        error: null,
      });
      return chain;
    },
  }),
}));

function ctx() {
  return { params: Promise.resolve({ id: TRIP }) };
}

describe("GET/POST /api/trips/[id]/split-chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: USER },
      clientKey: "k",
    });
    ensureSplitThread.mockResolvedValue({ ok: true, threadId: THREAD });
    listSplitChatMessages.mockResolvedValue([]);
    insertUserSplitMessage.mockResolvedValue({
      id: "msg-user",
      threadId: THREAD,
      senderKind: "user",
      senderUserId: USER,
      senderName: "나",
      body: "민수 빼줘",
      payload: null,
      createdAt: "2026-11-20T00:00:00.000Z",
    });
    insertAgentSplitMessage.mockImplementation(
      async (_admin: unknown, args: { body: string; payload?: unknown }) => ({
        id: "msg-agent",
        threadId: THREAD,
        senderKind: "agent",
        senderUserId: null,
        senderName: "MetU AI",
        body: args.body,
        payload: args.payload ?? null,
        createdAt: "2026-11-20T00:00:01.000Z",
      })
    );
    findRequesterMember.mockReturnValue({
      id: A,
      displayName: "나",
      userId: USER,
      isOwner: true,
    });
    resolveLatestExpenseId.mockResolvedValue({ ok: true, expenseId: EXP });
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
          shares: { [A]: 10000, [B]: 10000 },
          items: [],
        },
        itemNames: [],
        members: [
          { id: A, displayName: "나", userId: USER, isOwner: true },
          { id: B, displayName: "민수", userId: "u2", isOwner: false },
        ],
      },
    });
    interpretSplitPatch.mockResolvedValue({
      ok: true,
      data: {
        expenseId: EXP,
        exclude: [B],
        only: [],
        weights: [],
        itemExclusions: [],
        clarification: null,
      },
    });
  });

  it("비로그인 GET 은 401", async () => {
    guardApi.mockResolvedValue({
      identity: { kind: "guest", nonce: "n" },
      clientKey: "k",
    });
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api"), ctx());
    expect(res.status).toBe(401);
  });

  it("GET 은 스레드와 메시지를 돌려요", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api"), ctx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.threadId).toBe(THREAD);
    expect(ensureSplitThread).toHaveBeenCalled();
  });

  it("POST 는 미리보기 agent 메시지를 만들어요", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        body: JSON.stringify({ text: "민수 빼줘" }),
      }),
      ctx()
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.agentMessage?.payload?.type).toBe("split_preview");
    expect(interpretSplitPatch).toHaveBeenCalled();
    expect(insertAgentSplitMessage).toHaveBeenCalled();
  });

  it("POST invalid body 는 400", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api", {
        method: "POST",
        body: JSON.stringify({ text: "" }),
      }),
      ctx()
    );
    expect(res.status).toBe(400);
  });
});
