import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const EXP = "22222222-2222-4222-8222-222222222222";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const guardApi = vi.fn();
const geminiStructured = vi.fn();
const tables: Record<string, { single?: unknown; list?: unknown }> = {};

vi.mock("@/lib/security/guard", () => ({
  guardApi: (...a: unknown[]) => guardApi(...a),
  rejectAnonymousWrite: (identity: { kind?: string; isAnonymous?: boolean }) =>
    identity.kind === "user" && identity.isAnonymous === true
      ? Response.json({ error: "guest-readonly" }, { status: 403 })
      : null,
}));
vi.mock("@/lib/ai/gemini", () => ({
  geminiStructured: (...a: unknown[]) => geminiStructured(...a),
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

function req(body: unknown) {
  return new Request("http://localhost/api/ledger/split-patch", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function patchOf(over: Record<string, unknown> = {}) {
  return {
    expenseId: EXP,
    exclude: [],
    only: [],
    weights: [],
    itemExclusions: [],
    clarification: null,
    ...over,
  };
}

function geminiOk(data: unknown) {
  geminiStructured.mockResolvedValue({
    ok: true,
    data,
    model: "m",
    ms: 1,
  });
}

const SECRET_TEXT = "민수는 빼고 나눠줘 제발";

describe("POST /api/ledger/split-patch (미리보기)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: "user-1" },
      clientKey: "k",
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
        { id: A, display_name: "민수", user_id: "user-1", is_owner: true },
        { id: B, display_name: "지영", user_id: "user-2", is_owner: false },
        { id: C, display_name: "철수", user_id: "user-3", is_owner: false },
      ],
    };
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it("게스트는 401, Gemini 는 부르지 않는다", async () => {
    guardApi.mockResolvedValue({
      identity: { kind: "guest", nonce: "n" },
      clientKey: "k",
    });
    const { POST } = await import("./route");
    expect((await POST(req({ expenseId: EXP, text: "x" }))).status).toBe(401);
    expect(geminiStructured).not.toHaveBeenCalled();
  });

  it("body 검증 실패는 400 (uuid 아님 / 빈 글 / 알 수 없는 키 / 너무 긴 글)", async () => {
    const { POST } = await import("./route");
    expect((await POST(req({ expenseId: "nope", text: "x" }))).status).toBe(400);
    expect((await POST(req({ expenseId: EXP, text: "  " }))).status).toBe(400);
    expect(
      (await POST(req({ expenseId: EXP, text: "x", shares: { [A]: 1 } }))).status
    ).toBe(400);
    expect(
      (await POST(req({ expenseId: EXP, text: "x".repeat(301) }))).status
    ).toBe(400);
    expect(geminiStructured).not.toHaveBeenCalled();
  });

  it("볼 수 없는 지출은 403", async () => {
    tables.trip_expenses = {};
    const { POST } = await import("./route");
    expect((await POST(req({ expenseId: EXP, text: "x" }))).status).toBe(403);
  });

  it("취소된 지출은 409", async () => {
    tables.trip_expenses!.single = {
      ...(tables.trip_expenses!.single as object),
      status: "voided",
    };
    const { POST } = await import("./route");
    expect((await POST(req({ expenseId: EXP, text: "x" }))).status).toBe(409);
    expect(geminiStructured).not.toHaveBeenCalled();
  });

  it("patch 를 받아 서버가 분담액을 계산한 미리보기를 돌려준다", async () => {
    geminiOk(patchOf({ exclude: [A] }));
    const { POST } = await import("./route");
    const res = await POST(req({ expenseId: EXP, text: SECRET_TEXT }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.needsClarification).toBe(false);
    expect(json.preview.kind).toBe("exclude");
    expect(json.preview.after).toEqual([
      { memberId: B, name: "지영", krw: 15000 },
      { memberId: C, name: "철수", krw: 15000 },
    ]);
    expect(json.preview.before).toHaveLength(3);
    expect(typeof json.preview.beforeDigest).toBe("string");
    expect(json.patch.exclude).toEqual([A]);

    const call = geminiStructured.mock.calls[0]![0] as {
      purpose: string;
      userId: string;
      input: string;
      system: string;
    };
    expect(call.purpose).toBe("split_patch");
    expect(call.userId).toBe("user-1");
    expect(call.input).toContain(SECRET_TEXT);
    // 금액은 모델 입력에도 넣지 않는다
    expect(call.input).not.toContain("30000");
    expect(call.input).not.toContain("10000");
  });

  it("모델이 준 expenseId 는 믿지 않고 사용자가 고른 지출로 덮어쓴다", async () => {
    geminiOk(
      patchOf({
        exclude: [A],
        expenseId: "99999999-9999-4999-8999-999999999999",
      })
    );
    const { POST } = await import("./route");
    const json = await (await POST(req({ expenseId: EXP, text: "x" }))).json();
    expect(json.patch.expenseId).toBe(EXP);
    expect(json.preview.expenseId).toBe(EXP);
  });

  it("amount / krw 키가 섞인 모델 응답은 422 로 거절한다", async () => {
    for (const extra of [{ amount: 5000 }, { krw: 5000 }, { shares: {} }]) {
      geminiOk({ ...patchOf({ exclude: [A] }), ...extra });
      const { POST } = await import("./route");
      const res = await POST(req({ expenseId: EXP, text: "x" }));
      expect(res.status).toBe(422);
      expect((await res.json()).error).toBe("patch-invalid");
    }
  });

  it("Gemini 스키마 검증 실패(zod_failed)는 422", async () => {
    geminiStructured.mockResolvedValue({ ok: false, error: "zod_failed" });
    const { POST } = await import("./route");
    expect((await POST(req({ expenseId: EXP, text: "x" }))).status).toBe(422);
  });

  it("키 없음 503 / 일일 상한 429 / 기타 실패 502", async () => {
    const { POST } = await import("./route");
    geminiStructured.mockResolvedValue({ ok: false, error: "no_api_key" });
    expect((await POST(req({ expenseId: EXP, text: "x" }))).status).toBe(503);
    geminiStructured.mockResolvedValue({ ok: false, error: "daily_llm_cap" });
    expect((await POST(req({ expenseId: EXP, text: "x" }))).status).toBe(429);
    geminiStructured.mockResolvedValue({ ok: false, error: "boom" });
    expect((await POST(req({ expenseId: EXP, text: "x" }))).status).toBe(502);
  });

  it("모호하면 되묻는 말만 돌려준다 (계산 없음)", async () => {
    geminiOk(patchOf({ clarification: "누구를 빼요?" }));
    const { POST } = await import("./route");
    const json = await (await POST(req({ expenseId: EXP, text: "x" }))).json();
    expect(json.ok).toBe(true);
    expect(json.needsClarification).toBe(true);
    expect(json.message).toBe("누구를 빼요?");
    expect(json.target).toEqual({ expenseId: EXP, label: "이자카야" });
  });

  it("익명이 다른 사람을 빼면 422 guest-self-only", async () => {
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: "user-1", isAnonymous: true },
      clientKey: "k",
    });
    geminiOk(patchOf({ exclude: [B] }));
    const { POST } = await import("./route");
    const res = await POST(req({ expenseId: EXP, text: "민수 빼줘" }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("guest-self-only");
  });

  it("익명이 weights 를 쓰면 거부", async () => {
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: "user-1", isAnonymous: true },
      clientKey: "k",
    });
    geminiOk(patchOf({ weights: [{ memberId: A, weight: 2 }] }));
    const { POST } = await import("./route");
    const res = await POST(req({ expenseId: EXP, text: "나는 두 배" }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("guest-self-only");
  });

  it("익명이 자기 제외는 미리보기 가능", async () => {
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: "user-1", isAnonymous: true },
      clientKey: "k",
    });
    geminiOk(patchOf({ exclude: [A] }));
    const { POST } = await import("./route");
    const res = await POST(req({ expenseId: EXP, text: "저는 빠질게요" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.preview.myAfter).toBe(0);
  });

  it("비멤버는 403", async () => {
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: "stranger", isAnonymous: false },
      clientKey: "k",
    });
    const { POST } = await import("./route");
    expect((await POST(req({ expenseId: EXP, text: "x" }))).status).toBe(403);
    expect(geminiStructured).not.toHaveBeenCalled();
  });

  it("요청자 id 가 Gemini 입력에 들어간다", async () => {
    geminiOk(patchOf({ exclude: [A] }));
    const { POST } = await import("./route");
    await POST(req({ expenseId: EXP, text: "저는 빠질게요" }));
    const call = geminiStructured.mock.calls[0]![0] as { input: string };
    expect(call.input).toContain(`[요청자] id=${A}`);
    expect(call.input).toContain("저는 빠질게요");
  });

  it("멤버가 아닌 id 는 422 와 한국어 메시지", async () => {
    geminiOk(patchOf({ exclude: ["ghost"] }));
    const { POST } = await import("./route");
    const res = await POST(req({ expenseId: EXP, text: "x" }));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe("unknown-member");
    expect(json.message).toMatch(/멤버/);
  });

  it("분담이 달라지지 않으면 422 no-change", async () => {
    geminiOk(patchOf({ only: [A, B, C] }));
    const { POST } = await import("./route");
    const res = await POST(req({ expenseId: EXP, text: "x" }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("no-change");
  });

  it("로그에 사용자 원문을 남기지 않는다", async () => {
    geminiOk(patchOf({ exclude: [A] }));
    const { POST } = await import("./route");
    await POST(req({ expenseId: EXP, text: SECRET_TEXT }));
    geminiStructured.mockResolvedValue({ ok: false, error: "zod_failed" });
    await POST(req({ expenseId: EXP, text: SECRET_TEXT }));
    const logged = [
      ...vi.mocked(console.info).mock.calls,
      ...vi.mocked(console.error).mock.calls,
    ]
      .flat()
      .map(String)
      .join("\n");
    expect(logged).not.toContain(SECRET_TEXT);
    expect(logged).not.toContain("민수");
  });
});
