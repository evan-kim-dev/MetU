import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReceiptVisionResult } from "@/lib/agent/receipt-vision";

// --- fakes ---------------------------------------------------------------

type Row = Record<string, unknown>;
type Result = { data: unknown; count?: number | null; error: null };

type Chain = {
  select: (...a: unknown[]) => Chain;
  eq: (...a: unknown[]) => Chain;
  neq: (...a: unknown[]) => Chain;
  order: (...a: unknown[]) => Chain;
  limit: (...a: unknown[]) => Chain;
  gte: (...a: unknown[]) => Chain;
  update: (values: Row) => Chain;
  insert: (values: Row) => Promise<{ error: null }>;
  maybeSingle: () => Promise<Result>;
  then: (
    resolve: (r: Result) => unknown,
    reject?: (e: unknown) => unknown
  ) => Promise<unknown>;
};

const USER = "11111111-1111-4111-8111-111111111111";
const TRIP = "22222222-2222-4222-8222-222222222222";
const EVENT = "33333333-3333-4333-8333-333333333333";
const PATH = `${USER}/${TRIP}/receipt-1.jpg`;

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);

const rpcCalls: Array<{ name: string; args: Row }> = [];
const eventUpdates: Row[] = [];
let expenseRows: Row[] = [];

const extractReceiptFromImage = vi.fn<() => Promise<ReceiptVisionResult>>();

function makeChain(table: string): Chain {
  const result = (): Result => {
    switch (table) {
      case "trips":
        return {
          data: {
            id: TRIP,
            user_id: USER,
            start_date: "2026-10-28",
            end_date: "2026-11-02",
            currency: "JPY",
          },
          error: null,
        };
      case "trip_members":
        return {
          data: [
            { id: "m1", user_id: USER, display_name: "나", auto_include: true },
          ],
          error: null,
        };
      case "trip_expenses":
        return { data: expenseRows, count: 0, error: null };
      default:
        return { data: null, error: null };
    }
  };
  const chain: Chain = {
    select: () => chain,
    eq: () => chain,
    neq: () => chain,
    order: () => chain,
    limit: () => chain,
    gte: () => chain,
    update: (values) => {
      if (table === "agent_events") eventUpdates.push(values);
      return chain;
    },
    insert: () => Promise.resolve({ error: null }),
    maybeSingle: () => Promise.resolve(result()),
    then: (resolve, reject) => Promise.resolve(result()).then(resolve, reject),
  };
  return chain;
}

const admin = {
  from: (table: string) => makeChain(table),
  rpc: async (name: string, args: Row) => {
    rpcCalls.push({ name, args });
    if (name === "agent_claim_event") {
      return {
        data: [
          {
            id: EVENT,
            user_id: USER,
            trip_id: TRIP,
            kind: "image",
            source: "upload",
            payload: { path: PATH, mime: "image/jpeg" },
            status: "processing",
            created_at: "2026-10-30T05:10:00.000Z",
          },
        ],
        error: null,
      };
    }
    if (name === "agent_save_expense") return { data: "exp-new", error: null };
    if (name === "agent_attach_receipt") {
      return { data: { ok: true, attached: true }, error: null };
    }
    return { data: null, error: null };
  },
  storage: {
    from: () => ({
      download: async () => ({ data: new Blob([JPEG]), error: null }),
    }),
  },
};

vi.mock("@/lib/agent/admin", () => ({ getAgentAdmin: () => admin }));
vi.mock("@/lib/agent/receipt-vision", () => ({
  extractReceiptFromImage: () => extractReceiptFromImage(),
}));
vi.mock("@/lib/ledger/fx-server", () => ({
  getDailyFxQuote: async () => ({
    rate: 9.3,
    rateDate: "2026-10-30",
    isFallback: false,
  }),
}));
vi.mock("@/lib/agent/ingest", () => ({
  createEvent: async () => ({ ok: true, id: "domain-1", duplicate: false }),
}));
vi.mock("@/lib/agent/notify", () => ({ notifyUsers: async () => undefined }));
vi.mock("@/lib/agent/domain-followup", () => ({
  pushFollowUpEventId: () => undefined,
  runDomainFollowUps: async () => undefined,
}));
vi.mock("@/lib/agent/handlers/settlement", () => ({
  onExpenseChanged: async () => ({}),
}));
vi.mock("@/lib/onboarding/agent-context", () => ({
  pickTripForReceivedAt: async () => null,
}));

// --- helpers -------------------------------------------------------------

