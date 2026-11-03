// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const useAutomationStatus = vi.fn();
vi.mock("@/lib/hooks/useAutomationStatus", () => ({
  useAutomationStatus: (...a: unknown[]) => useAutomationStatus(...a),
}));

import { ConnectStep } from "./ConnectStep";

const refresh = vi.fn();

function status(over: Record<string, unknown>) {
  useAutomationStatus.mockReturnValue({
    data: null,
    error: null,
    loading: false,
    refresh,
    uiState: null,
    ...over,
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ConnectStep", () => {
  it("불러오는 중엔 aria-busy 스켈레톤을 보여 줘요", () => {
    status({ loading: true });
    render(<ConnectStep tripId="t1" onLater={vi.fn()} />);
    expect(screen.getByLabelText("자동 수집 상태 불러오는 중").getAttribute("aria-busy")).toBe(
      "true"
    );
    expect(useAutomationStatus).toHaveBeenCalledWith({ lite: true });
  });

  it("오류면 다시 시도로 refresh 를 부르고, 나중에도 고를 수 있어요", () => {
    const onLater = vi.fn();
    status({ error: { message: "x" } });
    render(<ConnectStep tripId="t1" onLater={onLater} />);
    expect(screen.getByRole("heading", { name: "연결 상태를 불러오지 못했어요" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(refresh).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "나중에 직접 입력할게요" }));
    expect(onLater).toHaveBeenCalledTimes(1);
  });

  it("연결됐으면 마지막 수신 시각과 관리 링크를 보여 줘요", () => {
    status({
      data: {
        hasActiveToken: true,
        lastNotificationAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      },
      uiState: "ok",
    });
    render(<ConnectStep tripId="t1" onLater={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "자동 수집이 켜져 있어요" })).toBeTruthy();
    expect(screen.getByText("마지막 수신 5분 전")).toBeTruthy();
    expect(screen.getByRole("link", { name: "관리" }).getAttribute("href")).toBe(
      "/trips/t1/ledger/connect"
    );
    expect(screen.queryByRole("button", { name: "나중에 직접 입력할게요" })).toBeNull();
  });

  it("연결됐지만 알림이 아직 없으면 기다리는 문구예요", () => {
    status({ data: { hasActiveToken: true, lastNotificationAt: null }, uiState: "unverified" });
    render(<ConnectStep tripId="t1" onLater={vi.fn()} />);
    expect(screen.getByText(/카드 결제 알림이 오면 여기에 바로 쌓여요/)).toBeTruthy();
  });

  it("미연결이면 안내 + 나중에 직접 입력할게요로 초대 단계로 넘어가요", () => {
    const onLater = vi.fn();
    status({ data: { hasActiveToken: false, lastNotificationAt: null }, uiState: "off" });
    render(<ConnectStep tripId="t1" onLater={onLater} />);
    expect(
      screen.getByRole("heading", { name: "카드 알림을 연결하면 입력 없이 기록돼요" })
    ).toBeTruthy();
    const later = screen.getByRole("button", { name: "나중에 직접 입력할게요" });
    expect(later.className).toContain("min-h-tap");
    fireEvent.click(later);
    expect(onLater).toHaveBeenCalledTimes(1);
  });
});
