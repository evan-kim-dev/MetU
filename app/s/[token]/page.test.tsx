// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "tok-abc" }),
}));
vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabase: () => ({ rpc: (...a: unknown[]) => rpc(...a) }),
}));

import SharedSettlementPage from "@/app/s/[token]/page";

function detail(over: Record<string, unknown> = {}) {
  return {
    destination: "도쿄",
    dateRange: "2026-07-20 · 3박 4일",
    version: 2,
    status: "open",
    completedAt: null,
    settledAt: "2026-07-24T01:00:00Z",
    members: [
      { id: "m1", displayName: "민수" },
      { id: "m2", displayName: "지영" },
    ],
    transfers: [
      { from: "m2", to: "m1", krw: 5000, status: "pending" },
      { from: "m1", to: "m2", krw: 1000, status: "paid" },
    ],
    totals: { totalKrw: 15000, expenseCount: 2, expensesTruncated: false },
    expenses: [
      {
        id: "e1",
        label: "점심",
        category: "식비",
        spentOn: "2026-07-21",
        paidBy: "m1",
        amount: 10000,
        currency: "KRW",
        fxRateToKrw: 1,
        krwAmount: 10000,
      },
      {
        id: "e2",
        label: "라멘",
        category: "식비",
        spentOn: "2026-07-22",
        paidBy: "m2",
        amount: 500,
        currency: "JPY",
        fxRateToKrw: 10,
        krwAmount: 5000,
      },
    ],
    ...over,
  };
}

beforeEach(() => {
  rpc.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("/s/[token] 공유 정산", () => {
  it("이체 목록과 지출 내역을 보여주고, 합계가 맞으면 일치 문구를 보여준다", async () => {
    rpc.mockResolvedValue({ data: detail(), error: null });
    render(<SharedSettlementPage />);

    expect(await screen.findByText(/도쿄 · 2026-07-20/)).toBeTruthy();
    expect(rpc).toHaveBeenCalledWith("get_shared_settlement_detail", {
      p_token: "tok-abc",
    });

    // 이체: 누가 → 누구에게 + 상태 칩
    expect(screen.getByText("송금 전")).toBeTruthy();
    expect(screen.getByText("송금 완료")).toBeTruthy();
    expect(screen.getByText(/지영 → 민수/)).toBeTruthy();

    // 지출 내역: 이름, 결제자, 외화 원금액·환율, KRW
    const expenses = screen.getByRole("region", { name: "지출 내역" });
    expect(expenses.textContent).toContain("점심");
    expect(expenses.textContent).toContain("민수 결제");
    expect(expenses.textContent).toContain("라멘");
    expect(expenses.textContent).toContain("지영 결제");
    expect(expenses.textContent).toContain("500 JPY");
    expect(expenses.textContent).toContain("환율 10");

    expect(screen.getByTestId("sum-check").textContent).toContain("일치해요");
    expect(screen.queryByText(/최신이 아니에요/)).toBeNull();
  });

  it("지출 합계가 총액과 다르면 경고한다", async () => {
    rpc.mockResolvedValue({
      data: detail({ totals: { totalKrw: 20000, expenseCount: 2 } }),
      error: null,
    });
    render(<SharedSettlementPage />);

    const check = await screen.findByTestId("sum-check");
    expect(check.getAttribute("role")).toBe("alert");
    expect(check.textContent).toContain("달라요");
  });

  it("지출이 일부만 내려오면 합계 대조를 하지 않는다고 알린다", async () => {
    rpc.mockResolvedValue({
      data: detail({
        totals: { totalKrw: 999999, expenseCount: 250, expensesTruncated: true },
      }),
      error: null,
    });
    render(<SharedSettlementPage />);

    const check = await screen.findByTestId("sum-check");
    expect(check.textContent).toContain("250건");
    expect(check.textContent).toContain("대조하지 않았어요");
    expect(check.getAttribute("role")).toBeNull();
  });

  it("superseded 면 최신이 아니라는 배너를 보여준다", async () => {
    rpc.mockResolvedValue({
      data: detail({ status: "superseded" }),
      error: null,
    });
    render(<SharedSettlementPage />);

    expect(await screen.findByText(/이 정산은 최신이 아니에요/)).toBeTruthy();
  });

  it("RPC 가 null 을 주면 링크가 유효하지 않다고 알린다", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    render(<SharedSettlementPage />);

    expect(await screen.findByText("링크가 유효하지 않아요.")).toBeTruthy();
  });

  it("RPC 오류는 불러오기 실패로 알리고 원인은 로그에만 남긴다", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    render(<SharedSettlementPage />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("불러오지 못했어요");
    expect(alert.textContent).not.toContain("boom");
    expect(console.error).toHaveBeenCalled();
  });

  it("응답 형식이 어긋나면 유효하지 않은 링크로 다룬다", async () => {
    rpc.mockResolvedValue({ data: { destination: "도쿄" }, error: null });
    render(<SharedSettlementPage />);
    expect(await screen.findByText("링크가 유효하지 않아요.")).toBeTruthy();
  });

  it("이메일·user_id 같은 개인정보 필드가 와도 화면에 그리지 않는다", async () => {
    rpc.mockResolvedValue({
      data: detail({
        members: [
          { id: "m1", displayName: "민수", email: "secret@example.com", user_id: "uid-1" },
          { id: "m2", displayName: "지영" },
        ],
      }),
      error: null,
    });
    const { container } = render(<SharedSettlementPage />);
    await screen.findByText(/도쿄 · 2026-07-20/);
    expect(container.textContent).not.toContain("secret@example.com");
    expect(container.textContent).not.toContain("uid-1");
  });
});
