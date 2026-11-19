// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenBudgetSuggestionCard } from "@/components/ledger/OpenBudgetSuggestionCard";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("OpenBudgetSuggestionCard", () => {
  it("rebalance 미리보기와 반영 CTA 를 보여 줘요", () => {
    render(
      <OpenBudgetSuggestionCard
        tripId="t1"
        suggestion={{
          id: "s1",
          type: "rebalance",
          message: "식비가 넘었어요",
          createdAt: "",
          overLabels: ["식비"],
          adjustmentsLog: ["점심: 2만원 → 8천원"],
          transferCount: 0,
        }}
        onSettled={vi.fn()}
      />
    );
    expect(screen.getByLabelText("예산 재조정 제안")).toBeTruthy();
    expect(screen.getByText("점심: 2만원 → 8천원")).toBeTruthy();
    expect(screen.getByRole("button", { name: "일정에 반영하기" })).toBeTruthy();
  });

  it("settle 확인은 정산 단계로 보내요", () => {
    const onGoSettle = vi.fn();
    render(
      <OpenBudgetSuggestionCard
        tripId="t1"
        suggestion={{
          id: "s2",
          type: "settle",
          message: "정산 제안",
          createdAt: "",
          overLabels: [],
          adjustmentsLog: [],
          transferCount: 2,
        }}
        onSettled={vi.fn()}
        onGoSettle={onGoSettle}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "정산에서 확인하기" }));
    expect(onGoSettle).toHaveBeenCalledTimes(1);
  });

  it("나중에 누르면 dismiss API 를 호출해요", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);
    const onSettled = vi.fn();
    render(
      <OpenBudgetSuggestionCard
        tripId="t1"
        suggestion={{
          id: "s1",
          type: "rebalance",
          message: "식비가 넘었어요",
          createdAt: "",
          overLabels: [],
          adjustmentsLog: [],
          transferCount: 0,
        }}
        onSettled={onSettled}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "나중에" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0]![0]).toContain(
      "/api/trips/t1/suggestions/s1"
    );
    await waitFor(() => expect(onSettled).toHaveBeenCalled());
  });
});
