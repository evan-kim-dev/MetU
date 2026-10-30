// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/onboarding/connect/DevCurlFold", () => ({
  DevCurlFold: () => null,
}));

const writeText = vi.fn(async () => undefined);
Object.assign(navigator, {
  clipboard: { writeText },
});

import { UnsupportedHandoff } from "@/components/onboarding/connect/UnsupportedHandoff";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("UnsupportedHandoff", () => {
  it("copies address and has single 나중에 하기", () => {
    const onSkip = vi.fn();
    render(
      <UnsupportedHandoff
        reason="desktop"
        skipBusy={false}
        onSkip={onSkip}
      />
    );
    expect(
      screen.getByText("휴대폰에서 이어서 설정해 주세요")
    ).toBeTruthy();
    const laters = screen.getAllByRole("button", { name: /나중에 하기/ });
    expect(laters).toHaveLength(1);
    expect(screen.queryByText(/건너뛰/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "주소 복사" }));
  });
});