function visionOk(over: Partial<{ paymentMethod: "card" | null }> = {}) {
  const draft = {
    source: "receipt" as const,
    isReceipt: true,
    items: [
      { name: "おにぎり", nameKo: "주먹밥", qty: 2, unitPrice: 600, amount: 1200 },
    ],
    merchant: "ローソン",
    merchantKo: "로손",
    amount: 1200,
    currency: "JPY",
    paidAt: "2026-10-30T14:05:00+09:00",
    spentOn: "2026-10-30",
    timeIsEstimated: false,
    category: "식비" as const,
    paymentMethod: over.paymentMethod ?? null,
    confidence: 0.95,
    warnings: [] as string[],
  };
  const result: ReceiptVisionResult = {
    ok: true,
    draft,
    extract: {
      isReceipt: true,
      merchant: draft.merchant,
      merchantKo: draft.merchantKo,
      paidAt: "2026-10-30T14:05",
      currency: "JPY",
      total: 1200,
      subtotal: null,
      tax: null,
      tip: null,
      items: draft.items,
      category: "식비",
      paymentMethod: null,
      language: "ja",
      confidence: 0.95,
      warnings: [],
    },
  };
  return result;
}

const CARD_EXPENSE: Row = {
  id: "card-exp-1",
  currency: "JPY",
  amount: 1200,
  merchant: "LAWSON ENT",
  spent_on: "2026-10-30",
  krw_amount: 11160,
  paid_at: "2026-10-30T05:05:00.000Z",
  status: "auto",
  source: "sms",
  receipt_path: null,
  source_event_id: "other-event",
};

function lastEventUpdate(): Row {
  return eventUpdates[eventUpdates.length - 1]!;
}

function calls(name: string) {
  return rpcCalls.filter((c) => c.name === name);
}

beforeEach(() => {
  rpcCalls.length = 0;
  eventUpdates.length = 0;
  expenseRows = [];
  extractReceiptFromImage.mockReset();
  delete process.env.AGENT_AUTO_RECEIPT;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.AGENT_AUTO_RECEIPT;
});

// --- tests ---------------------------------------------------------------

