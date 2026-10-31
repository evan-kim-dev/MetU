import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  columnsFromMigrations,
  loadMigrationSql,
  parseSelectColumns,
} from "@/lib/db/migration-columns";
import {
  agentEventReasonLine,
  AGENT_REASON_MESSAGES,
} from "@/lib/agent/event-status";
import { SYNTHETIC_SMS } from "@/lib/ledger/sms/__fixtures__/sms";

// 인제스트 → 여행 매칭 → 처리(processEvent) → 수신함 재부착까지를
// 인메모리 fake supabase(admin)로 한 번에 검증한다. 외부 호출(Gemini/환율/푸시)은 모킹.
// 합성 데이터만 사용한다 (실제 이름/카드번호/토큰/이메일 없음).

type Row = Record<string, unknown>;
type QueryResult = {
  data: unknown;
  error: { message: string; code?: string } | null;
  count?: number | null;
};

const OWNER = "11111111-1111-4111-8111-111111111111";
const TRIP_A = "22222222-2222-4222-8222-222222222222";
const TRIP_B = "55555555-5555-4555-8555-555555555555";

// ---------------------------------------------------------------------------
// 마이그레이션에서 뽑은 trips 컬럼 allowlist — fake 가 PostgREST 처럼 없는 컬럼 select 를 거절한다.
// ---------------------------------------------------------------------------
const TRIPS_ALLOWLIST = columnsFromMigrations(
  loadMigrationSql(join(process.cwd(), "supabase", "migrations")),
  "trips"
);

// ---------------------------------------------------------------------------
// 인메모리 DB
// ---------------------------------------------------------------------------
class FakeDb {
  tables: Record<string, Row[]> = {
    trips: [],
    trip_members: [],
    trip_expenses: [],
    agent_events: [],
    agent_steps: [],
    agent_user_state: [],
  };
  tripSelects: string[] = [];
  schemaErrors: string[] = [];
  rpcCalls: Array<{ name: string; args: Row }> = [];
  private seq = 0;

  nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}-0000-4000-8000-${String(this.seq).padStart(12, "0")}`;
  }

  from(table: string) {
    return new Query(this, table);
  }

  async rpc(name: string, args: Row): Promise<QueryResult> {
    this.rpcCalls.push({ name, args });
    switch (name) {
      case "agent_claim_event":
        return this.claimEvent(String(args.p_event_id));
      case "agent_ensure_owner_member":
        return this.ensureOwnerMember(String(args.p_actor), String(args.p_trip_id));
      case "agent_save_expense":
        return this.saveExpense(args);
      case "agent_attach_unassigned":
        return this.attachUnassigned(args);
      default:
        return { data: null, error: null };
    }
  }

  calls(name: string): Row[] {
    return this.rpcCalls.filter((c) => c.name === name).map((c) => c.args);
  }

  event(id: string): Row {
    const row = this.tables.agent_events!.find((e) => e.id === id);
    if (!row) throw new Error(`event ${id} not found`);
    return row;
  }

  // -- RPC 흉내 (supabase/migrations 의 의미를 따른다) ------------------------

  private claimEvent(eventId: string): QueryResult {
    const row = this.tables.agent_events!.find((e) => e.id === eventId);
    if (!row || row.status !== "received") return { data: [], error: null };
    row.status = "processing";
    row.locked_at = new Date().toISOString();
    return { data: [{ ...row }], error: null };
  }

  private ensureOwnerMember(actor: string, tripId: string): QueryResult {
    const trip = this.tables.trips!.find((t) => t.id === tripId);
    const members = this.tables.trip_members!;
    const mine = members.find((m) => m.trip_id === tripId && m.user_id === actor);
    if (mine) return { data: mine.id, error: null };
    if (!trip || trip.user_id !== actor) {
      return { data: null, error: { message: "forbidden" } };
    }
    const row: Row = {
      id: this.nextId("aaaaaaaa"),
      trip_id: tripId,
      user_id: actor,
      display_name: "나",
      auto_include: true,
    };
    members.push(row);
    return { data: row.id, error: null };
  }

  private saveExpense(args: Row): QueryResult {
    const key = `${String(args.p_event_id)}:${String(args.p_index)}`;
    const existing = this.tables.trip_expenses!.find((e) => e.idem === key);
    if (existing) return { data: existing.id, error: null };
    const expense = args.p_expense as Row;
    const row: Row = {
      id: this.nextId("eeeeeeee"),
      idem: key,
      trip_id: args.p_trip_id,
      created_by: args.p_actor,
      status: args.p_status,
      krw_amount: expense.krw_amount,
      source_event_id: args.p_event_id,
    };
    this.tables.trip_expenses!.push(row);
    return { data: row.id, error: null };
  }

  /** agent_attach_unassigned: trips.start_date 가 NULL 이면 p_start 를 쓰고, 둘 다 없으면 0. */
  private attachUnassigned(args: Row): QueryResult {
    const tripId = String(args.p_trip_id);
    const userId = String(args.p_user_id);
    const trip = this.tables.trips!.find((t) => t.id === tripId);
    if (!trip) return { data: null, error: { message: "forbidden" } };
    let start = (trip.start_date as string | null) ?? null;
    let end = (trip.end_date as string | null) ?? null;
    if (!start) {
      start = (args.p_start as string | undefined) ?? null;
      end = (args.p_end as string | undefined) ?? null;
    }
    if (!start) return { data: 0, error: null };
    if (!end || end < start) end = start;

    const DAY = 24 * 60 * 60 * 1000;
    const from = Date.parse(`${start}T00:00:00+09:00`) - DAY;
    const to = Date.parse(`${end}T23:59:59.999+09:00`) + DAY;
    let count = 0;
    for (const e of this.tables.agent_events!) {
      if (e.user_id !== userId || e.status !== "unassigned" || e.trip_id) continue;
      const payload = (e.payload ?? {}) as Row;
      const at = Date.parse(
        String(payload.received_at ?? payload.receivedAt ?? e.created_at)
      );
      if (!(at >= from && at <= to)) continue;
      e.trip_id = tripId;
      e.status = "received";
      e.result = { match: { rule: "exact" } };
      e.error = null;
      e.processed_at = null;
      e.locked_at = null;
      count += 1;
    }
    return { data: count, error: null };
  }
}

type Op = "select" | "insert" | "update" | "upsert";

class Query implements PromiseLike<QueryResult> {
  private op: Op = "select";
  private filters: Array<(r: Row) => boolean> = [];
  private payload: Row | null = null;
  private limitN: number | null = null;
  private head = false;
  private wantCount = false;
  private orderCol: string | null = null;
  private ascending = true;
  private selectCols: string | null = null;
  private onConflict: string | null = null;

  constructor(
    private readonly db: FakeDb,
    private readonly table: string
  ) {}

  select(cols?: string, opts?: { count?: string; head?: boolean }) {
    if (typeof cols === "string") this.selectCols = cols;
    if (this.op === "select") {
      this.head = opts?.head === true;
      this.wantCount = opts?.count === "exact";
      if (this.table === "trips" && typeof cols === "string") {
        this.db.tripSelects.push(cols);
      }
    }
    return this;
  }
  insert(row: Row) {
    this.op = "insert";
    this.payload = row;
    return this;
  }
  update(values: Row) {
    this.op = "update";
    this.payload = values;
    return this;
  }
  upsert(row: Row, opts?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = row;
    this.onConflict = opts?.onConflict ?? null;
    return this;
  }
  eq(col: string, value: unknown) {
    this.filters.push((r) => r[col] === value);
    return this;
  }
  neq(col: string, value: unknown) {
    this.filters.push((r) => r[col] !== value);
    return this;
  }
  in(col: string, values: unknown[]) {
    this.filters.push((r) => values.includes(r[col]));
    return this;
  }
  is(col: string, value: unknown) {
    this.filters.push((r) => (r[col] ?? null) === value);
    return this;
  }
  gte(col: string, value: string) {
    this.filters.push((r) => String(r[col] ?? "") >= value);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.ascending = opts?.ascending !== false;
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  async maybeSingle(): Promise<QueryResult> {
    const res = this.run();
    if (res.error) return res;
    const rows = Array.isArray(res.data) ? res.data : [];
    return { data: rows[0] ?? null, error: null };
  }
  then<R1 = QueryResult, R2 = never>(
    onfulfilled?: ((v: QueryResult) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }

  private matching(): Row[] {
    const rows = this.db.tables[this.table] ?? [];
    return rows.filter((r) => this.filters.every((f) => f(r)));
  }

  private run(): QueryResult {
    const rows = this.db.tables[this.table];
    if (!rows) return { data: null, error: null };

    if (this.op === "insert") {
      const row: Row = { ...this.payload };
      if (this.table === "agent_events") {
        const dup = rows.find(
          (e) =>
            e.user_id === row.user_id && e.idempotency_key === row.idempotency_key
        );
        if (dup) {
          return {
            data: null,
            error: { code: "23505", message: "duplicate key value violates unique constraint" },
          };
        }
        row.result ??= null;
        row.error ??= null;
        row.created_at = new Date().toISOString();
      }
      row.id ??= this.db.nextId("bbbbbbbb");
      rows.push(row);
      return { data: [{ id: row.id }], error: null };
    }

    if (this.op === "upsert") {
      const key = this.onConflict ?? "id";
      const hit = rows.find((r) => r[key] === this.payload?.[key]);
      if (hit) Object.assign(hit, this.payload);
      else rows.push({ ...this.payload });
      return { data: null, error: null };
    }

    if (this.op === "update") {
      const hit = this.matching();
      for (const r of hit) Object.assign(r, this.payload);
      return { data: hit, error: null };
    }

    // select
    if (this.table === "trips" && this.selectCols) {
      const unknown = parseSelectColumns(this.selectCols).filter(
        (c) => !TRIPS_ALLOWLIST.has(c)
      );
      if (unknown.length > 0) {
        const message = `column trips.${unknown[0]} does not exist`;
        this.db.schemaErrors.push(message);
        return { data: null, error: { message } };
      }
    }
    let out = this.matching();
    if (this.orderCol) {
      const col = this.orderCol;
      out = [...out].sort((a, b) =>
        String(a[col] ?? "").localeCompare(String(b[col] ?? ""))
      );
      if (!this.ascending) out.reverse();
    }
    if (this.limitN != null) out = out.slice(0, this.limitN);
    if (this.head) return { data: null, error: null, count: out.length };
    return { data: out.map((r) => ({ ...r })), error: null, count: this.wantCount ? out.length : null };
  }
}

// ---------------------------------------------------------------------------
// 모킹 (외부 경계만)
// ---------------------------------------------------------------------------
let db = new FakeDb();
const afterQueue: Array<() => unknown> = [];
const guardApi = vi.fn();

vi.mock("@/lib/agent/admin", () => ({ getAgentAdmin: () => db }));
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (fn: () => unknown) => {
      afterQueue.push(fn);
    },
  };
});
vi.mock("@/lib/security/guard", () => ({
  guardApi: (...a: unknown[]) => guardApi(...a),
}));
vi.mock("@/lib/agent/membership", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/agent/membership")>();
  // 세션 클라이언트가 필요한 assertTripMember 만 대체. ensureOwnerMemberAdmin 은 실제 코드.
  return { ...actual, assertTripMember: async () => true };
});
vi.mock("@/lib/ledger/fx-server", () => ({
  getDailyFxQuote: async () => ({ rate: 1, rateDate: "2026-03-01", isFallback: false }),
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
    throw new Error("세션 클라이언트는 이 테스트에서 쓰지 않아요");
  },
}));

import { POST as attachUnassigned } from "@/app/api/agent/attach-unassigned/route";
import { ingestStatusMessage } from "@/lib/agent/ingest-source";
import {
  ingestNotificationPayload,
  scheduleProcessIfNeeded,
} from "@/lib/agent/ingest-notification";

// ---------------------------------------------------------------------------
// 도우미
// ---------------------------------------------------------------------------
function seedTrip(t: {
  id: string;
  start: string | null;
  end?: string | null;
  dateRange?: string;
  status?: string;
  userId?: string;
}) {
  db.tables.trips!.push({
    id: t.id,
    user_id: t.userId ?? OWNER,
    destination: "도쿄",
    date_range: t.dateRange ?? "",
    start_date: t.start,
    end_date: t.end ?? t.start,
    local_currency: null,
    status: t.status ?? "upcoming",
    created_at: "2026-02-01T00:00:00.000Z",
  });
}

function seedOwnerMember(tripId: string) {
  db.tables.trip_members!.push({
    id: db.nextId("cccccccc"),
    trip_id: tripId,
    user_id: OWNER,
    display_name: "나",
    auto_include: true,
  });
}

function ingest(receivedAt = "2026-03-01T12:31:00+09:00", body?: string) {
  return ingestNotificationPayload({
    userId: OWNER,
    tokenTripId: null,
    app: "메시지",
    title: "",
    body: body ?? SYNTHETIC_SMS.lotteDomestic.text,
    receivedAt,
    source: "sms_shortcut",
  });
}

async function flushAfter() {
  while (afterQueue.length > 0) {
    await afterQueue.shift()!();
  }
}

function resultOf(id: string): Row & {
  items?: Array<Row>;
  match?: { rule: string };
  reason?: string;
} {
  return (db.event(id).result ?? {}) as never;
}

function postAttach(body: Record<string, unknown>) {
  return attachUnassigned(
    new Request("http://localhost/api/agent/attach-unassigned", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  db = new FakeDb();
  afterQueue.length = 0;
  guardApi.mockReset();
  guardApi.mockResolvedValue({ identity: { kind: "user", userId: OWNER } });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-03-01T12:40:00+09:00"));
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 시나리오
// ---------------------------------------------------------------------------
describe("ingest → match → process (e2e, fake supabase)", () => {
  it("(a) 창 안 여행 + 멤버 행 있음 → exact 로 붙고 자동 저장(done)", async () => {
    seedTrip({ id: TRIP_A, start: "2026-03-01", end: "2026-03-05" });
    seedOwnerMember(TRIP_A);

    const outcome = await ingest();
    expect(outcome.status).toBe("received");
    expect(outcome.tripId).toBe(TRIP_A);
    expect(outcome.matchRule).toBe("exact");
    expect(outcome.shouldProcess).toBe(true);
    expect(ingestStatusMessage(outcome.status, false, { rule: outcome.matchRule })).toBe(
      "여행에 붙여 처리 중이에요"
    );

    scheduleProcessIfNeeded(outcome);
    await flushAfter();

    const id = outcome.result.ok ? outcome.result.id : "";
    const event = db.event(id);
    expect(event.status).toBe("done");
    expect(event.error).toBeNull();
    expect(resultOf(id).match).toEqual({ rule: "exact" });
    expect(resultOf(id).items?.[0]?.decision).toBe("auto_commit");

    const saved = db.calls("agent_save_expense");
    expect(saved).toHaveLength(1);
    expect(saved[0]!.p_status).toBe("auto");
    expect(db.calls("agent_ensure_owner_member")).toHaveLength(0);
    expect(db.tables.trip_expenses).toHaveLength(1);
  });

  it("(b) 창 안 + 본인 trip_members 행 없음 → 서버가 owner 멤버를 만든 뒤 성공 (no-owner-member 아님)", async () => {
    seedTrip({ id: TRIP_A, start: "2026-03-01", end: "2026-03-05" });
    expect(db.tables.trip_members).toHaveLength(0);

    const outcome = await ingest();
    scheduleProcessIfNeeded(outcome);
    await flushAfter();

    const id = outcome.result.ok ? outcome.result.id : "";
    const event = db.event(id);
    expect(event.status).toBe("done");
    expect(event.error).not.toBe("no-owner-member");

    expect(db.calls("agent_ensure_owner_member")).toEqual([
      { p_actor: OWNER, p_trip_id: TRIP_A },
    ]);
    expect(db.tables.trip_members).toHaveLength(1);
    expect(db.tables.trip_members![0]).toMatchObject({
      trip_id: TRIP_A,
      user_id: OWNER,
    });
    expect(db.calls("agent_save_expense")).toHaveLength(1);
  });

  it("(c) 출발 5일 전 알림 → received + match.rule=near, 자동 저장 안 하고 needs_review", async () => {
    // 여행은 3/6~3/8, 알림은 3/1 → 창(3/5~) 밖이지만 14일 이내.
    seedTrip({ id: TRIP_A, start: "2026-03-06", end: "2026-03-08" });
    seedOwnerMember(TRIP_A);

    const outcome = await ingest("2026-03-01T12:31:00+09:00");
    expect(outcome.status).toBe("received");
    expect(outcome.tripId).toBe(TRIP_A);
    expect(outcome.matchRule).toBe("near");
    expect(
      ingestStatusMessage(outcome.status, false, { rule: outcome.matchRule })
    ).toContain("확인");

    const id = outcome.result.ok ? outcome.result.id : "";
    expect(resultOf(id).match).toEqual({ rule: "near" });

    scheduleProcessIfNeeded(outcome);
    await flushAfter();

    expect(db.event(id).status).toBe("needs_review");
    expect(db.calls("agent_save_expense")).toHaveLength(0);
    expect(db.tables.trip_expenses).toHaveLength(0);

    const item = resultOf(id).items?.[0];
    expect(item?.decision).toBe("review");
    expect(item?.reasonCode).toBe("trip_match_uncertain");
    // match 는 확인 단계(confirm)에서도 쓰이도록 결과에 남는다.
    expect(resultOf(id).match).toEqual({ rule: "near" });
    // 수신함이 보여 줄 한 줄 문구는 같은 사유 표에서 나온다.
    expect(
      agentEventReasonLine({
        status: "needs_review",
        reasonCode: String(item?.reasonCode),
      })
    ).toBe(AGENT_REASON_MESSAGES.trip_match_uncertain);
  });

  it("(d) 여행 0개 → unassigned, 여행 생성 후 attach-unassigned → received 로 승격되고 처리까지", async () => {
    const outcome = await ingest();
    expect(outcome.status).toBe("unassigned");
    expect(outcome.tripId).toBeNull();
    expect(outcome.missReason).toBe("no_trips");
    expect(outcome.shouldProcess).toBe(false);
    expect(
      ingestStatusMessage(outcome.status, false, { reason: outcome.missReason })
    ).toContain("여행이 없어서");

    const id = outcome.result.ok ? outcome.result.id : "";
    expect(db.event(id).status).toBe("unassigned");
    expect(db.event(id).trip_id).toBeNull();
    expect(resultOf(id).reason).toBe("no_trips");
    expect(
      agentEventReasonLine({ status: "unassigned", reason: resultOf(id).reason })
    ).toBe(AGENT_REASON_MESSAGES.no_trips);

    // 사용자가 여행을 만든다 (start_date/end_date 가 함께 저장된 상태).
    seedTrip({ id: TRIP_B, start: "2026-02-28", end: "2026-03-03" });

    const res = await postAttach({ tripId: TRIP_B });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, attached: 1, requeued: 1 });

    // RPC 직후: 여행이 붙고 received (재큐 대기)
    expect(db.event(id).trip_id).toBe(TRIP_B);
    expect(db.event(id).status).toBe("received");
    expect(resultOf(id).match).toEqual({ rule: "exact" });
    // 서버가 owner 멤버 행도 보장했다.
    expect(db.calls("agent_ensure_owner_member")[0]).toEqual({
      p_actor: OWNER,
      p_trip_id: TRIP_B,
    });

    await flushAfter();
    expect(db.event(id).status).toBe("done");
    expect(db.calls("agent_save_expense")).toHaveLength(1);
  });

  it("(d-2) trips.start_date 가 NULL 이면 날짜 인자 없이는 붙지 않고, startDate 를 넘기면 붙는다", async () => {
    const outcome = await ingest();
    const id = outcome.result.ok ? outcome.result.id : "";
    seedTrip({ id: TRIP_B, start: null, end: null, dateRange: "3월 1일 - 3월 3일" });

    const none = await (await postAttach({ tripId: TRIP_B })).json();
    expect(none).toMatchObject({ ok: true, attached: 0, requeued: 0 });
    expect(db.event(id).status).toBe("unassigned");

    const some = await (
      await postAttach({ tripId: TRIP_B, startDate: "2026-03-01", endDate: "2026-03-03" })
    ).json();
    expect(some).toMatchObject({ ok: true, attached: 1 });
    expect(db.event(id).status).toBe("received");
  });

  it("같은 알림을 두 번 보내고 두 번 처리해도 지출은 1건 (멱등)", async () => {
    seedTrip({ id: TRIP_A, start: "2026-03-01", end: "2026-03-05" });
    seedOwnerMember(TRIP_A);

    const first = await ingest();
    const second = await ingest();
    expect(second.result.ok && second.result.duplicate).toBe(true);
    expect(second.shouldProcess).toBe(false);

    scheduleProcessIfNeeded(first);
    scheduleProcessIfNeeded(second);
    await flushAfter();
    // 다시 처리를 시도해도 이미 done 이라 claim 되지 않는다.
    const { processEvent } = await import("@/lib/agent/run");
    await processEvent(first.result.ok ? first.result.id : "");

    expect(db.tables.trip_expenses).toHaveLength(1);
  });

  it("(e) trips select 문자열에 존재하지 않는 컬럼이 없다 (currency 오타 재발 방지)", async () => {
    seedTrip({ id: TRIP_A, start: "2026-03-01", end: "2026-03-05" });
    seedOwnerMember(TRIP_A);

    const outcome = await ingest(); // pickTripForReceivedAt 의 trips select
    scheduleProcessIfNeeded(outcome); // loadCtx 의 trips select
    await flushAfter();

    // 인제스트·매칭·loadCtx 가 trips 를 실제로 읽었는지 먼저 확인 (빈 검사 방지)
    expect(db.tripSelects.length).toBeGreaterThanOrEqual(2);
    const loadCtxSelect = db.tripSelects.find((s) => s.includes("local_currency"));
    expect(loadCtxSelect, "loadCtx 는 local_currency 를 select 해야 해요").toBeTruthy();

    for (const sel of db.tripSelects) {
      const missing = parseSelectColumns(sel).filter((c) => !TRIPS_ALLOWLIST.has(c));
      expect(missing, `trips.select("${sel}") 에 없는 컬럼`).toEqual([]);
    }
    expect(db.schemaErrors).toEqual([]);
    // 쿼리 오류가 났다면 예전처럼 failed / no-owner-member 로 보였을 것이다.
    const id = outcome.result.ok ? outcome.result.id : "";
    expect(db.event(id).status).toBe("done");
  });
});
