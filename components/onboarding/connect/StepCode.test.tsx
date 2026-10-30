// @vitest-environment jsdom
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/onboarding/connect/DevCurlFold", () => ({
  DevCurlFold: () => <div>dev-curl</div>,
}));

import { StepCode } from "@/components/onboarding/connect/StepCode";

afterEach(() => cleanup());

describe("StepCode", () => {
  it("shows needsToken card", () => {
    render(
      <StepCode
        platform="ios"
        token={null}
        copied={false}
        needsToken
        issuing={false}
        reissueOpen={false}
        toast={null}
        onIssue={vi.fn()}
        onCopyResult={vi.fn()}
        onNext={vi.fn()}
        onReissueRequest={vi.fn()}
        onReissueConfirm={vi.fn()}
        onReissueCancel={vi.fn()}
      />
    );
    expect(
      screen.getByText(/연결 코드는 보안상 다시 보여 드릴 수 없어요/)
    ).toBeTruthy();
  });

  it("shows copy success only when copied", () => {
    const { rerender } = render(
      <StepCode
        platform="ios"
        token="metu-AAAA-BBBB-CCCC-DDDD"
        copied={false}
        needsToken={false}
        issuing={false}
        reissueOpen={false}
        toast={null}
        onIssue={vi.fn()}
        onCopyResult={vi.fn()}
        onNext={vi.fn()}
        onReissueRequest={vi.fn()}
        onReissueConfirm={vi.fn()}
        onReissueCancel={vi.fn()}
      />
    );
    expect(
      screen.getByText(/자동 복사가 막혔어요/)
    ).toBeTruthy();
    rerender(
      <StepCode
        platform="ios"
        token="metu-AAAA-BBBB-CCCC-DDDD"
        copied
        needsToken={false}
        issuing={false}
        reissueOpen={false}
        toast={null}
        onIssue={vi.fn()}
        onCopyResult={vi.fn()}
        onNext={vi.fn()}
        onReissueRequest={vi.fn()}
        onReissueConfirm={vi.fn()}
        onReissueCancel={vi.fn()}
      />
    );
    expect(screen.getByText("연결 코드를 복사했어요 ✓")).toBeTruthy();
  });

  it("reissue dialog cancel / ESC", () => {
    const onCancel = vi.fn();
    render(
      <StepCode
        platform="ios"
        token="metu-AAAA-BBBB-CCCC-DDDD"
        copied
        needsToken={false}
        issuing={false}
        reissueOpen
        toast={null}
        onIssue={vi.fn()}
        onCopyResult={vi.fn()}
        onNext={vi.fn()}
        onReissueRequest={vi.fn()}
        onReissueConfirm={vi.fn()}
        onReissueCancel={onCancel}
      />
    );
    expect(screen.getByText("연결 코드를 다시 만들까요?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
