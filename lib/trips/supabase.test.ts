import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  fetchTripByIdFromSupabase,
  fetchTripsFromSupabase,
  tripDateColumns,
  tripToRow,
  updateToRow,
} from "@/lib/trips/supabase";
import type { Trip } from "@/lib/trips/types";

const USER = "11111111-1111-4111-8111-111111111111";

function trip(over: Partial<Trip> = {}): Trip {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    destination: "도쿄",
    country: "일본",
    origin: "서울",
    dateRange: "2026-07-20 · 3박 4일",
    dDay: 0,
    budget: 0,
    spent: 0,
    people: 1,
    styles: [],
    imageUrl: "",
    expenses: [],
    status: "upcoming",
    ...over,
  };
}

describe("tripDateColumns", () => {
  it("확정된 ISO 가 있으면 그것을 우선", () => {
    expect(
      tripDateColumns(
        {
          dateRange: "여름 휴가",
          startDate: "2026-07-20",
          endDate: "2026-07-25",
        },
        "2026-01-01"
      )
    ).toEqual({ start_date: "2026-07-20", end_date: "2026-07-25" });
  });

  it("확정 종료일이 없거나 시작보다 앞서면 시작일 하루", () => {
    expect(
      tripDateColumns({ dateRange: "x", startDate: "2026-07-20" }, "2026-01-01")
    ).toEqual({ start_date: "2026-07-20", end_date: "2026-07-20" });
    expect(
      tripDateColumns(
        { dateRange: "x", startDate: "2026-07-20", endDate: "2026-07-01" },
        "2026-01-01"
      )
    ).toEqual({ start_date: "2026-07-20", end_date: "2026-07-20" });
  });

  it("라벨에서 추정 (퀵 여행 / 한글 범위)", () => {
    expect(
      tripDateColumns({ dateRange: "2026-10-31 · 4박 5일" }, "2026-10-30")
    ).toEqual({ start_date: "2026-10-31", end_date: "2026-11-04" });
    expect(
      tripDateColumns({ dateRange: "7월 20일 - 7월 25일" }, "2026-01-01")
    ).toEqual({ start_date: "2026-07-20", end_date: "2026-07-25" });
  });

  it("해석 실패 시 null (지어내지 않음)", () => {
    expect(tripDateColumns({ dateRange: "미정" }, "2026-01-01")).toEqual({
      start_date: null,
      end_date: null,
    });
    expect(
      tripDateColumns({ dateRange: "x", startDate: "내일" }, "2026-01-01")
    ).toEqual({ start_date: null, end_date: null });
  });
});

describe("tripToRow", () => {
  it("date_range 와 함께 start_date/end_date 를 쓴다", () => {
    const row = tripToRow(trip(), USER);
    expect(row.date_range).toBe("2026-07-20 · 3박 4일");
    expect(row.start_date).toBe("2026-07-20");
    expect(row.end_date).toBe("2026-07-23");
    expect(row.user_id).toBe(USER);
  });

  it("해석 불가 라벨은 null 유지", () => {
    const row = tripToRow(trip({ dateRange: "미정" }), USER);
    expect(row.start_date).toBeNull();
    expect(row.end_date).toBeNull();
  });

  it("Trip 에 확정 날짜가 있으면 라벨보다 우선", () => {
    const row = tripToRow(
      trip({ dateRange: "미정", startDate: "2026-09-01", endDate: "2026-09-03" }),
      USER
    );
    expect(row.start_date).toBe("2026-09-01");
    expect(row.end_date).toBe("2026-09-03");
  });
});

describe("updateToRow", () => {
  it("dateRange 변경 시 날짜 컬럼도 같이 갱신", () => {
    const row = updateToRow({
      dateRange: "2026-08-01 · 2박 3일",
    });
    expect(row.date_range).toBe("2026-08-01 · 2박 3일");
    expect(row.start_date).toBe("2026-08-01");
    expect(row.end_date).toBe("2026-08-03");
  });

  it("dateRange 를 해석할 수 없으면 낡은 날짜를 남기지 않도록 null 로 덮어쓴다", () => {
    const row = updateToRow({ dateRange: "미정" });
    expect(row.start_date).toBeNull();
    expect(row.end_date).toBeNull();
  });

  it("startDate/endDate 를 직접 주면 그대로 저장", () => {
    const row = updateToRow({ startDate: "2026-08-10", endDate: "2026-08-12" });
    expect(row.start_date).toBe("2026-08-10");
    expect(row.end_date).toBe("2026-08-12");
    expect(row).not.toHaveProperty("date_range");
  });

  it("날짜와 무관한 수정은 날짜 컬럼을 건드리지 않는다", () => {
    const row = updateToRow({ memo: "메모", status: "ongoing" });
    expect(row).not.toHaveProperty("start_date");
    expect(row).not.toHaveProperty("end_date");
  });
});

// ---------------------------------------------------------------------------
// 소유 + 공유받은 여행
// ---------------------------------------------------------------------------
const OWNER = USER;
const OTHER = "99999999-9999-4999-8999-999999999999";
const OWN_TRIP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SHARED_TRIP = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type Call = { table: string; method: string; args: unknown[] };
type Result = { data: unknown; error: { message: string } | null };

