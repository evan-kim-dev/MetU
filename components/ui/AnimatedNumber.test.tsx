// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

describe("AnimatedNumber", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("0 이하면 ₩0 을 보여 줘요", () => {
    render(<AnimatedNumber value={0} />);
    expect(screen.getByText("₩0")).toBeTruthy();
  });

  it("reduced-motion 이면 즉시 최종 금액을 보여 줘요", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    );
    render(<AnimatedNumber value={12000} />);
    expect(screen.getByText("₩12,000")).toBeTruthy();
  });
});