describe("processEvent — image (receipt)", () => {
  it("vision 성공 + AGENT_AUTO_RECEIPT 미설정 → origin receipt 로 decide, review, 지출 미생성", async () => {
    extractReceiptFromImage.mockResolvedValue(visionOk());
    const { processEvent } = await import("@/lib/agent/run");
    await processEvent(EVENT);

    expect(calls("agent_save_expense")).toHaveLength(0);
    expect(calls("agent_attach_receipt")).toHaveLength(0);
    const upd = lastEventUpdate();
    expect(upd.status).toBe("needs_review");
    const items = (upd.result as { items: Row[] }).items;
    expect(items[0]!.decision).toBe("review");
    expect((items[0]!.draft as Row).origin).toBe("receipt");
    expect((items[0]!.draft as Row).source).toBe("receipt");
    expect(items[0]!.reasons).toEqual(["영수증은 기본으로 확인이 필요해요"]);
  });

  it("AGENT_AUTO_RECEIPT=1 → source receipt 로 저장하고 receipt_path 를 붙이며 카드로 고정하지 않는다", async () => {
    process.env.AGENT_AUTO_RECEIPT = "1";
    extractReceiptFromImage.mockResolvedValue(visionOk());
    const { processEvent } = await import("@/lib/agent/run");
    await processEvent(EVENT);

    const saves = calls("agent_save_expense");
    expect(saves).toHaveLength(1);
    const expense = saves[0]!.args.p_expense as Row;
    expect(expense.source).toBe("receipt");
    expect(expense.payment_method).toBeUndefined();
    expect(expense.merchant_ko).toBe("로손");
    expect(expense.items).toHaveLength(1);
    expect(saves[0]!.args.p_status).toBe("auto");

    const attach = calls("agent_attach_receipt");
    expect(attach).toHaveLength(1);
    expect(attach[0]!.args.p_receipt_path).toBe(PATH);
    expect(attach[0]!.args.p_expense_id).toBe("exp-new");
    expect(attach[0]!.args.p_clear_payment_method).toBe(true);
    expect(lastEventUpdate().status).toBe("done");
  });

  it("같은 결제의 카드 알림 지출이 있으면 새 지출 없이 영수증만 붙인다 (상호 달라도)", async () => {
    // 자동 저장이 켜져 있어도 중복이면 새 지출을 만들지 않는다.
    process.env.AGENT_AUTO_RECEIPT = "1";
    expenseRows = [CARD_EXPENSE];
    extractReceiptFromImage.mockResolvedValue(visionOk());
    const { processEvent } = await import("@/lib/agent/run");
    await processEvent(EVENT);

    expect(calls("agent_save_expense")).toHaveLength(0);
    const attach = calls("agent_attach_receipt");
    expect(attach).toHaveLength(1);
    expect(attach[0]!.args.p_expense_id).toBe("card-exp-1");
    expect(attach[0]!.args.p_receipt_path).toBe(PATH);

    const upd = lastEventUpdate();
    expect(upd.status).toBe("done");
    const items = (upd.result as { items: Row[] }).items;
    expect(items[0]!.decision).toBe("merged");
    expect(items[0]!.expenseId).toBe("card-exp-1");
  });

  it("중복이고 자동 저장 미설정이어도 새 지출을 만들지 않는다", async () => {
    expenseRows = [CARD_EXPENSE];
    extractReceiptFromImage.mockResolvedValue(visionOk());
    const { processEvent } = await import("@/lib/agent/run");
    await processEvent(EVENT);
    expect(calls("agent_save_expense")).toHaveLength(0);
  });

  it("기존 지출에 이미 영수증이 있으면 합치지 않고 needs_review (mergeInto 기록)", async () => {
    expenseRows = [{ ...CARD_EXPENSE, receipt_path: "other/path.jpg" }];
    extractReceiptFromImage.mockResolvedValue(visionOk());
    const { processEvent } = await import("@/lib/agent/run");
    await processEvent(EVENT);

    expect(calls("agent_save_expense")).toHaveLength(0);
    expect(calls("agent_attach_receipt")).toHaveLength(0);
    const upd = lastEventUpdate();
    expect(upd.status).toBe("needs_review");
    const item = (upd.result as { items: Row[] }).items[0]!;
    expect(item.decision).toBe("review");
    expect(item.mergeInto).toBe("card-exp-1");
    expect(item.reasons).toEqual(["이미 같은 결제가 있어요 — 합치기/별개로 저장"]);
  });

  it("같은 금액이어도 2시간 떨어진 지출이면 합치지 않는다 (두 번째 커피)", async () => {
    expenseRows = [
      { ...CARD_EXPENSE, paid_at: "2026-10-30T03:05:00.000Z" },
    ];
    extractReceiptFromImage.mockResolvedValue(visionOk());
    const { processEvent } = await import("@/lib/agent/run");
    await processEvent(EVENT);
    expect(calls("agent_attach_receipt")).toHaveLength(0);
    const item = (lastEventUpdate().result as { items: Row[] }).items[0]!;
    expect(item.mergeInto).toBeUndefined();
  });

  it("vision 실패(키 없음) → needs_review '영수증을 읽지 못했어요', 앱은 깨지지 않는다", async () => {
    extractReceiptFromImage.mockResolvedValue({
      ok: false,
      error: "no_api_key",
    });
    const { processEvent } = await import("@/lib/agent/run");
    await processEvent(EVENT);

    expect(calls("agent_save_expense")).toHaveLength(0);
    const upd = lastEventUpdate();
    expect(upd.status).toBe("needs_review");
    expect((upd.result as Row).message).toBe("영수증을 읽지 못했어요");
  });

  it("영수증이 아니면 ignored", async () => {
    extractReceiptFromImage.mockResolvedValue({
      ok: false,
      error: "not_receipt",
    });
    const { processEvent } = await import("@/lib/agent/run");
    await processEvent(EVENT);
    expect(lastEventUpdate().status).toBe("ignored");
    expect(calls("agent_save_expense")).toHaveLength(0);
  });

  it("저장 이벤트 payload 의 경로가 내 폴더가 아니면 읽지 않는다", async () => {
    const original = admin.rpc;
    admin.rpc = async (name: string, args: Row) => {
      if (name === "agent_claim_event") {
        return {
          data: [
            {
              id: EVENT,
              user_id: USER,
              trip_id: TRIP,
              kind: "image",
              source: "upload",
              payload: { path: "someone-else/x/y.jpg", mime: "image/jpeg" },
              status: "processing",
              created_at: "2026-10-30T05:10:00.000Z",
            },
          ],
          error: null,
        };
      }
      return original(name, args);
    };
    try {
      const { processEvent } = await import("@/lib/agent/run");
      await processEvent(EVENT);
    } finally {
      admin.rpc = original;
    }
    expect(extractReceiptFromImage).not.toHaveBeenCalled();
    expect(lastEventUpdate().status).toBe("needs_review");
  });
});
