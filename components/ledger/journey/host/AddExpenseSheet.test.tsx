// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ledger/ReceiptUploader", () => ({
  ReceiptUploader: ({ onDraft }: { onDraft: (d: unknown) => void }) => (
    <button type="button" onClick={() => onDraft({ merchant: "영수증" })}>
      영수증 촬영하기
    </button>
  ),
}));
vi.mock("@/components/ledger/PasteExpenseBox", () => ({
  PasteExpenseBox: ({
    onDrafts,
    onCancelNotice,
  }: {
    onDrafts: (d: unknown[]) => void;
    onCancelNotice: (d: unknown) => void;
  }) => (
    <>
      <button type="button" onClick={() => onDrafts([{ merchant: "문자" }])}>
        붙여넣기 분석
      </button>
      <button type="button" onClick={() => onCancelNotice({ merchant: "취소" })}>
        취소 문자 분석
      </button>
    </>
  ),
}));
vi.mock("@/components/ledger/VoiceInputButton", () => ({
  VoiceInputButton: () => <button type="button">음성 입력</button>,
}));

import { AddExpenseSheet, type AddExpenseTab } from "./AddExpenseSheet";

function renderSheet(tab: AddExpenseTab | null, extra: Record<string, unknown> = {}) {
  const handlers = {
    onTabChange: vi.fn(),
    onClose: vi.fn(),
    onDrafts: vi.fn(),
    onCancelNotice: vi.fn(),
    onManual: vi.fn(),
  };
  render(<AddExpenseSheet tripId="t1" tab={tab} {...handlers} {...extra} />);
  return handlers;
}

afterEach(() => cleanup());

describe("AddExpenseSheet", () => {
  it("tab 이 null 이면 아무것도 그리지 않아요", () => {
    renderSheet(null);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("3개 탭 중 현재 탭이 선택되고, 다른 탭을 누르면 onTabChange", () => {
    const h = renderSheet("paste");
    expect(screen.getByRole("dialog", { name: "지출 추가" })).toBeTruthy();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["영수증", "붙여넣기·직접", "음성"]);
    expect(screen.getByRole("tab", { name: "붙여넣기·직접" }).getAttribute("aria-selected")).toBe(
      "true"
    );
    fireEvent.click(screen.getByRole("tab", { name: "음성" }));
    expect(h.onTabChange).toHaveBeenCalledWith("voice");
    for (const t of tabs) expect(t.className).toContain("min-h-tap");
  });

  it("붙여넣기 탭: 분석 결과·취소 문자·직접 입력을 부모로 넘겨요", () => {
    const h = renderSheet("paste");
    fireEvent.click(screen.getByRole("button", { name: "붙여넣기 분석" }));
    expect(h.onDrafts).toHaveBeenCalledWith([{ merchant: "문자" }]);
    fireEvent.click(screen.getByRole("button", { name: "취소 문자 분석" }));
    expect(h.onCancelNotice).toHaveBeenCalledWith({ merchant: "취소" });
    fireEvent.click(screen.getByRole("button", { name: "직접 입력할게요" }));
    expect(h.onManual).toHaveBeenCalledTimes(1);
  });

  it("영수증 탭: 초안 1건을 배열로 넘기고, 딥링크면 첫 버튼에 포커스", async () => {
    const h = renderSheet("receipt", { focusFirst: true });
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByText("영수증 촬영하기"))
    );
    fireEvent.click(screen.getByRole("button", { name: "영수증 촬영하기" }));
    expect(h.onDrafts).toHaveBeenCalledWith([{ merchant: "영수증" }]);
  });

  it("ESC 로 닫으면 onClose", () => {
    const h = renderSheet("voice");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(h.onClose).toHaveBeenCalledTimes(1);
  });
});
