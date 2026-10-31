import { describe, expect, it } from "vitest";
import {
  AGENT_REASON_MESSAGES,
  agentEventReasonLine,
  agentEventStatusLabel,
  agentEventStatusLabelForUi,
  agentReasonMessage,
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

describe("사유(reason) → 한국어 한 줄", () => {
  const KNOWN = [
    "no_trips",
    "no_dates",
    "outside_window",
    "trip_match_uncertain",
    "no-owner-member",
    "fx_unresolved",
    "commit-failed",
  ] as const;

  it("알려진 사유는 전부 한국어 문구가 있어요", () => {
    for (const code of KNOWN) {
      const message = agentReasonMessage(code);
      expect(message, code).toBeTruthy();
      expect(message, code).toMatch(/[가-힣]/);
    }
    expect(Object.keys(AGENT_REASON_MESSAGES).sort()).toEqual([...KNOWN].sort());
  });

  it("'여행이 없어서' 는 no_trips 에만 나와요", () => {
    for (const code of KNOWN) {
      const has = agentReasonMessage(code)!.includes("여행이 없어서");
      expect(has, code).toBe(code === "no_trips");
    }
  });

  it("unassigned: result.reason 으로 문구를 골라요", () => {
    for (const reason of ["no_trips", "no_dates", "outside_window"] as const) {
      expect(agentEventReasonLine({ status: "unassigned", reason })).toBe(
        AGENT_REASON_MESSAGES[reason]
      );
    }
  });

  it("failed: error 코드로 문구를 골라요 (no-owner-member 등)", () => {
    expect(
      agentEventReasonLine({ status: "failed", error: "no-owner-member" })
    ).toBe(AGENT_REASON_MESSAGES["no-owner-member"]);
    expect(
      agentEventReasonLine({ status: "failed", error: "commit-failed" })
    ).toBe(AGENT_REASON_MESSAGES["commit-failed"]);
  });

  it("needs_review: reasonCode 로 문구를 골라요 (여행 불확실, 환율)", () => {
    expect(
      agentEventReasonLine({
        status: "needs_review",
        reasonCode: "trip_match_uncertain",
      })
    ).toBe(AGENT_REASON_MESSAGES.trip_match_uncertain);
    expect(
      agentEventReasonLine({ status: "needs_review", reasonCode: "fx_unresolved" })
    ).toBe(AGENT_REASON_MESSAGES.fx_unresolved);
  });

  it("reasonCode > reason > error 순서로 알아보는 코드를 써요", () => {
    expect(
      agentEventReasonLine({
        status: "failed",
        reasonCode: "fx_unresolved",
        reason: "no_dates",
        error: "no-owner-member",
      })
    ).toBe(AGENT_REASON_MESSAGES.fx_unresolved);
    expect(
      agentEventReasonLine({
        status: "failed",
        reason: "mystery",
        error: "no-owner-member",
      })
    ).toBe(AGENT_REASON_MESSAGES["no-owner-member"]);
  });

  it("모르는 사유는 상태별 일반 문구로 (원문 코드를 노출하지 않아요)", () => {
    const unassigned = agentEventReasonLine({
      status: "unassigned",
      reason: "mystery",
    });
    const failed = agentEventReasonLine({
      status: "failed",
      error: "TypeError: x is undefined",
    });
    const review = agentEventReasonLine({
      status: "needs_review",
      reasonCode: "mystery",
    });
    expect(unassigned).toBe("수신함에 보관했어요. 여행에 붙여 주세요");
    expect(failed).toBe("처리하지 못했어요. 다시 처리해 주세요");
    expect(review).toBe("확인이 필요해요");
    expect(unassigned).not.toContain("mystery");
    expect(failed).not.toContain("TypeError");
    expect(unassigned).not.toContain("여행이 없어서");
  });

  it("prototype 키 같은 이상한 코드는 알려진 사유로 오해하지 않아요", () => {
    for (const code of ["constructor", "__proto__", "toString", ""]) {
      expect(agentReasonMessage(code), code).toBeNull();
    }
    expect(agentReasonMessage(null)).toBeNull();
    expect(agentReasonMessage(undefined)).toBeNull();
  });

  it("done/ignored/received 와 연결 테스트는 사유 줄이 없어요", () => {
    for (const status of ["done", "ignored", "received", "processing"]) {
      expect(agentEventReasonLine({ status, reason: "no_trips" })).toBeNull();
    }
    expect(
      agentEventReasonLine({
        status: "unassigned",
        reason: "no_trips",
        isTest: true,
      })
    ).toBeNull();
  });
});