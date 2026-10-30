// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { ShortcutGuide } from "@/components/onboarding/guide/ShortcutGuide";

const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

afterEach(() => {
  cleanup();
  searchParams.delete("platform");
  searchParams.delete("faq");
  localStorage.clear();
});

describe("ShortcutGuide", () => {
  it("renders overview title", () => {
    render(<ShortcutGuide variant="page" />);
    expect(
      screen.getByText("카드 알림을 자동으로 가계부에 넣기")
    ).toBeTruthy();
  });

  it("prefers android platform query", () => {
    searchParams.set("platform", "android");
    render(<ShortcutGuide variant="page" />);
    expect(
      screen.getByRole("tab", { name: "Android" }).getAttribute("aria-selected")
    ).toBe("true");
  });

  it("dev snippet starts collapsed", () => {
    render(<ShortcutGuide variant="page" />);
    const details = screen.getByText("개발자용 설정 보기").closest("details");
    expect(details?.hasAttribute("open")).toBe(false);
  });

  it("hides P4 mistake when revokeOnReissue false", () => {
    render(<ShortcutGuide variant="page" features={{ revokeOnReissue: false }} />);
    expect(
      screen.queryByText(/이previous 코드는 자동으로 사용 중지/)
    ).toBeNull();
    expect(
      screen.queryByText(/이전 코드는 자동으로 사용 중지/)
    ).toBeNull();
  });

  it("shows P4 mistake when revokeOnReissue true", () => {
    render(<ShortcutGuide variant="page" features={{ revokeOnReissue: true }} />);
    expect(
      screen.getByText("(이전 코드는 자동으로 사용 중지돼요).")
    ).toBeTruthy();
  });
});
