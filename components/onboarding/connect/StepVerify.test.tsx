// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StepVerify } from "@/components/onboarding/connect/StepVerify";
import {
  initialConnectState,
  type ConnectState,
} from "@/lib/onboarding/connect-machine";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function baseProps(
  overrides: Partial<React.ComponentProps<typeof StepVerify>> & {
    state?: Partial<ConnectState>;
  } = {}
) {
  const { state: stateOverride, ...rest } = overrides;
  const state: ConnectState = {
    ...initialConnectState(),
    phase: "verify",
    platform: "ios",
    ...stateOverride,
  };
  return {
    platform: "ios" as const,
    events: [],
    eventsLoading: false,
    unassignedCount: 0,
    rateSlow: false,
    serverTestError: null,
    waitingMs: 0,
    pollingStopped: false,
    firstEvent: null,
    finishing: false,
    testing: false,
    onServerTest: vi.fn(),
    onRetryServerTest: vi.fn(),
    onResumePolling: vi.fn(),
    onFinishDone: vi.fn(),
    onFinishPartial: vi.fn(),
    ...rest,
    state,
  };
}

describe("StepVerify", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("shows 60s hint", () => {
    render(<StepVerify {...baseProps({ waitingMs: 60_000 })} />);
    expect(
      screen.getByText(/아직 도착하지 않았어요/)
    ).toBeTruthy();
  });

  it("finish buttons: both ok", () => {
    render(
      <StepVerify
        {...baseProps({
          state: {
            ...initialConnectState(),
            phase: "verify",
            serverOk: true,
            deviceOk: true,
          },
        })}
      />
    );
    expect(screen.getByText("완료하고 홈으로")).toBeTruthy();
  });

  it("finish buttons: server only", () => {
    render(
      <StepVerify
        {...baseProps({
          state: {
            ...initialConnectState(),
            phase: "verify",
            serverOk: true,
            deviceOk: false,
          },
        })}
      />
    );
    expect(
      screen.getByText("일단 완료하고 나중에 확인할게요")
    ).toBeTruthy();
  });

  it("finish buttons: none", () => {
    render(<StepVerify {...baseProps()} />);
    expect(screen.queryByText("완료하고 홈으로")).toBeNull();
    expect(
      screen.queryByText("일단 완료하고 나중에 확인할게요")
    ).toBeNull();
  });

  it("arrival banner + unassigned", () => {
    render(
      <StepVerify
        {...baseProps({
          firstEvent: {
            id: "1",
            status: "unassigned",
            createdAt: new Date().toISOString(),
            source: "notification",
            tripId: null,
            textPreview: "승인 테스트 1,000원",
            error: null,
            reason: null,
            isTest: false,
          },
          unassignedCount: 1,
          state: {
            ...initialConnectState(),
            phase: "verify",
            deviceOk: true,
            serverOk: true,
          },
        })}
      />
    );
    expect(screen.getByText("알림이 도착했어요 🎉")).toBeTruthy();
    expect(screen.getByText(/수신함에 보관했어요/)).toBeTruthy();
  });

  it("polling stopped UI", () => {
    render(<StepVerify {...baseProps({ pollingStopped: true })} />);
    expect(screen.getByText("자동 확인을 멈췄어요")).toBeTruthy();
  });

  it("explains MTU-TEST and shows empty last device event", () => {
    render(<StepVerify {...baseProps()} />);
    expect(screen.getByText(/MTU-TEST 연결 확인/)).toBeTruthy();
    expect(screen.getByTestId("last-device-event").textContent).toBe(
      "아직 폰에서 받은 알림이 없어요"
    );
  });

  it("does not count a server sim event as a phone-received alert", () => {
    render(
      <StepVerify
        {...baseProps({
          events: [
            {
              id: "sim-1",
              status: "ignored",
              createdAt: new Date().toISOString(),
              source: "sim",
              tripId: null,
              textPreview: "MTU-TEST-SERVER",
              error: null,
              reason: null,
              isTest: true,
            },
          ],
        })}
      />
    );
    expect(screen.getByTestId("last-device-event").textContent).toBe(
      "아직 폰에서 받은 알림이 없어요"
    );
  });

  it("shows last device event with 연결 테스트 label", () => {
    render(
      <StepVerify
        {...baseProps({
          events: [
            {
              id: "dev-1",
              status: "ignored",
              createdAt: new Date().toISOString(),
              source: "notification",
              tripId: null,
              textPreview: "MTU-TEST 연결 확인",
              error: null,
              reason: null,
              isTest: true,
            },
          ],
        })}
      />
    );
    expect(screen.getByTestId("last-device-event").textContent).toMatch(
      /마지막으로 폰에서 받은 알림: .*연결 테스트/
    );
  });
});
