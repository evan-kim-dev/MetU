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
      screen.getByText("먼저 자동 기록 설정부터 해 주세요")
    ).toBeTruthy();
    expect(
      screen.getByText("설정을 마치면 내 여행으로 돌아가요.")
    ).toBeTruthy();
  });

  it("dismiss closes", () => {
    render(<GateNotice gate="1" nextPath={null} />);
    fireEvent.click(screen.getByLabelText("닫기"));
    expect(
      screen.queryByText("먼저 자동 기록 설정부터 해 주세요")
    ).toBeNull();
  });
});
