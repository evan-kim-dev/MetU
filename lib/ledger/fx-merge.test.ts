import { describe, expect, it } from "vitest";
import {
  decideFxMerge,
  DEFAULT_FX_MERGE_BAND,
  effectiveRate,
  findBilledForForeign,
  findForeignForBilled,
  formatDiffPct,
  fxMergeBandFromEnv,
  isBilledInBand,
  marketDiffPct,
  scoreFxMerge,
  type FxMergeBilled,
  type FxMergeForeign,
} from "@/lib/ledger/fx-merge";

const TRIP = "trip-1";

function foreign(over: Partial<FxMergeForeign> = {}): FxMergeForeign & { id: string } {
  return {
    id: "f1",
    tripId: TRIP,
    currency: "JPY",
    marketKrw: 100_000,
    paidAt: "2026-11-03T12:00:00+09:00",
    merchant: "LAWSON",
    billedKrw: null,
    ...over,
  };
}

function billed(over: Partial<FxMergeBilled> = {}): FxMergeBilled & { id: string } {
  return {
    id: "k1",
    tripId: TRIP,
    currency: "KRW",
    krwAmount: 103_000,
    overseas: true,
    paidAt: "2026-11-03T12:10:00+09:00",
    merchant: "LAWSON",
    ...over,
  };
}

describe("fx-merge: 금액 band", () => {
  it("band 안(-1% ~ +5%)이면 후보, 밖이면 후보 아님", () => {
    expect(isBilledInBand(103_000, 100_000)).toBe(true);
    expect(isBilledInBand(99_000, 100_000)).toBe(true); // -1% 경계
    expect(isBilledInBand(105_000, 100_000)).toBe(true); // +5% 경계
    expect(isBilledInBand(98_900, 100_000)).toBe(false);
    expect(isBilledInBand(105_100, 100_000)).toBe(false);
    expect(scoreFxMerge(foreign(), billed({ krwAmount: 106_000 }))).toBeNull();
    expect(scoreFxMerge(foreign(), billed({ krwAmount: 98_000 }))).toBeNull();
  });

  it("환경변수로 band 를 덮어쓰고, 잘못된 값은 기본값", () => {
    expect(fxMergeBandFromEnv({})).toEqual(DEFAULT_FX_MERGE_BAND);
    expect(
      fxMergeBandFromEnv({ FX_MERGE_BAND_LOW: "-0.02", FX_MERGE_BAND_HIGH: "0.08" })
    ).toEqual({ low: -0.02, high: 0.08 });
    expect(
      fxMergeBandFromEnv({ FX_MERGE_BAND_LOW: "0.2", FX_MERGE_BAND_HIGH: "0.1" })
    ).toEqual(DEFAULT_FX_MERGE_BAND);
    expect(fxMergeBandFromEnv({ FX_MERGE_BAND_LOW: "abc" })).toEqual(
      DEFAULT_FX_MERGE_BAND
    );
  });
});

