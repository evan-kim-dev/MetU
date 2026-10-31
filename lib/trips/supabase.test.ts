import { describe, expect, it } from "vitest";

import {
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
