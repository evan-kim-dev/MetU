import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { pickMock } = vi.hoisted(() => ({ pickMock: vi.fn() }));

import { SYNTHETIC_SMS } from "@/lib/ledger/sms/__fixtures__/sms";

// processEvent 의 loadCtx 경로(컬럼명, owner 멤버 보장, 매칭 규칙 → 자동 저장 게이트)를
// 합성 데이터와 인메모리 fake 로 검증한다.

type Row = Record<string, unknown>;
type Result = { data: unknown; count?: number | null; error: null };

const OWNER = "11111111-1111-4111-8111-111111111111";
const STRANGER = "99999999-9999-4999-8999-999999999999";
const TRIP = "22222222-2222-4222-8222-222222222222";
const EVENT = "33333333-3333-4333-8333-333333333333";
const MEMBER_ID = "44444444-4444-4444-8444-444444444444";

const state = {
  tripOwner: OWNER,
  eventUser: OWNER,
  members: [] as Row[],
  eventResult: null as Row | null,
  ensureResult: { ok: true } as { ok: boolean },
  eventTripId: null as string | null,
};

const tripSelects: string[] = [];
const rpcCalls: Array<{ name: string; args: Row }> = [];
const eventUpdates: Row[] = [];

function makeChain(table: string): Record<string, unknown> {
  const result = (): Result => {
    switch (table) {
      case "trips":
        return {
          data: {
            id: TRIP,
            user_id: state.tripOwner,
            start_date: "2026-03-01",
            end_date: "2026-03-05",
            local_currency: null,
          },
          error: null,
        };
      case "trip_members":
        return { data: state.members, error: null };
      case "trip_expenses":
        return { data: [], count: 0, error: null };
      default:
        return { data: null, error: null };
    }
  };
  const chain: Record<string, unknown> = {
    select: (cols?: unknown) => {
      if (table === "trips" && typeof cols === "string") tripSelects.push(cols);
      return chain;
    },
    eq: () => chain,
    neq: () => chain,
    order: () => chain,
    limit: () => chain,
    gte: () => chain,
    update: (values: Row) => {
      if (table === "agent_events") eventUpdates.push(values);
      return chain;
    },
    insert: () => Promise.resolve({ error: null }),
    maybeSingle: () => Promise.resolve(result()),
    then: (
      resolve: (r: Result) => unknown,
      reject?: (e: unknown) => unknown
    ) => Promise.resolve(result()).then(resolve, reject),
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
            user_id: state.eventUser,
            trip_id: state.eventTripId,
            kind: "text",
            source: "sms_shortcut",
            payload: {
              text: SYNTHETIC_SMS.lotteDomestic.text,
              received_at: "2026-03-01T12:31:00+09:00",
            },
            status: "processing",
            created_at: "2026-03-01T03:31:00.000Z",
            result: state.eventResult,
          },
        ],
        error: null,
      };
    }
    if (name === "agent_ensure_owner_member") {
      if (state.ensureResult.ok) {
        // 서버가 owner 멤버 행을 만든 것처럼 보이게 한다.
        state.members = [
          {
            id: MEMBER_ID,
            user_id: args.p_actor,
            display_name: "나",
            auto_include: true,
          },
        ];
        return { data: MEMBER_ID, error: null };
      }
      return { data: null, error: { message: "forbidden" } };
    }
    if (name === "agent_save_expense") return { data: "exp-new", error: null };
    return { data: null, error: null };
  },
};

