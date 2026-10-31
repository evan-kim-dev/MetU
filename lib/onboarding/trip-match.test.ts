import { describe, expect, it } from "vitest";

import {
  buildTripSuggest,
  matchTripForEvent,
  readTripMatchRule,
  resolveTripDatesForReceivedAt,
  tripPickToResult,
  type TripMatchCandidate,
} from "@/lib/onboarding/trip-match";

const kst = (iso: string) => Date.parse(iso);

// 합성 여행 (실제 데이터 아님)
function trip(
  id: string,
  startDate: string | null,
  endDate: string | null,
  extra: Partial<TripMatchCandidate> = {}
): TripMatchCandidate {
  return {
    id,
    startDate,
    endDate,
    destination: `도시-${id}`,
    status: "upcoming",
    ...extra,
  };
}

const NOW = kst("2026-07-20T12:00:00+09:00");

describe("matchTripForEvent", () => {
  it("창 안에 여행 1개 → exact", () => {
    const r = matchTripForEvent({
      receivedAtMs: kst("2026-07-21T10:00:00+09:00"),
      nowMs: NOW,
      candidates: [trip("a", "2026-07-20", "2026-07-23")],
    });
    expect(r.rule).toBe("exact");
    expect(r.tripId).toBe("a");
    expect(r.candidates).toEqual([{ tripId: "a", rule: "exact" }]);
  });

  it("창 안 여행이 겹치면 진행 중인 여행이 시작일이 더 가까운 여행보다 우선", () => {
    const r = matchTripForEvent({
      receivedAtMs: kst("2026-07-20T13:00:00+09:00"),
      nowMs: NOW,
      candidates: [
        trip("later", "2026-07-21", "2026-07-30"), // 시작이 더 가깝지만 아직 진행 전
        trip("ongoing", "2026-07-10", "2026-07-25"),
      ],
    });
    expect(r.rule).toBe("exact");
    expect(r.tripId).toBe("ongoing");
    expect(r.candidates.map((c) => c.tripId)).toEqual(["ongoing", "later"]);
  });

  it("같은 날 시작하면 local_currency 가 알림 통화와 같은 쪽이 우선 (최근 생성보다 먼저)", () => {
    const base = { createdAtMs: 1 };
    const r = matchTripForEvent({
      receivedAtMs: kst("2026-07-21T10:00:00+09:00"),
      nowMs: NOW,
      hintCurrency: "jpy",
      candidates: [
        trip("eur", "2026-07-20", "2026-07-23", {
          localCurrency: "EUR",
          createdAtMs: 999,
        }),
        trip("jpy", "2026-07-20", "2026-07-23", {
          localCurrency: "JPY",
          ...base,
        }),
      ],
    });
    expect(r.tripId).toBe("jpy");
  });

  it("통화도 같으면 최근 생성 여행", () => {
    const r = matchTripForEvent({
      receivedAtMs: kst("2026-07-21T10:00:00+09:00"),
      nowMs: NOW,
      candidates: [
        trip("old", "2026-07-20", "2026-07-23", { createdAtMs: 1 }),
        trip("new", "2026-07-20", "2026-07-23", { createdAtMs: 2 }),
      ],
    });
    expect(r.tripId).toBe("new");
  });

  it("출발 5일 전 결제 → near", () => {
    const r = matchTripForEvent({
      receivedAtMs: kst("2026-07-15T09:00:00+09:00"),
      nowMs: NOW,
      candidates: [
        trip("a", "2026-07-20", "2026-07-23"),
        trip("far", "2026-12-01", "2026-12-05"),
      ],
    });
    expect(r.rule).toBe("near");
    expect(r.tripId).toBe("a");
    expect(r.nearest).toMatchObject({ tripId: "a", diffDays: 5, direction: "before" });
  });

  it("귀국 3일 뒤 늦은 승인 → near", () => {
    const r = matchTripForEvent({
      receivedAtMs: kst("2026-07-26T09:00:00+09:00"),
      nowMs: NOW,
      candidates: [
        trip("a", "2026-07-20", "2026-07-23"),
        trip("far", "2026-12-01", "2026-12-05"),
      ],
    });
    expect(r.rule).toBe("near");
    expect(r.tripId).toBe("a");
    expect(r.nearest).toMatchObject({ diffDays: 3, direction: "after" });
  });

  it("출발 40일 전(여행 2개) → none / outside_window, 가장 가까운 여행 정보는 남긴다", () => {
    const r = matchTripForEvent({
      receivedAtMs: kst("2026-06-10T09:00:00+09:00"),
      nowMs: NOW,
      candidates: [
        trip("a", "2026-07-20", "2026-07-23"),
        trip("b", "2026-09-01", "2026-09-05"),
      ],
    });
    expect(r.rule).toBe("none");
    expect(r.tripId).toBeNull();
    expect(r.reason).toBe("outside_window");
    expect(r.nearest).toMatchObject({ tripId: "a", diffDays: 40 });
  });

  it("near 범위 여행이 2개인데 거리가 비슷하면 모호 → none", () => {
    const r = matchTripForEvent({
      receivedAtMs: kst("2026-07-15T09:00:00+09:00"),
      nowMs: NOW,
      candidates: [
        trip("a", "2026-07-20", "2026-07-22"), // 5일 전
        trip("b", "2026-07-21", "2026-07-22"), // 6일 전
      ],
    });
    expect(r.rule).toBe("none");
    expect(r.reason).toBe("outside_window");
  });

  it("near 범위 여행이 2개여도 한쪽이 충분히 가까우면 near", () => {
    const r = matchTripForEvent({
      receivedAtMs: kst("2026-07-17T09:00:00+09:00"),
      nowMs: NOW,
      candidates: [
        trip("a", "2026-07-20", "2026-07-22"), // 3일 전
        trip("b", "2026-07-28", "2026-07-30"), // 11일 전
      ],
    });
    expect(r.rule).toBe("near");
    expect(r.tripId).toBe("a");
  });

  it("활성 여행 1개뿐 + 날짜 해석 실패 → single", () => {
    const r = matchTripForEvent({
      receivedAtMs: kst("2026-07-21T10:00:00+09:00"),
      nowMs: NOW,
      candidates: [trip("only", null, null)],
    });
    expect(r.rule).toBe("single");
    expect(r.tripId).toBe("only");
  });

  it("활성 여행 1개뿐이고 날짜가 멀면 single (날짜 무관)", () => {
    const r = matchTripForEvent({
      receivedAtMs: kst("2026-01-10T10:00:00+09:00"),
      nowMs: NOW,
      candidates: [trip("only", "2026-07-20", "2026-07-23")],
    });
    expect(r.rule).toBe("single");
    expect(r.tripId).toBe("only");
  });

  it("날짜 해석 실패 여행은 near 에서 제외 (여행이 여러 개면 none / no_dates)", () => {
    const r = matchTripForEvent({
      receivedAtMs: kst("2026-07-21T10:00:00+09:00"),
      nowMs: NOW,
      candidates: [trip("x", null, null), trip("y", null, null)],
    });
    expect(r.rule).toBe("none");
    expect(r.reason).toBe("no_dates");
  });

  it("날짜 없는 여행 + 멀리 있는 날짜 여행 → none (single 도 아님)", () => {
    const r = matchTripForEvent({
      receivedAtMs: kst("2026-01-10T10:00:00+09:00"),
      nowMs: NOW,
      candidates: [trip("x", null, null), trip("y", "2026-07-20", "2026-07-23")],
    });
    expect(r.rule).toBe("none");
    expect(r.reason).toBe("outside_window");
  });

  it("completed 여행만 있으면 none / no_trips", () => {
    const r = matchTripForEvent({
      receivedAtMs: kst("2026-07-21T10:00:00+09:00"),
      nowMs: NOW,
      candidates: [trip("done", "2026-07-20", "2026-07-23", { status: "completed" })],
    });
    expect(r.rule).toBe("none");
    expect(r.reason).toBe("no_trips");
  });

  it("여행이 0개 → none / no_trips", () => {
    const r = matchTripForEvent({
      receivedAtMs: NOW,
      nowMs: NOW,
      candidates: [],
    });
    expect(r).toMatchObject({ tripId: null, rule: "none", reason: "no_trips" });
  });

  describe("KST 경계", () => {
    const candidates = [trip("a", "2026-07-20", "2026-07-23")];

    it("2026-07-19T23:59+09:00 은 창(시작-1일) 안 → exact", () => {
      const r = matchTripForEvent({
        receivedAtMs: kst("2026-07-19T23:59:00+09:00"),
        nowMs: NOW,
        candidates,
      });
      expect(r.rule).toBe("exact");
    });

    it("2026-07-18T23:00+09:00 은 창 밖 → exact 아님 (UTC 로 보면 07-18 14:00Z)", () => {
      const r = matchTripForEvent({
        receivedAtMs: kst("2026-07-18T23:00:00+09:00"),
        nowMs: NOW,
        candidates,
      });
      expect(r.rule).not.toBe("exact");
    });

    it("UTC 로 해석하면 안에 들어가지만 KST 로는 밖인 시각(종료+1일 다음 날 01:00 KST)은 exact 아님", () => {
      // 2026-07-24T16:00Z = 2026-07-25 01:00 KST. UTC 날짜는 07-24 라서 틀리게 포함될 수 있다.
      const r = matchTripForEvent({
        receivedAtMs: Date.parse("2026-07-24T16:00:00Z"),
        nowMs: NOW,
        candidates,
      });
      expect(r.rule).not.toBe("exact");
      expect(r.nearest).toMatchObject({ diffDays: 2, direction: "after" });
    });

    it("UTC 로는 전날이지만 KST 로는 시작-1일 00:30 → exact", () => {
      // 2026-07-18T15:30Z = 2026-07-19 00:30 KST
      const r = matchTripForEvent({
        receivedAtMs: Date.parse("2026-07-18T15:30:00Z"),
        nowMs: NOW,
        candidates,
      });
      expect(r.rule).toBe("exact");
    });

    it("'오늘' 도 Seoul 기준: UTC 7/20 20:00 = KST 7/21 05:00 에 진행 중 판정", () => {
      const r = matchTripForEvent({
        receivedAtMs: kst("2026-07-21T04:00:00+09:00"),
        nowMs: Date.parse("2026-07-20T20:00:00Z"),
        candidates: [
          trip("ended", "2026-07-10", "2026-07-20"), // KST 오늘(7/21)엔 이미 끝남
          trip("ongoing", "2026-07-21", "2026-07-25"),
        ],
      });
      expect(r.tripId).toBe("ongoing");
    });
  });
});

