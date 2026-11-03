import { describe, expect, it } from "vitest";
import { makeTrip } from "@/components/agent/ledger-home/ledger-home.fixtures";
import { groupTripsForLedgerPicker } from "./groupTripsForLedgerPicker";

describe("groupTripsForLedgerPicker", () => {
  it("여행 중·예정·완료를 나누고 출발일 오름차순으로 정렬해요", () => {
    const a = makeTrip({
      id: "a",
      destination: "오사카",
      status: "upcoming",
      startDate: "2026-09-01",
    });
    const b = makeTrip({
      id: "b",
      destination: "도쿄",
      status: "ongoing",
      startDate: "2026-07-20",
    });
    const c = makeTrip({
      id: "c",
      destination: "부산",
      status: "completed",
      startDate: "2025-01-01",
    });
    const d = makeTrip({
      id: "d",
      destination: "제주",
      status: "completed",
      startDate: "2025-06-01",
    });
    const e = makeTrip({
      id: "e",
      destination: "후쿠오카",
      status: "upcoming",
      startDate: "2026-08-01",
    });

    const g = groupTripsForLedgerPicker([a, b, c, d, e]);
    expect(g.ongoing.map((t) => t.id)).toEqual(["b"]);
    expect(g.upcoming.map((t) => t.id)).toEqual(["e", "a"]);
    expect(g.completed.map((t) => t.id)).toEqual(["c", "d"]);
  });
});
