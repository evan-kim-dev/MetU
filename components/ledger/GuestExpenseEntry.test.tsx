// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createProposal = vi.fn();
const listMyProposals = vi.fn();
const getBrowserSupabase = vi.fn(() => ({}));

vi.mock("@/lib/ledger/proposals-client", () => ({
  createProposal: (...a: unknown[]) => createProposal(...a),
  listMyProposals: (...a: unknown[]) => listMyProposals(...a),
  resolveProposal: vi.fn(),
}));
vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabase: () => getBrowserSupabase(),
}));
vi.mock("@/lib/ledger/image", () => ({
  resizeImageToJpeg: async () => new File(["x"], "r.jpg", { type: "image/jpeg" }),
}));
vi.mock("@/components/ds/Sheet", () => ({
  Sheet: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => (open ? <div data-testid="sheet">{children}</div> : null),
}));

import { GuestExpenseEntry } from "@/components/ledger/GuestExpenseEntry";

beforeEach(() => {
  createProposal.mockResolvedValue({
    ok: true,
    row: { id: "p1", status: "pending" },
  });
  listMyProposals.mockResolvedValue([]);
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ error: "not-receipt" }),
  }) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("GuestExpenseEntry", () => {
  it("사진 실패해도 직접 입력으로 제출할 수 있어요", async () => {
    render(
      <GuestExpenseEntry
        tripId="t1"
        members={[
          {
            id: "m1",
            tripId: "t1",
            displayName: "민수",
            isOwner: false,
            userId: "u1",
          },
        ]}
        meId="m1"
        userId="u1"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "내가 냈어요" }));
    await screen.findByTestId("sheet");
    fireEvent.change(screen.getByLabelText("항목"), {
      target: { value: "택시" },
    });
    fireEvent.change(screen.getByLabelText("금액"), {
      target: { value: "3200" },
    });
    fireEvent.click(screen.getByRole("button", { name: "제안 보내기" }));
    await waitFor(() => expect(createProposal).toHaveBeenCalled());
    expect(createProposal.mock.calls[0]![1].draft.label).toBe("택시");
    expect(createProposal.mock.calls[0]![1].draft.source).toBe("guest");
  });
});
