import { describe, expect, it } from "vitest";

import { interpretReceiptEvent } from "@/lib/ledger/receipt-event";

describe("interpretReceiptEvent", () => {
  it("처리 중이면 pending", () => {
    expect(interpretReceiptEvent("received", null)).toBe("pending");
    expect(interpretReceiptEvent("processing", null)).toBe("pending");
  });

  it("자동 저장되면 saved, 합쳐지면 merged", () => {
    expect(
      interpretReceiptEvent("done", { items: [{ decision: "auto_commit" }] })
    ).toBe("saved");
    expect(
      interpretReceiptEvent("done", { items: [{ decision: "merged" }] })
    ).toBe("merged");
  });

  it("확인 필요/미할당은 review, 무시는 not_receipt, 실패는 failed", () => {
    expect(interpretReceiptEvent("needs_review", { items: [] })).toBe("review");
    expect(interpretReceiptEvent("unassigned", null)).toBe("review");
    expect(interpretReceiptEvent("ignored", { reason: "not_receipt" })).toBe(
      "not_receipt"
    );
    expect(interpretReceiptEvent("failed", null)).toBe("failed");
  });
});