vi.mock("@/lib/agent/admin", () => ({ getAgentAdmin: () => admin }));
vi.mock("@/lib/ledger/fx-server", () => ({
  getDailyFxQuote: async () => ({ rate: 1, rateDate: "2026-03-01", isFallback: false }),
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
vi.mock("@/lib/agent/receipt-vision", () => ({
  extractReceiptFromImage: async () => ({ ok: false, error: "no_api_key" }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => {
    throw new Error("not used in this test");
  },
}));
vi.mock("@/lib/onboarding/agent-context", () => ({
  pickTripForReceivedAt: pickMock,
}));

function calls(name: string) {
  return rpcCalls.filter((c) => c.name === name);
}
function lastEventUpdate(): Row {
  return eventUpdates[eventUpdates.length - 1]!;
}

beforeEach(() => {
  state.tripOwner = OWNER;
  state.eventUser = OWNER;
  state.members = [];
  state.eventResult = null;
  state.ensureResult = { ok: true };
  state.eventTripId = TRIP;
  pickMock.mockReset();
  tripSelects.length = 0;
  rpcCalls.length = 0;
  eventUpdates.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("processEvent — loadCtx", () => {
  it("trips 에서 존재하지 않는 currency 가 아니라 local_currency 를 select 한다", async () => {
    const { processEvent } = await import("@/lib/agent/run");
    await processEvent(EVENT);

    expect(tripSelects.length).toBeGreaterThan(0);
    for (const sel of tripSelects) {
      const cols = sel.split(",").map((c) => c.trim());
      expect(cols).toContain("local_currency");
      expect(cols).not.toContain("currency");
    }
  });

  it("본인 trip_members 행이 없고 소유자이면 서버가 만든 뒤(ensureOwnerMemberAdmin) 계속 처리한다", async () => {
    const { processEvent } = await import("@/lib/agent/run");
    await processEvent(EVENT);

    const ensure = calls("agent_ensure_owner_member");
    expect(ensure).toHaveLength(1);
    expect(ensure[0]!.args).toEqual({ p_actor: OWNER, p_trip_id: TRIP });

    const upd = lastEventUpdate();
    expect(upd.status).not.toBe("failed");
    expect(upd.error).toBeNull();
    // 매칭 규칙이 없는(명시 배정) 이벤트는 기존처럼 자동 저장된다.
    expect(calls("agent_save_expense")).toHaveLength(1);
    expect(calls("agent_save_expense")[0]!.args.p_status).toBe("auto");
  });

  it("이미 멤버 행이 있으면 RPC 를 부르지 않는다", async () => {
    state.members = [
      { id: MEMBER_ID, user_id: OWNER, display_name: "나", auto_include: true },
    ];
    const { processEvent } = await import("@/lib/agent/run");
    await processEvent(EVENT);

    expect(calls("agent_ensure_owner_member")).toHaveLength(0);
    expect(lastEventUpdate().status).not.toBe("failed");
  });

  it("소유자도 멤버도 아니면 failed / no-owner-member (멤버를 만들지 않는다)", async () => {
    state.tripOwner = OWNER;
    state.eventUser = STRANGER;
    state.members = [];
    const { processEvent } = await import("@/lib/agent/run");
    await processEvent(EVENT);

    expect(calls("agent_ensure_owner_member")).toHaveLength(0);
    const upd = lastEventUpdate();
    expect(upd.status).toBe("failed");
    expect(upd.error).toBe("no-owner-member");
    expect(calls("agent_save_expense")).toHaveLength(0);
  });

  it("owner 멤버 보장이 실패하면 failed / no-owner-member", async () => {
    state.ensureResult = { ok: false };
    const { processEvent } = await import("@/lib/agent/run");
    await processEvent(EVENT);

    expect(calls("agent_ensure_owner_member")).toHaveLength(1);
    expect(lastEventUpdate().status).toBe("failed");
    expect(lastEventUpdate().error).toBe("no-owner-member");
  });
});

describe("processEvent — 여행 매칭 규칙 게이트", () => {
  beforeEach(() => {
    state.members = [
      { id: MEMBER_ID, user_id: OWNER, display_name: "나", auto_include: true },
    ];
  });

  it("match.rule=exact → 자동 저장 (done)", async () => {
    state.eventResult = { match: { rule: "exact" } };
    const { processEvent } = await import("@/lib/agent/run");
    await processEvent(EVENT);

    expect(calls("agent_save_expense")).toHaveLength(1);
    const upd = lastEventUpdate();
    expect(upd.status).toBe("done");
    expect((upd.result as Row).match).toEqual({ rule: "exact" });
  });

  it.each(["near", "single"] as const)(
    "match.rule=%s → 자동 저장 없이 needs_review (trip_match_uncertain), match 는 결과에 보존",
    async (rule) => {
      state.eventResult = { match: { rule } };
      const { processEvent } = await import("@/lib/agent/run");
      await processEvent(EVENT);

      expect(calls("agent_save_expense")).toHaveLength(0);
      const upd = lastEventUpdate();
      expect(upd.status).toBe("needs_review");
      const result = upd.result as { items: Row[]; match: Row };
      expect(result.match).toEqual({ rule });
      expect(result.items[0]!.decision).toBe("review");
      expect(result.items[0]!.reasonCode).toBe("trip_match_uncertain");
    }
  );
});

describe("processEvent — 재매칭 (trip_id 없는 이벤트)", () => {
  beforeEach(() => {
    state.eventTripId = null;
    state.members = [
      { id: MEMBER_ID, user_id: OWNER, display_name: "나", auto_include: true },
    ];
  });

  it("매칭 실패 시 unassigned + 구체 사유/제안을 result 에 저장", async () => {
    pickMock.mockResolvedValue({
      tripId: null,
      rule: "none",
      reason: "outside_window",
      suggest: {
        tripId: TRIP,
        rule: "outside_window",
        destination: "도쿄",
        startDate: "2026-09-01",
        endDate: "2026-09-04",
        diffDays: 40,
      },
    });
    const { processEvent } = await import("@/lib/agent/run");
    await processEvent(EVENT);

    const upd = lastEventUpdate();
    expect(upd.status).toBe("unassigned");
    const result = upd.result as Row;
    expect(result.reason).toBe("outside_window");
    expect(result.match).toEqual({ rule: "none" });
    expect(result.suggest).toMatchObject({ tripId: TRIP, diffDays: 40 });
    expect(calls("agent_save_expense")).toHaveLength(0);
  });

  it.each([["no_trips"], ["no_dates"]] as const)(
    "사유 %s 를 그대로 저장",
    async (reason) => {
      pickMock.mockResolvedValue({ tripId: null, rule: "none", reason });
      const { processEvent } = await import("@/lib/agent/run");
      await processEvent(EVENT);
      expect((lastEventUpdate().result as Row).reason).toBe(reason);
    }
  );

  it("rule=single 로 찾으면 match.rule 을 저장하고 자동 저장은 하지 않는다", async () => {
    pickMock.mockResolvedValue({ tripId: TRIP, rule: "single" });
    const { processEvent } = await import("@/lib/agent/run");
    await processEvent(EVENT);

    const attach = eventUpdates.find((u) => u.trip_id === TRIP)!;
    expect(attach.status).toBe("processing");
    expect(attach.result).toEqual({ match: { rule: "single" } });
    expect(calls("agent_save_expense")).toHaveLength(0);
  });
});