describe("fx-merge: 점수와 자동 병합", () => {
  it("±30분 + band 안이면 점수 0.9 이상으로 자동 병합", () => {
    const c = findForeignForBilled(billed(), [foreign()]);
    expect(c).toHaveLength(1);
    expect(c[0]!.score).toBeGreaterThanOrEqual(0.9);
    const d = decideFxMerge(c);
    expect(d.kind).toBe("auto");
    if (d.kind === "auto") expect(d.target.id).toBe("f1");
  });

  it("정확히 30분은 자동, 31분은 자동 병합하지 않고 사람이 확인", () => {
    const at30 = findForeignForBilled(
      billed({ paidAt: "2026-11-03T12:30:00+09:00" }),
      [foreign()]
    );
    expect(decideFxMerge(at30).kind).toBe("auto");

    const at31 = findForeignForBilled(
      billed({ paidAt: "2026-11-03T12:31:00+09:00" }),
      [foreign()]
    );
    expect(at31).toHaveLength(1);
    const d = decideFxMerge(at31);
    expect(d.kind).toBe("review");
    if (d.kind === "review") expect(d.reason).toBe("time_outside");
  });

  it("시각을 모르면(한쪽이라도) 후보지만 자동 병합하지 않음", () => {
    const c = findForeignForBilled(billed({ paidAt: null }), [foreign()]);
    expect(c).toHaveLength(1);
    expect(c[0]!.timeKnown).toBe(false);
    const d = decideFxMerge(c);
    expect(d.kind).toBe("review");
    if (d.kind === "review") expect(d.reason).toBe("time_unknown");

    const c2 = findForeignForBilled(billed(), [foreign({ paidAt: undefined })]);
    expect(decideFxMerge(c2).kind).toBe("review");
  });

  it("후보가 2건이면 자동 병합하지 않고 review(multiple)", () => {
    const c = findForeignForBilled(billed(), [
      foreign({ id: "f1" }),
      foreign({ id: "f2", marketKrw: 101_000 }),
    ]);
    expect(c).toHaveLength(2);
    const d = decideFxMerge(c);
    expect(d.kind).toBe("review");
    if (d.kind === "review") expect(d.reason).toBe("multiple");
  });

  it("후보가 없으면 none (기존 흐름대로 저장)", () => {
    expect(decideFxMerge([])).toEqual({ kind: "none" });
    expect(
      decideFxMerge(findForeignForBilled(billed({ krwAmount: 200_000 }), [foreign()]))
    ).toEqual({ kind: "none" });
  });

  it("이미 청구액이 합쳐진 F 는 후보가 아님", () => {
    const c = findForeignForBilled(billed(), [foreign({ billedKrw: 103_000 })]);
    expect(c).toHaveLength(0);
    expect(decideFxMerge(c).kind).toBe("none");
  });

  it("같은 통화(KRW↔KRW, 외화↔외화)는 이 경로가 아님", () => {
    expect(
      scoreFxMerge(foreign({ currency: "KRW" }), billed())
    ).toBeNull();
    expect(
      scoreFxMerge(foreign(), billed({ currency: "JPY" }))
    ).toBeNull();
  });

  it("overseas 가 아닌 원화 문자는 병합 대상이 아님", () => {
    expect(scoreFxMerge(foreign(), billed({ overseas: false }))).toBeNull();
  });

  it("다른 여행은 병합하지 않음", () => {
    expect(scoreFxMerge(foreign(), billed({ tripId: "trip-2" }))).toBeNull();
    expect(scoreFxMerge(foreign(), billed({ tripId: null }))).toBeNull();
  });

  it("시각이 36시간 넘게 벌어지면 후보에서 제외", () => {
    expect(
      scoreFxMerge(foreign(), billed({ paidAt: "2026-11-05T12:00:00+09:00" }))
    ).toBeNull();
  });

  it("반대 방향(F 초안 → 기존 K) 도 같은 규칙", () => {
    const c = findBilledForForeign(foreign(), [billed()]);
    expect(c).toHaveLength(1);
    expect(c[0]!.id).toBe("k1");
    expect(decideFxMerge(c).kind).toBe("auto");
  });

  it("상호만 비슷하고 시각·금액이 안 맞으면 점수가 낮아 후보도 아님", () => {
    expect(
      scoreFxMerge(foreign(), billed({ krwAmount: 150_000 }))
    ).toBeNull();
  });
});

describe("fx-merge: 실효 환율과 시장환율 대비 차이", () => {
  it("실효 환율은 청구액 / 외화 금액", () => {
    expect(effectiveRate(103_000, 10_000)).toBe(10.3);
    expect(effectiveRate(0, 10)).toBeNull();
    expect(effectiveRate(1000, 0)).toBeNull();
  });

  it("차이 %는 소수 첫째 자리, 정수 KRW 기준", () => {
    expect(marketDiffPct(103_200, 100_000)).toBe(3.2);
    expect(marketDiffPct(99_600, 100_000)).toBe(-0.4);
    expect(marketDiffPct(100_000, 100_000)).toBe(0);
    expect(marketDiffPct(100, 0)).toBeNull();
  });

  it("표기", () => {
    expect(formatDiffPct(3.2)).toBe("+3.2%");
    expect(formatDiffPct(-0.4)).toBe("-0.4%");
    expect(formatDiffPct(0)).toBe("0.0%");
  });
});
