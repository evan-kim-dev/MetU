import { describe, expect, it, vi } from "vitest";
import {
  fetchLatestSettlement,
  listVoidedExpenseIds,
  settlementFromRows,
} from "@/lib/ledger/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("settlementFromRows", () => {
  it("maps rows, coerces bigint strings and sorts deterministically", () => {
    const s = settlementFromRows(
      {
        id: "s1",
        version: "3",
        status: "open",
        origin: "auto",
        basis_hash: "h",
        share_token: "tok",
      },
      [
        { id: "t2", from_member: "b", to_member: "a", krw: "500", status: "paid" },
        { id: "t1", from_member: "a", to_member: "c", krw: 100, status: "pending" },
      ]
    );
    expect(s.version).toBe(3);
    expect(s.origin).toBe("auto");
    expect(s.shareToken).toBe("tok");
    expect(s.transfers.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(s.transfers[1]).toMatchObject({ krw: 500, status: "paid" });
  });

  it("defaults unknown origin to manual and unknown transfer status to pending", () => {
    const s = settlementFromRows(
      {
        id: "s",
        version: 1,
        status: "completed",
        basis_hash: "h",
        share_token: null,
      },
      [{ id: "t", from_member: "a", to_member: "b", krw: 1, status: "weird" }]
    );
    expect(s.origin).toBe("manual");
    expect(s.shareToken).toBeNull();
    expect(s.transfers[0]!.status).toBe("pending");
  });
});

type Result = { data: unknown; error: { message: string } | null };

/** supabase 쿼리 빌더 체인을 흉내 낸다(마지막 await/maybeSingle 이 result 를 돌려줌). */
function chain(result: Result) {
  const q: Record<string, unknown> = {};
  const self = () => q;
  for (const m of ["select", "eq", "neq", "order", "limit", "in"]) {
    q[m] = vi.fn(self);
  }
  q.maybeSingle = vi.fn(async () => result);
  q.then = (resolve: (v: Result) => unknown) => resolve(result);
  return q;
}

function clientWith(byTable: Record<string, Result>): SupabaseClient {
  return {
    from: (table: string) => chain(byTable[table] ?? { data: [], error: null }),
  } as unknown as SupabaseClient;
}

describe("fetchLatestSettlement", () => {
  it("returns null settlement when none exists", async () => {
    const res = await fetchLatestSettlement(
      clientWith({ trip_settlements: { data: null, error: null } }),
      "trip"
    );
    expect(res).toEqual({ ok: true, settlement: null });
  });

  it("returns settlement with transfers", async () => {
    const res = await fetchLatestSettlement(
      clientWith({
        trip_settlements: {
          data: {
            id: "s1",
            version: 2,
            status: "stale",
            origin: "auto",
            basis_hash: "h",
            share_token: "tok",
          },
          error: null,
        },
        trip_settlement_transfers: {
          data: [
            { id: "t1", from_member: "a", to_member: "b", krw: 100, status: "pending" },
          ],
          error: null,
        },
      }),
      "trip"
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.settlement?.status).toBe("stale");
    expect(res.settlement?.transfers).toHaveLength(1);
  });

  it("reports failure (not empty) on db error and logs the cause", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await fetchLatestSettlement(
      clientWith({
        trip_settlements: { data: null, error: { message: "rls" } },
      }),
      "trip"
    );
    expect(res).toEqual({ ok: false });
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe("listVoidedExpenseIds", () => {
  it("returns a set of ids", async () => {
    const ids = await listVoidedExpenseIds(
      clientWith({
        trip_expenses: { data: [{ id: "e1" }, { id: "e2" }], error: null },
      }),
      "trip"
    );
    expect(ids).toEqual(new Set(["e1", "e2"]));
  });

  it("returns null on error", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const ids = await listVoidedExpenseIds(
      clientWith({ trip_expenses: { data: null, error: { message: "x" } } }),
      "trip"
    );
    expect(ids).toBeNull();
    err.mockRestore();
  });
});