describe("buildTripSuggest / tripPickToResult / readTripMatchRule", () => {
  const cands = [
    trip("a", "2026-07-20", "2026-07-23", { destination: "도쿄" }),
    trip("b", "2026-09-01", "2026-09-05", { destination: "오사카" }),
  ];

  it("붙은 경우 그 여행을 제안", () => {
    const m = matchTripForEvent({
      receivedAtMs: kst("2026-07-15T09:00:00+09:00"),
      nowMs: NOW,
      candidates: cands,
    });
    expect(buildTripSuggest(m, cands)).toMatchObject({
      tripId: "a",
      rule: "near",
      destination: "도쿄",
      startDate: "2026-07-20",
      endDate: "2026-07-23",
      diffDays: 5,
    });
  });

  it("못 붙었지만 날짜 있는 여행이 있으면 가장 가까운 여행을 outside_window 로 제안", () => {
    const m = matchTripForEvent({
      receivedAtMs: kst("2026-06-10T09:00:00+09:00"),
      nowMs: NOW,
      candidates: cands,
    });
    expect(buildTripSuggest(m, cands)).toMatchObject({
      tripId: "a",
      rule: "outside_window",
      diffDays: 40,
    });
  });

  it("여행이 없으면 제안 없음", () => {
    const m = matchTripForEvent({ receivedAtMs: NOW, nowMs: NOW, candidates: [] });
    expect(buildTripSuggest(m, [])).toBeNull();
  });

  it("result 직렬화: 붙은 경우 match.rule, 못 붙은 경우 reason 포함", () => {
    expect(tripPickToResult({ tripId: "a", rule: "single" })).toEqual({
      match: { rule: "single" },
    });
    expect(
      tripPickToResult({ tripId: null, rule: "none", reason: "no_trips" })
    ).toEqual({ match: { rule: "none" }, reason: "no_trips" });
  });

  it("readTripMatchRule: 없거나 이상한 값은 undefined", () => {
    expect(readTripMatchRule(null)).toBeUndefined();
    expect(readTripMatchRule({})).toBeUndefined();
    expect(readTripMatchRule({ match: { rule: "weird" } })).toBeUndefined();
    expect(readTripMatchRule({ match: { rule: "near" } })).toBe("near");
    expect(readTripMatchRule({ items: [], match: { rule: "exact" } })).toBe(
      "exact"
    );
  });
});

