import { describe, expect, it } from "vitest";
import {
  agentEventStatusLabel,
  agentEventStatusLabelForUi,
  formatRelativeKo,
  formatTripRangeShort,
  unassignedNote,
} from "@/lib/agent/event-status";

describe("agentEventStatusLabel", () => {
  it("maps known statuses", () => {
    expect(agentEventStatusLabel("unassigned")).toBe("여행 없음·보관됨");
    expect(agentEventStatusLabel("done")).toBe("가계부 저장됨");
    expect(agentEventStatusLabel("ignored")).toBe("무시됨");
  });

  it("falls back to raw status", () => {
    expect(agentEventStatusLabel("mystery")).toBe("mystery");
  });
});

describe("agentEventStatusLabelForUi", () => {
  it("isTest -> 연결 테스트", () => {
    expect(
      agentEventStatusLabelForUi({ status: "ignored", isTest: true })
    ).toBe("연결 테스트");
  });

  it("non-test uses status map", () => {
    expect(
      agentEventStatusLabelForUi({ status: "ignored", isTest: false })
    ).toBe("무시됨");
  });
});

describe("formatRelativeKo", () => {
  const now = Date.parse("2026-10-30T12:00:00+09:00");

  it("shows minutes and hours", () => {
    expect(
      formatRelativeKo("2026-10-30T11:50:00+09:00", now)
    ).toBe("10분 전");
    expect(
      formatRelativeKo("2026-10-30T09:00:00+09:00", now)
    ).toBe("3시간 전");
  });

  it("shows just now for recent", () => {
    expect(
      formatRelativeKo("2026-10-30T11:59:30+09:00", now)
    ).toBe("방금");
  });
});

describe("formatTripRangeShort", () => {
  it("같은 달 / 다른 달 / 하루", () => {
    expect(formatTripRangeShort("2026-07-20", "2026-07-23")).toBe("7/20~23");
    expect(formatTripRangeShort("2026-07-30", "2026-08-02")).toBe("7/30~8/2");
    expect(formatTripRangeShort("2026-07-20", "2026-07-20")).toBe("7/20");
    expect(formatTripRangeShort("2026-07-20", null)).toBe("7/20");
    expect(formatTripRangeShort(null, null)).toBeNull();
  });
});

describe("unassignedNote", () => {
  it("여행 0개 → 만들면 자동으로 붙어요 (여행 만들기)", () => {
    const n = unassignedNote({ hasTrips: false });
    expect(n.message).toBe("여행을 만들면 자동으로 붙어요");
    expect(n.showCreateTrip).toBe(true);
    expect(unassignedNote({ hasTrips: true, reason: "no_trips" }).showCreateTrip).toBe(
      true
    );
  });

  it("날짜 밖 → ○○ 여행(7/20~23)과 날짜가 달라요", () => {
    const n = unassignedNote({
      hasTrips: true,
      reason: "outside_window",
      suggest: {
        rule: "outside_window",
        destination: "도쿄",
        startDate: "2026-07-20",
        endDate: "2026-07-23",
        diffDays: 40,
      },
    });
    expect(n.message).toBe("도쿄 여행(7/20~23)과 날짜가 달라요. 붙일까요?");
    expect(n.showCreateTrip).toBe(false);
    expect(n.message).not.toContain("여행이 없어서");
  });

  it("날짜 없음 → 여행 날짜를 넣으면 자동으로 붙어요", () => {
    expect(
      unassignedNote({ hasTrips: true, reason: "no_dates" }).message
    ).toBe("여행 날짜를 넣으면 자동으로 붙어요");
  });

  it("여행이 있으면 '여행이 없어서' 문구를 쓰지 않는다", () => {
    for (const reason of [undefined, "no_dates", "outside_window", "unassigned"]) {
      expect(unassignedNote({ hasTrips: true, reason }).message).not.toContain(
        "여행이 없어서"
      );
    }
  });
});