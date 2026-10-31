// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabase: () => ({ rpc: (...a: unknown[]) => rpc(...a) }),
}));
vi.mock("@/components/trips/ledger/MemberManager", () => ({
  MemberManager: () => null,
}));
vi.mock("@/components/trips/ledger/ExpenseForm", () => ({
  ExpenseForm: () => null,
}));
vi.mock("@/components/trips/ledger/NaturalExpenseInput", () => ({
  NaturalExpenseInput: () => null,
}));

import { LedgerTab } from "@/components/trips/ledger/LedgerTab";

afterEach(() => {
  cleanup();
  rpc.mockReset();
});

const TRIP = "22222222-2222-4222-8222-222222222222";

function renderTab(props: { canInvite?: boolean; readOnly?: boolean }) {
  return render(
    <LedgerTab
      tripId={TRIP}
      members={[
        { id: "m1", tripId: TRIP, displayName: "민수", isOwner: true, userId: "u-a" },
      ]}
      expenses={[]}
      totalKrw={0}
      defaultCurrency="KRW"
      placeOptions={[]}
      settlement={{ balances: {}, transfers: [] }}
      {...props}
    />
  );
}

describe("LedgerTab 초대 패널", () => {
  it("소유자(canInvite)에게는 초대 버튼이 보이고 누르면 create_trip_invite 를 호출한다", async () => {
    rpc.mockResolvedValue({ data: "tok", error: null });
    renderTab({ canInvite: true });

    fireEvent.click(screen.getByRole("button", { name: "동행자 초대" }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("create_trip_invite", { p_trip_id: TRIP })
    );
  });

  it("합류한 멤버(비소유자)에게는 초대 버튼이 없다", () => {
    renderTab({ canInvite: false });
    expect(screen.queryByRole("button", { name: "동행자 초대" })).toBeNull();
    expect(screen.queryByLabelText("동행자 초대")).toBeNull();
  });

  it("읽기 전용 화면에서는 canInvite 여도 보이지 않는다", () => {
    renderTab({ canInvite: true, readOnly: true });
    expect(screen.queryByRole("button", { name: "동행자 초대" })).toBeNull();
  });
});
