import { describe, expect, it } from "vitest";

import {
  ProposalInputSchema,
  proposalToDraft,
  TOO_MANY_PENDING_MESSAGE,
} from "./proposals";

describe("ProposalInputSchema", () => {
  it("rejects 0 / negative / 4-letter currency / 81-char label", () => {
    expect(
      ProposalInputSchema.safeParse({
        label: "택시",
        amount: 0,
        currency: "KRW",
      }).success
    ).toBe(false);
    expect(
      ProposalInputSchema.safeParse({
        label: "택시",
        amount: -1,
        currency: "KRW",
      }).success
    ).toBe(false);
    expect(
      ProposalInputSchema.safeParse({
        label: "택시",
        amount: 10,
        currency: "KRWX",
      }).success
    ).toBe(false);
    expect(
      ProposalInputSchema.safeParse({
        label: "x".repeat(81),
        amount: 10,
        currency: "KRW",
      }).success
    ).toBe(false);
  });

  it("accepts 2-decimal positive amount", () => {
    const parsed = ProposalInputSchema.safeParse({
      label: "택시",
      amount: 12.5,
      currency: "jpy",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.currency).toBe("JPY");
      expect(parsed.data.amount).toBe(12.5);
    }
  });
});

describe("proposalToDraft", () => {
  it("sets payer to proposer and participants to all; no KRW conversion", () => {
    const draft = proposalToDraft(
      {
        label: "택시",
        amount: 3200,
        currency: "JPY",
        category: "교통",
        spentOn: "2026-11-03",
        note: null,
        items: [],
        source: "guest",
        proposerMemberId: "m-guest",
      },
      [
        {
          id: "m-host",
          tripId: "t1",
          displayName: "나",
          isOwner: true,
          userId: "u1",
        },
        {
          id: "m-guest",
          tripId: "t1",
          displayName: "민수",
          isOwner: false,
          userId: "u2",
        },
      ]
    );
    expect(draft.payerMemberId).toBe("m-guest");
    expect(draft.participantMemberIds).toEqual(["m-host", "m-guest"]);
    expect(draft.amount).toBe(3200);
    expect(draft.currency).toBe("JPY");
    expect(draft).not.toHaveProperty("krwAmount");
  });
});

describe("too-many-pending copy", () => {
  it("has Korean guidance", () => {
    expect(TOO_MANY_PENDING_MESSAGE).toMatch(/대기 중인 제안/);
  });
});