describe("resolveTripDatesForReceivedAt", () => {
  it("저장된 컬럼이 있으면 그대로", () => {
    expect(
      resolveTripDatesForReceivedAt(
        { startDate: "2026-07-20", endDate: null, dateRange: "x" },
        NOW
      )
    ).toEqual({ startDate: "2026-07-20", endDate: "2026-07-20" });
  });

  it("연도 없는 지난 날짜는 내년이 아니라 알림이 온 해로 해석", () => {
    expect(
      resolveTripDatesForReceivedAt(
        { dateRange: "7월 20일 - 7월 25일" },
        kst("2026-08-01T09:00:00+09:00")
      )
    ).toEqual({ startDate: "2026-07-20", endDate: "2026-07-25" });
  });

  it("연말→연초 여행: 연초 알림은 전년도 시작으로 해석", () => {
    expect(
      resolveTripDatesForReceivedAt(
        { dateRange: "12월 30일 - 1월 3일" },
        kst("2027-01-01T09:00:00+09:00")
      )
    ).toEqual({ startDate: "2026-12-30", endDate: "2027-01-03" });
    expect(
      resolveTripDatesForReceivedAt(
        { dateRange: "12월 30일 - 1월 3일" },
        kst("2026-12-31T09:00:00+09:00")
      )
    ).toEqual({ startDate: "2026-12-30", endDate: "2027-01-03" });
  });

  it("해석 불가 라벨은 null", () => {
    expect(resolveTripDatesForReceivedAt({ dateRange: "미정" }, NOW)).toBeNull();
    expect(resolveTripDatesForReceivedAt({}, NOW)).toBeNull();
  });
});
