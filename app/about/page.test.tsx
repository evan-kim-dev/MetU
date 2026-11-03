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
    expect(screen.getByRole("heading", { name: "지금 돼요" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "아직이에요" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: /수익 아이디어/ })
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "개인정보는 이렇게 다뤄요" })
    ).toBeTruthy();
  });

  it("labels revenue ideas as unvalidated", () => {
    render(<AboutPage />);
    expect(
      screen.getByRole("heading", { name: /수익 아이디어 · 검증 전/ })
    ).toBeTruthy();
    expect(screen.getByText(/매출·계약이 있는 내용이 아니에요/)).toBeTruthy();
  });

  it("has no percent or money-amount claims besides the auto-save limit", () => {
    const { container } = render(<AboutPage />);
    const text = (container.textContent ?? "").split(ALLOWED_AMOUNT_TEXT).join("");

    expect(text).not.toContain("%");
    expect(text).not.toMatch(/\d[\d,.]*\s*(원|만|억|조|명|배|초|분|퍼센트|달러|엔)/);
    expect(text).not.toMatch(/[₩$¥€]/);
    expect(container.textContent).toContain(ALLOWED_AMOUNT_TEXT);
  });

  it("does not wrap every block in card chrome", () => {
    const { container } = render(<AboutPage />);
    expect(container.querySelectorAll(".shadow-soft").length).toBe(0);
    expect(container.querySelectorAll(".rounded-xl2").length).toBe(0);
  });
});
