import { describe, expect, it } from "vitest";

import {
  MY_SHARE_ESTIMATE_HINT,
  resolveMyShare,
} from "./my-share";

describe("resolveMyShare", () => {
  it("confirmed payer shows pay actions", () => {
    const v = resolveMyShare({
      liveBalance: -12000,
      hasSettlement: true,
      stale: false,
    });
    expect(v).toMatchObject({
      amountKrw: 12000,
      kind: "owe",
      mode: "confirmed",
      label: "보낼 돈",
      showPayActions: true,
      hint: null,
    });
  });

  it("confirmed receiver hides pay actions", () => {
    const v = resolveMyShare({
      liveBalance: 8000,
      hasSettlement: true,
      stale: false,
    });
    expect(v.showPayActions).toBe(false);
    expect(v.label).toBe("받을 돈");
    expect(v.kind).toBe("receive");
  });

  it("no settlement shows estimate", () => {
    const v = resolveMyShare({
      liveBalance: -5000,
      hasSettlement: false,
      stale: false,
    });
    expect(v.mode).toBe("estimate");
    expect(v.label).toBe("예상 · 보낼 돈");
    expect(v.hint).toBe(MY_SHARE_ESTIMATE_HINT);
    expect(v.showPayActions).toBe(false);
  });

  it("stale settlement shows estimate", () => {
    const v = resolveMyShare({
      liveBalance: 3000,
      hasSettlement: true,
      stale: true,
    });
    expect(v.mode).toBe("estimate");
    expect(v.label).toBe("예상 · 받을 돈");
    expect(v.showPayActions).toBe(false);
  });

  it("zero balance", () => {
    const v = resolveMyShare({
      liveBalance: 0,
      hasSettlement: true,
      stale: false,
    });
    expect(v).toMatchObject({
      amountKrw: 0,
      kind: "zero",
      mode: "confirmed",
      label: "내 몫",
      showPayActions: false,
    });
  });

  it("null live balance treated as zero estimate when no settlement", () => {
    const v = resolveMyShare({
      liveBalance: null,
      hasSettlement: false,
      stale: false,
    });
    expect(v.amountKrw).toBe(0);
    expect(v.mode).toBe("estimate");
    expect(v.label).toBe("예상 내 몫");
  });
});
