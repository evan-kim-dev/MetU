import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TRIP = "33333333-3333-4333-8333-333333333333";
const E1 = "11111111-1111-4111-8111-111111111111";
const E2 = "22222222-2222-4222-8222-222222222222";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const guardApi = vi.fn();
const interpretBatchSplitPatch = vi.fn();
const loadBatchExpenses = vi.fn();

vi.mock("@/lib/security/guard", () => ({
  guardApi: (...a: unknown[]) => guardApi(...a),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({}),
}));
vi.mock("@/lib/ledger/split-patch-server", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/ledger/split-patch-server")
  >("@/lib/ledger/split-patch-server");
  return {
    ...actual,
    interpretBatchSplitPatch: (...a: unknown[]) =>
      interpretBatchSplitPatch(...a),
    loadBatchExpenses: (...a: unknown[]) => loadBatchExpenses(...a),
  };
});

function req(body: unknown) {
  return new Request("http://localhost/api/ledger/split-patch/batch", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const members = [
  { id: A, displayName: "민수", userId: "user-1", isOwner: true },
  { id: B, displayName: "나", userId: "user-2", isOwner: false },
  { id: C, displayName: "지아", userId: "user-3", isOwner: false },
];

const expenses = [
  {
    expenseId: E1,
    label: "저녁",
    spentOn: null,
    participantNames: ["민수", "나", "지아"],
    itemNames: ["맥주", "밥"],
    expense: {
      id: E1,
      krwAmount: 30000,
      shares: { [A]: 10000, [B]: 10000, [C]: 10000 },
      items: [{ amount: 9000 }, { amount: 21000 }],
    },
  },
  {
    expenseId: E2,
    label: "2차",
    spentOn: null,
    participantNames: ["민수", "나", "지아"],
    itemNames: ["맥주", "커피"],
    expense: {
      id: E2,
      krwAmount: 15000,
      shares: { [A]: 5000, [B]: 5000, [C]: 5000 },
      items: [{ amount: 9000 }, { amount: 6000 }],
    },
  },
];

describe("POST /api/ledger/split-patch/batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: "user-1", isAnonymous: false },
      clientKey: "k",
    });
    loadBatchExpenses.mockResolvedValue({ ok: true, expenses, members });
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns previews for two itemExclusions patches", async () => {
    interpretBatchSplitPatch.mockResolvedValue({
      ok: true,
      batch: {
        patches: [
          {
            expenseId: E1,
            exclude: [],
            only: [],
            weights: [],
            itemExclusions: [
              { memberId: A, itemIndex: 0 },
              { memberId: B, itemIndex: 0 },
            ],
            clarification: null,
          },
          {
            expenseId: E2,
            exclude: [],
            only: [],
            weights: [],
            itemExclusions: [
              { memberId: A, itemIndex: 0 },
              { memberId: B, itemIndex: 0 },
            ],
            clarification: null,
          },
        ],
        clarification: null,
      },
    });
    const { POST } = await import("./route");
    const res = await POST(req({ tripId: TRIP, text: "민수랑 나는 술 빼줘" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      items: Array<{ preview: { krwAmount: number; after: { krw: number }[] } }>;
    };
    expect(json.ok).toBe(true);
    expect(json.items).toHaveLength(2);
    for (const it of json.items) {
      const sum = it.preview.after.reduce((s, r) => s + r.krw, 0);
      expect(sum).toBe(it.preview.krwAmount);
    }
  });

  it("anonymous including others → 422 guest-self-only", async () => {
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: "user-2", isAnonymous: true },
      clientKey: "k",
    });
    interpretBatchSplitPatch.mockResolvedValue({
      ok: true,
      batch: {
        patches: [
          {
            expenseId: E1,
            exclude: [A],
            only: [],
            weights: [],
            itemExclusions: [],
            clarification: null,
          },
        ],
        clarification: null,
      },
    });
    const { POST } = await import("./route");
    const res = await POST(req({ tripId: TRIP, text: "민수 빼줘" }));
    expect(res.status).toBe(422);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("guest-self-only");
  });

  it("empty patches → needsClarification", async () => {
    interpretBatchSplitPatch.mockResolvedValue({
      ok: true,
      batch: { patches: [], clarification: "품목이 없어요." },
    });
    const { POST } = await import("./route");
    const res = await POST(req({ tripId: TRIP, text: "술 빼줘" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      needsClarification: boolean;
      clarification: string;
    };
    expect(json.needsClarification).toBe(true);
    expect(json.clarification).toContain("품목");
  });

  it("invalid body → 400", async () => {
    const { POST } = await import("./route");
    expect((await POST(req({ tripId: "nope", text: "x" }))).status).toBe(400);
    expect(interpretBatchSplitPatch).not.toHaveBeenCalled();
  });
});
