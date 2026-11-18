// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/agent/inbox",
}));

import { BottomNav } from "@/components/ui/BottomNav";

afterEach(() => cleanup());

describe("BottomNav", () => {
  it("하단은 여행·확인함·내 정보 3탭이에요", () => {
    render(<BottomNav />);
    expect(screen.getByText("여행")).toBeTruthy();
    expect(screen.getByText("확인함")).toBeTruthy();
    expect(screen.getByText("내 정보")).toBeTruthy();
    expect(document.body.textContent).not.toContain("가계부");
    expect(document.body.textContent).not.toContain("멧톡");
    expect(document.body.textContent).not.toContain("홈");
  });

  it("확인함 경로에서 aria-current 를 켜요", () => {
    render(<BottomNav />);
    const inbox = screen.getByText("확인함").closest("a");
    expect(inbox?.getAttribute("href")).toBe("/agent/inbox");
    expect(inbox?.getAttribute("aria-current")).toBe("page");
  });

  it("확인함 링크는 /agent/inbox 를 유지해요", () => {
    render(<BottomNav />);
    expect(screen.getByText("확인함").closest("a")?.getAttribute("href")).toBe(
      "/agent/inbox"
    );
    expect(screen.getByText("여행").closest("a")?.getAttribute("href")).toBe(
      "/trips"
    );
    expect(screen.getByText("내 정보").closest("a")?.getAttribute("href")).toBe(
      "/profile"
    );
  });
});
