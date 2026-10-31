// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConnectHub } from "@/components/onboarding/connect/ConnectHub";

afterEach(() => {
  cleanup();
});

describe("ConnectHub", () => {
  it("shows connected copy and choices (no issue CTA)", () => {
    const onVerify = vi.fn();
    const onAddDevice = vi.fn();
    const onReissue = vi.fn();

    render(
      <ConnectHub
        uiState="ok"
        activeTokenCount={2}
        lastNotificationAt="2026-10-31T00:00:00.000Z"
        pasteHref="/agent"
        onVerify={onVerify}
        onAddDevice={onAddDevice}
        onReissue={onReissue}
      />
    );

    expect(screen.getByText("자동 기록이 연결되어 있어요")).toBeTruthy();
    expect(screen.getByText(/활성 연결 코드 2개/)).toBeTruthy();
    expect(screen.queryByText("연결 코드 만들기")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "연결 상태 확인하기" }));
    fireEvent.click(screen.getByRole("button", { name: "다른 기기 추가하기" }));
    fireEvent.click(
      screen.getByRole("button", { name: "이 기기 연결 코드 다시 만들기" })
    );
    expect(onVerify).toHaveBeenCalledOnce();
    expect(onAddDevice).toHaveBeenCalledOnce();
    expect(onReissue).toHaveBeenCalledOnce();

    expect(screen.getByRole("link", { name: "연동 가이드 보기" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "가계부에서 따로 연결" })
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "직접 붙여넣기로 기록" })
    ).toBeTruthy();
  });

  it("unverified title", () => {
    render(
      <ConnectHub
        uiState="unverified"
        activeTokenCount={1}
        lastNotificationAt={null}
        pasteHref="/trips/abc/ledger"
        onVerify={() => undefined}
        onAddDevice={() => undefined}
        onReissue={() => undefined}
      />
    );
    expect(screen.getByText("연결을 확인해야 해요")).toBeTruthy();
  });
});