/** from(table) 마다 미리 정한 결과를 돌려주는 최소 fake. 호출 기록을 남긴다. */
function fakeSupabase(results: Record<string, Result[]>) {
  const calls: Call[] = [];
  const queues = Object.fromEntries(
    Object.entries(results).map(([k, v]) => [k, [...v]])
  );
  const from = vi.fn((table: string) => {
    const result: Result = queues[table]?.shift() ?? { data: [], error: null };
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "order", "limit"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return builder;
      };
    }
    builder.maybeSingle = () => {
      calls.push({ table, method: "maybeSingle", args: [] });
      return Promise.resolve(result);
    };
    builder.then = (
      resolve: (value: Result) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(resolve, reject);
    return builder;
  });
  return { client: { from } as unknown as SupabaseClient, calls };
}

function row(id: string, userId: string, createdAt: string) {
  return {
    id,
    user_id: userId,
    destination: id === OWN_TRIP ? "도쿄" : "오사카",
    country: "일본",
    origin: "서울",
    date_range: "2026-07-20 · 3박 4일",
    start_date: "2026-07-20",
    end_date: "2026-07-23",
    d_day: 0,
    budget: 0,
    spent: 0,
    people: 2,
    styles: [],
    image_url: "",
    memo: null,
    status: "upcoming",
    created_at: createdAt,
  };
}

describe("fetchTripsFromSupabase — 소유 + 멤버 합집합", () => {
  it("내 여행과 멤버로 합류한 여행을 합치고 isOwner 를 표시한다 (최신순)", async () => {
    const { client, calls } = fakeSupabase({
      trips: [
        { data: [row(OWN_TRIP, OWNER, "2026-10-01T00:00:00Z")], error: null },
        { data: [row(SHARED_TRIP, OTHER, "2026-10-05T00:00:00Z")], error: null },
      ],
      trip_members: [
        {
          data: [{ trip_id: SHARED_TRIP }, { trip_id: OWN_TRIP }],
          error: null,
        },
      ],
    });

    const trips = await fetchTripsFromSupabase(client, OWNER);

    expect(trips.map((t) => t.id)).toEqual([SHARED_TRIP, OWN_TRIP]);
    expect(trips.find((t) => t.id === OWN_TRIP)?.isOwner).toBe(true);
    expect(trips.find((t) => t.id === SHARED_TRIP)?.isOwner).toBe(false);

    // 소유 쿼리는 user_id, 멤버 쿼리는 user_id, 공유 여행 쿼리는 소유한 id 를 뺀 목록
    expect(calls).toContainEqual({
      table: "trips",
      method: "eq",
      args: ["user_id", OWNER],
    });
    expect(calls).toContainEqual({
      table: "trip_members",
      method: "eq",
      args: ["user_id", OWNER],
    });
    expect(calls).toContainEqual({
      table: "trips",
      method: "in",
      args: ["id", [SHARED_TRIP]],
    });
  });

  it("공유받은 여행이 없으면 두 번째 trips 조회를 하지 않는다", async () => {
    const { client, calls } = fakeSupabase({
      trips: [
        { data: [row(OWN_TRIP, OWNER, "2026-10-01T00:00:00Z")], error: null },
      ],
      trip_members: [{ data: [{ trip_id: OWN_TRIP }], error: null }],
    });
    const trips = await fetchTripsFromSupabase(client, OWNER);
    expect(trips).toHaveLength(1);
    expect(trips[0]?.isOwner).toBe(true);
    expect(calls.filter((c) => c.table === "trips" && c.method === "in")).toEqual(
      []
    );
  });

  it("멤버 조회가 실패해도 내 여행은 돌려준다", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeSupabase({
      trips: [
        { data: [row(OWN_TRIP, OWNER, "2026-10-01T00:00:00Z")], error: null },
      ],
      trip_members: [{ data: null, error: { message: "boom" } }],
    });
    const trips = await fetchTripsFromSupabase(client, OWNER);
    expect(trips.map((t) => t.id)).toEqual([OWN_TRIP]);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("내 여행 조회가 실패하면 빈 배열", async () => {
    const { client } = fakeSupabase({
      trips: [{ data: null, error: { message: "boom" } }],
    });
    expect(await fetchTripsFromSupabase(client, OWNER)).toEqual([]);
  });
});

describe("fetchTripByIdFromSupabase — 멤버 허용", () => {
  it("user_id 로 거르지 않고 id 로만 조회하며 isOwner 를 계산한다", async () => {
    const { client, calls } = fakeSupabase({
      trips: [{ data: row(SHARED_TRIP, OTHER, "2026-10-05T00:00:00Z"), error: null }],
    });
    const found = await fetchTripByIdFromSupabase(client, OWNER, SHARED_TRIP);
    expect(found?.id).toBe(SHARED_TRIP);
    expect(found?.isOwner).toBe(false);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "user_id")).toBe(
      false
    );
    expect(calls).toContainEqual({
      table: "trips",
      method: "eq",
      args: ["id", SHARED_TRIP],
    });
  });

  it("RLS 로 안 보이면 null", async () => {
    const { client } = fakeSupabase({ trips: [{ data: null, error: null }] });
    expect(await fetchTripByIdFromSupabase(client, OWNER, SHARED_TRIP)).toBeNull();
  });
});
