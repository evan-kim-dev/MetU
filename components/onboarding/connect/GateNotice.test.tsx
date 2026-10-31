// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GateNotice } from "@/components/onboarding/connect/GateNotice";

afterEach(() => cleanup());

describe("GateNotice", () => {
  it("hidden without gate=1", () => {
    const { container } = render(<GateNotice gate={null} nextPath={null} />);
    expect(container.textContent).toBe("");
  });

  it("shows copy when gate=1", () => {
    render(<GateNotice gate="1" nextPath="/trips" />);
    expect(
      screen.getByText("자동 기록을 연결해 보세요")
    ).toBeTruthy();
    expect(
      screen.getByText("설정을 마치면 내 여행으로 돌아가요.")
    ).toBeTruthy();
  });

  it("uses soft copy and 가계부 name", () => {
    render(<GateNotice gate="1" nextPath="/agent" />);
    expect(
      screen.getByText(/나중에 해도\s*돼요/)
    ).toBeTruthy();
    expect(screen.getByText("설정을 마치면 가계부로 돌아가요.")).toBeTruthy();
  });

  it("dismiss closes", () => {
    render(<GateNotice gate="1" nextPath={null} />);
    fireEvent.click(screen.getByLabelText("닫기"));
    expect(
      screen.queryByText("자동 기록을 연결해 보세요")
    ).toBeNull();
  });
});
