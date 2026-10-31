// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StepVerify } from "@/components/onboarding/connect/StepVerify";
import { AGENT_REASON_MESSAGES } from "@/lib/agent/event-status";
import {
  initialConnectState,
  type ConnectState,
} from "@/lib/onboarding/connect-machine";
import type { AutomationStatusEvent } from "@/lib/hooks/useAutomationStatus";

const STARTED = "2026-10-31T00:00:00.000Z";
const AFTER = "2026-10-31T00:00:05.000Z";
const BEFORE = "2026-10-30T23:00:00.000Z";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function ev(
  over: Partial<AutomationStatusEvent> & { id: string }
): AutomationStatusEvent {
  return {
    status: "done",
    createdAt: AFTER,
    source: "notification",
    tripId: null,
    textPreview: "승인 12,500원 스타벅스",
    error: null,
    reason: null,
    isTest: false,
    ...over,
  };
}

function baseProps(
  overrides: Partial<Omit<React.ComponentProps<typeof StepVerify>, "state">> & {
    state?: Partial<ConnectState>;
  } = {}
) {
  const { state: stateOverride, ...rest } = overrides;
  const state: ConnectState = {
    ...initialConnectState(),
    phase: "verify",
    platform: "ios",
    verifyStartedAt: STARTED,
    ...stateOverride,
  };
  return {
    platform: "ios" as const,
    events: [],
    eventsLoading: false,
    rateSlow: false,
    serverTestError: null,
    waitingMs: 0,
    pollingStopped: false,
    realEvent: null,
    realEventTripLabel: null,
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

function stage(id: string): string | null {
  return screen.getByTestId(id).getAttribute("data-status");
}

describe("StepVerify", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("shows 60s hint", () => {
    render(<StepVerify {...baseProps({ waitingMs: 60_000 })} />);
    expect(screen.getByText(/아직 도착하지 않았어요/)).toBeTruthy();
  });

  it("아무것도 오지 않으면 계속 기다리는 중이에요 (이전 성공 기록이 있어도)", () => {
    render(<StepVerify {...baseProps({ state: { serverOk: true } })} />);
    expect(stage("stage-wait")).toBe("current");
    expect(stage("stage-test")).toBe("pending");
    expect(stage("stage-real")).toBe("pending");
    expect(screen.getByText("알림을 기다리는 중이에요")).toBeTruthy();
    expect(screen.queryByText("완료하고 홈으로")).toBeNull();
  });

  it("연결 테스트(MTU-TEST) 알림이 오면 연결 OK 단계가 완료돼요", () => {
    render(
      <StepVerify
        {...baseProps({
          state: { deviceOk: true, realOk: false },
          events: [
            ev({
              id: "t",
              isTest: true,
              status: "ignored",
              textPreview: "MTU-TEST 연결 확인",
            }),
          ],
        })}
      />
    );
    expect(stage("stage-test")).toBe("done");
    expect(stage("stage-real")).toBe("current");
    expect(screen.getByText("완료하고 홈으로")).toBeTruthy();
    expect(screen.queryByTestId("real-event-result")).toBeNull();
  });

  it("실제 카드 알림: 여행에 붙었어요 / 아직 안 붙었어요", () => {
    const { rerender } = render(
      <StepVerify
        {...baseProps({
          state: { deviceOk: true, realOk: true },
          realEvent: ev({ id: "r", tripId: "trip-1" }),
          realEventTripLabel: "도쿄",
        })}
      />
    );
    expect(stage("stage-real")).toBe("done");
    expect(screen.getByText("여행 도쿄에 붙었어요")).toBeTruthy();

    rerender(
      <StepVerify
        {...baseProps({
          state: { deviceOk: true, realOk: true },
          realEvent: ev({ id: "r", status: "unassigned", tripId: null }),
        })}
      />
    );
    expect(screen.getByText("아직 여행에 안 붙었어요")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "수신함에서 붙이기" }).getAttribute("href")
    ).toBe("/agent/inbox");
  });

  it("안 붙은/실패한 실제 알림은 사유를 한 줄로 알려줘요 (수신함과 같은 문구)", () => {
    const render1 = (e: AutomationStatusEvent) =>
      render(
        <StepVerify
          {...baseProps({ state: { deviceOk: true, realOk: true }, realEvent: e })}
        />
      );

    const a = render1(ev({ id: "r", status: "unassigned", reason: "no_trips" }));
    expect(screen.getByTestId("real-event-reason").textContent).toBe(
      AGENT_REASON_MESSAGES.no_trips
    );
    a.unmount();

    const b = render1(ev({ id: "r", status: "unassigned", reason: "outside_window" }));
    expect(screen.getByTestId("real-event-reason").textContent).toBe(
      AGENT_REASON_MESSAGES.outside_window
    );
    expect(screen.queryByText(/여행이 없어서/)).toBeNull();
    b.unmount();

    const c = render1(ev({ id: "r", status: "failed", error: "no-owner-member" }));
    expect(screen.getByTestId("real-event-reason").textContent).toBe(
      AGENT_REASON_MESSAGES["no-owner-member"]
    );
    c.unmount();

    render1(ev({ id: "r", status: "done", tripId: "trip-1" }));
    expect(screen.queryByTestId("real-event-reason")).toBeNull();
  });

  it("finish buttons: arrived → done", () => {
    render(
      <StepVerify
        {...baseProps({ state: { deviceOk: true, serverOk: false } })}
      />
    );
    expect(screen.getByText("완료하고 홈으로")).toBeTruthy();
  });

  it("finish buttons: 못 받았으면 서버 테스트와 관계없이 '일단 완료'(partial)", () => {
    render(
      <StepVerify
        {...baseProps({ state: { serverOk: true, deviceOk: false } })}
      />
    );
    expect(screen.getByText("일단 완료하고 나중에 확인할게요")).toBeTruthy();
    expect(screen.queryByText("완료하고 홈으로")).toBeNull();
  });

  it("서버 테스트 버튼은 보조로 낮추고 '폰 연결은 아니에요'를 밝혀요", () => {
    const onServerTest = vi.fn();
    render(<StepVerify {...baseProps({ onServerTest })} />);
    const btn = screen.getByRole("button", {
      name: "서버만 확인(폰 연결은 아니에요)",
    });
    fireEvent.click(btn);
    expect(onServerTest).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("서버 테스트 보내기")).toBeNull();
  });

  it("서버 테스트가 통과해도 연결됨으로 표시하지 않아요", () => {
    render(<StepVerify {...baseProps({ state: { serverOk: true } })} />);
    expect(screen.getByText(/MetU 서버는 정상이에요/)).toBeTruthy();
    expect(stage("stage-test")).toBe("pending");
    expect(stage("stage-wait")).toBe("current");
  });

  it("polling stopped UI", () => {
    render(<StepVerify {...baseProps({ pollingStopped: true })} />);
    expect(screen.getByText("자동 확인을 멈췄어요")).toBeTruthy();
  });

  it("explains MTU-TEST and shows empty last device event", () => {
    render(<StepVerify {...baseProps()} />);
    expect(screen.getAllByText(/MTU-TEST 연결 확인/).length).toBeGreaterThan(0);
    expect(screen.getByTestId("last-device-event").textContent).toBe(
      "아직 폰에서 받은 알림이 없어요"
    );
  });

  it("does not count a server sim event as a phone-received alert", () => {
    render(
      <StepVerify
        {...baseProps({
          events: [
            ev({
              id: "sim-1",
              status: "ignored",
              source: "sim",
              textPreview: "MTU-TEST-SERVER",
              isTest: true,
            }),
          ],
        })}
      />
    );
    expect(screen.getByTestId("last-device-event").textContent).toBe(
      "아직 폰에서 받은 알림이 없어요"
    );
  });

  it("확인 단계 진입 이전 이벤트는 '마지막으로 받은 알림'에 쓰지 않아요", () => {
    render(
      <StepVerify
        {...baseProps({
          events: [ev({ id: "old", createdAt: BEFORE })],
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
            ev({
              id: "dev-1",
              status: "ignored",
              createdAt: new Date().toISOString(),
              isTest: true,
              textPreview: "MTU-TEST 연결 확인",
            }),
          ],
          state: { verifyStartedAt: "2020-01-01T00:00:00.000Z" },
        })}
      />
    );
    expect(screen.getByTestId("last-device-event").textContent).toMatch(
      /마지막으로 폰에서 받은 알림: .*연결 테스트/
    );
  });
});
