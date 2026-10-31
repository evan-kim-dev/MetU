import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  fetchSettlementHistory,
  fetchSharedLedger,
} from "@/lib/ledger/supabase";

function rpcClient(handlers: Record<string, { data: unknown; error: unknown }>) {
  const rpc = vi.fn(async (name: string) => {
    return handlers[name] ?? { data: null, error: { message: "no rpc" } };
  });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("fetchSharedLedger", () => {
  it("get_shared_settlement_detail 의 지출을 LedgerExpenseRow 로 매핑한다", async () => {
    const { client, rpc } = rpcClient({
      get_shared_settlement_detail: {
        error: null,
        data: {
          destination: "도쿄",
          dateRange: "x",
          version: 1,
          status: "open",
          members: [
            { id: "m1", displayName: "민수" },
            { id: "m2", displayName: "지영" },
          ],
          transfers: [],
          totals: { totalKrw: 5000, expenseCount: 1, expensesTruncated: false },
          expenses: [
            {
              id: "e1",
              label: "라멘",
              category: "식비",
              spentOn: "2026-07-22",
              paidBy: "m2",
              amount: "500.00",
              currency: "JPY",
              fxRateToKrw: "10",
              krwAmount: 5000,
            },
          ],
        },
      },
    });

    const ledger = await fetchSharedLedger(client, "tok");

    expect(rpc).toHaveBeenCalledWith("get_shared_settlement_detail", {
      p_token: "tok",
    });
    expect(ledger?.members.map((m) => m.displayName)).toEqual(["민수", "지영"]);
    expect(ledger?.expenses).toHaveLength(1);
    expect(ledger?.expenses[0]).toMatchObject({
      id: "e1",
      paidBy: "m2",
      label: "라멘",
      amount: 500,
      currency: "JPY",
      fxRateToKrw: 10,
      krwAmount: 5000,
      spentOn: "2026-07-22",
    });
  });

  it("상세 RPC 가 없으면(오류) 멤버만 있는 기존 정산 공유로 내려간다", async () => {
    const { client, rpc } = rpcClient({
      get_shared_settlement: {
        error: null,
        data: {
          members: [{ id: "m1", displayName: "민수" }],
          transfers: [],
          totals: { totalKrw: 0 },
        },
      },
    });
    const ledger = await fetchSharedLedger(client, "tok");
    expect(rpc).toHaveBeenCalledWith("get_shared_settlement", { p_token: "tok" });
    expect(ledger?.members).toHaveLength(1);
    expect(ledger?.expenses).toEqual([]);
  });

  it("정산 토큰이 아니면 레거시 get_shared_ledger 로 내려간다", async () => {
    const { client } = rpcClient({
      get_shared_settlement_detail: { error: null, data: null },
      get_shared_settlement: { error: null, data: null },
      get_shared_ledger: {
        error: null,
        data: { members: [{ id: "m1", displayName: "민수", isOwner: true }], expenses: [] },
      },
    });
    const ledger = await fetchSharedLedger(client, "trip-share-token");
    expect(ledger?.members[0]?.isOwner).toBe(true);
  });

  it("아무 곳에서도 찾지 못하면 null", async () => {
    const { client } = rpcClient({});
    expect(await fetchSharedLedger(client, "nope")).toBeNull();
  });
});

describe("fetchSettlementHistory", () => {
  function historyClient(result: { data: unknown; error: { message: string } | null }) {
    const builder: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order"]) builder[m] = () => builder;
    builder.limit = () => Promise.resolve(result);
    return { from: vi.fn(() => builder) } as unknown as SupabaseClient;
  }

  it("버전·상태·공유 토큰을 앱 타입으로 읽는다", async () => {
    const items = await fetchSettlementHistory(
      historyClient({
        error: null,
        data: [
          {
            id: "s2",
            version: "2",
            status: "open",
            origin: "auto",
            share_token: "t2",
            created_at: "2026-11-02T00:00:00Z",
          },
          {
            id: "s1",
            version: 1,
            status: "superseded",
            origin: null,
            share_token: null,
            created_at: null,
          },
        ],
      }),
      "trip-1"
    );
    expect(items).toEqual([
      {
        id: "s2",
        version: 2,
        status: "open",
        origin: "auto",
        shareToken: "t2",
        createdAt: "2026-11-02T00:00:00Z",
      },
      {
        id: "s1",
        version: 1,
        status: "superseded",
        origin: "manual",
        shareToken: null,
        createdAt: null,
      },
    ]);
  });

  it("조회 실패는 null (로그만 남김)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const items = await fetchSettlementHistory(
      historyClient({ data: null, error: { message: "boom" } }),
      "trip-1"
    );
    expect(items).toBeNull();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
