// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listPendingProposals = vi.fn();
const resolveProposal = vi.fn();

vi.mock("@/lib/ledger/proposals-client", () => ({
  listPendingProposals: (...a: unknown[]) => listPendingProposals(...a),
  resolveProposal: (...a: unknown[]) => resolveProposal(...a),
}));
vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabase: () => ({}),
}));
vi.mock("@/components/ledger/ExpenseConfirmSheet", () => ({
  ExpenseConfirmSheet: ({
    onSaved,
  }: {
    onSaved: (row?: { id: string }) => void;
  }) => (
    <button
      type="button"
      onClick={() => onSaved({ id: "exp-1" })}
    >
      확인 저장
    </button>
  ),
}));

import { ProposalInbox } from "@/components/ledger/ProposalInbox";

const members = [
  { id: "m-host", tripId: "t1", displayName: "나", isOwner: true, userId: "u1" },
  {
    id: "m-guest",
    tripId: "t1",
    displayName: "민수",
    isOwner: false,
    userId: "u2",
  },
];

beforeEach(() => {
  listPendingProposals.mockResolvedValue([
    {
      id: "p1",
      tripId: "t1",
      proposedBy: "u2",
      proposerMemberId: "m-guest",
      label: "택시",
      amount: 3200,
      currency: "JPY",
      category: "교통",
      spentOn: "2026-11-03",
      note: null,
      items: [],
      source: "guest",
      status: "pending",
      rejectReason: null,
      resolvedExpenseId: null,
      createdAt: "2026-11-03T00:00:00Z",
    },
  ]);
  resolveProposal.mockResolvedValue({ ok: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProposalInbox", () => {
  it("승인하면 저장 후 resolve(approved)를 호출해요", async () => {
    render(<ProposalInbox tripId="t1" members={members} />);
    await screen.findByText(/민수 · 택시/);
    fireEvent.click(screen.getByRole("button", { name: "승인" }));
    fireEvent.click(screen.getByRole("button", { name: "확인 저장" }));
    await waitFor(() =>
      expect(resolveProposal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          id: "p1",
          decision: "approved",
          expenseId: "exp-1",
        })
      )
    );
  });

  it("거절하면 resolve(rejected)를 호출해요", async () => {
    render(<ProposalInbox tripId="t1" members={members} />);
    await screen.findByText(/민수 · 택시/);
    fireEvent.click(screen.getByRole("button", { name: "거절" }));
    fireEvent.change(screen.getByPlaceholderText("사유 (선택)"), {
      target: { value: "중복이에요" },
    });
    fireEvent.click(screen.getByRole("button", { name: "거절 확정" }));
    await waitFor(() =>
      expect(resolveProposal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          id: "p1",
          decision: "rejected",
          reason: "중복이에요",
        })
      )
    );
  });
});
