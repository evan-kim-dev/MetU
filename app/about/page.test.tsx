// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AboutPage from "@/app/about/page";

vi.mock("@/components/layout/MobileShell", () => ({
  MobileShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

/** 자동 저장 한도 안내에 쓰는 문구만 숫자 금액을 허용한다. */
const ALLOWED_AMOUNT_TEXT = "300,000원";

describe("AboutPage", () => {
  afterEach(() => cleanup());

  it("renders the main sections", () => {
    render(<AboutPage />);
    expect(
      screen.getByRole("heading", { name: "어떻게 동작하나요" })
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "지금 되는 것과 아직 안 되는 것" })
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: /수익 아이디어/ })
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "개인정보는 이렇게 다뤄요" })
    ).toBeTruthy();
  });

  it("labels revenue ideas as unvalidated", () => {
    render(<AboutPage />);
    expect(screen.getAllByText("아이디어").length).toBeGreaterThan(0);
    expect(screen.getByText(/검증 전/)).toBeTruthy();
  });

  it("has no percent or money-amount claims besides the auto-save limit", () => {
    const { container } = render(<AboutPage />);
    const text = (container.textContent ?? "").split(ALLOWED_AMOUNT_TEXT).join("");

    expect(text).not.toContain("%");
    expect(text).not.toMatch(/\d[\d,.]*\s*(원|만|억|조|명|배|초|분|퍼센트|달러|엔)/);
    expect(text).not.toMatch(/[₩$¥€]/);
    // 자동 저장 한도는 그대로 노출되어야 한다.
    expect(container.textContent).toContain(ALLOWED_AMOUNT_TEXT);
  });
});
