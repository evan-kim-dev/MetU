import { describe, expect, it } from "vitest";
import {
  deriveGuestDefaultStep,
  deriveHostDefaultStep,
  deriveJourney,
  resolveStepParam,
  type DeriveJourneyInput,
} from "./journey-state";

const base: Omit<DeriveJourneyInput, "role"> = {
  automation: "connected",
  memberCount: 2,
  expenseCount: 3,
  pendingReviewCount: 0,
  pendingProposalCount: 0,
  settlement: null,
};

describe("deriveHostDefaultStep", () => {
  it("open & 미송금 > 0 → pay", () => {
    expect(
      deriveHostDefaultStep({
        ...base,
        settlement: { status: "open", transfersTotal: 4, transfersPaid: 1 },
      })
    ).toBe("pay");
  });

  it("completed → pay", () => {
    expect(
      deriveHostDefaultStep({
        ...base,
        settlement: { status: "completed", transfersTotal: 2, transfersPaid: 2 },
      })
    ).toBe("pay");
  });

  it("stale → settle", () => {
    expect(
      deriveHostDefaultStep({
        ...base,
        settlement: { status: "stale", transfersTotal: 2, transfersPaid: 0 },
      })
    ).toBe("settle");
  });

  it("지출0 & automation off → connect", () => {
    expect(
      deriveHostDefaultStep({
        ...base,
        expenseCount: 0,
        automation: "off",
        memberCount: 1,
      })
    ).toBe("connect");
  });

  it("automation unknown 이면 connect로 강제하지 않음", () => {
    expect(
      deriveHostDefaultStep({
        ...base,
        expenseCount: 0,
        automation: "unknown",
        memberCount: 1,
      })
    ).toBe("invite");
  });

  it("지출0 & 멤버1 → invite", () => {
    expect(
      deriveHostDefaultStep({
        ...base,
        expenseCount: 0,
        automation: "connected",
        memberCount: 1,
      })
    ).toBe("invite");
  });

  it("지출0 & 멤버≥2 → record", () => {
    expect(
      deriveHostDefaultStep({
        ...base,
        expenseCount: 0,
        automation: "connected",
        memberCount: 2,
      })
    ).toBe("record");
  });

  it("멤버1 (지출 있음) → invite", () => {
    expect(
      deriveHostDefaultStep({
        ...base,
        expenseCount: 2,
        memberCount: 1,
      })
    ).toBe("invite");
  });

  it("확인필요>0 → record", () => {
    expect(
      deriveHostDefaultStep({
        ...base,
        pendingReviewCount: 2,
      })
    ).toBe("record");
  });

  it("제안대기>0 → record", () => {
    expect(
      deriveHostDefaultStep({
        ...base,
        pendingProposalCount: 1,
      })
    ).toBe("record");
  });

  it("그 외 → settle", () => {
    expect(deriveHostDefaultStep(base)).toBe("settle");
  });
});

describe("deriveJourney host statuses", () => {
  it("adjust는 항상 todo(선택) 라벨", () => {
    const r = deriveJourney({ role: "host", ...base });
    const adjust = r.steps.find((s) => s.key === "adjust");
    expect(adjust?.label).toContain("선택");
    expect(adjust?.status).toBe("todo");
  });

  it("invite done when memberCount≥2", () => {
    const r = deriveJourney({ role: "host", ...base, memberCount: 2 });
    // default is settle, invite should be done
    expect(r.steps.find((s) => s.key === "invite")?.status).toBe("done");
  });

  it("stale settle → attention on settle when current", () => {
    const r = deriveJourney({
      role: "host",
      ...base,
      settlement: { status: "stale", transfersTotal: 1, transfersPaid: 0 },
    });
    expect(r.defaultStep).toBe("settle");
    expect(r.steps.find((s) => s.key === "settle")?.status).toBe("attention");
  });
});

describe("resolveStepParam", () => {
  it("무효 step → default", () => {
    expect(resolveStepParam("hack", "record", "host")).toBe("record");
  });

  it("유효 host step 유지", () => {
    expect(resolveStepParam("invite", "record", "host")).toBe("invite");
  });
});

describe("deriveGuestDefaultStep", () => {
  it("정산 없으면 share", () => {
    expect(deriveGuestDefaultStep(base)).toBe("share");
  });

  it("open & 미송금 → pay", () => {
    expect(
      deriveGuestDefaultStep({
        ...base,
        settlement: { status: "open", transfersTotal: 2, transfersPaid: 0 },
      })
    ).toBe("pay");
  });

  it("completed → done", () => {
    expect(
      deriveGuestDefaultStep({
        ...base,
        settlement: { status: "completed", transfersTotal: 2, transfersPaid: 2 },
      })
    ).toBe("done");
  });
});

describe("deriveJourney guest", () => {
  it("defaults to share with 4 steps", () => {
    const r = deriveJourney({ role: "guest", ...base });
    expect(r.defaultStep).toBe("share");
    expect(r.steps).toHaveLength(4);
  });

  it("게스트가 host step 요청하면 resolve가 기본으로", () => {
    expect(resolveStepParam("record", "share", "guest")).toBe("share");
  });
});
