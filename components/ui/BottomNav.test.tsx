// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/lib/ledger/use-unassigned-inbox-count", () => ({
  useUnassignedInboxCount: () => 0,
}));

import { BottomNav } from "@/components/ui/BottomNav";

afterEach(() => cleanup());

describe("BottomNav", () => {
  beforeEach(() => {
    cleanup();
  });

  it("하단은 여행·홈·확인함 3탭이에요", () => {
    render(<BottomNav />);
    expect(screen.getByText("여행")).toBeTruthy();
    expect(screen.getByText("홈")).toBeTruthy();
    expect(screen.getByText("확인함")).toBeTruthy();
    expect(document.body.textContent).not.toContain("내 정보");
    expect(document.body.textContent).not.toContain("가계부");
    expect(document.body.textContent).not.toContain("멧톡");
  });

  it("홈 경로에서 aria-current 를 켜요", () => {
    render(<BottomNav />);
    const home = screen.getByText("홈").closest("a");
    expect(home?.getAttribute("href")).toBe("/");
    expect(home?.getAttribute("aria-current")).toBe("page");
  });

  it("탭 링크는 여행·홈·확인함이에요", () => {
    render(<BottomNav />);
    expect(screen.getByText("홈").closest("a")?.getAttribute("href")).toBe(
      "/"
    );
    expect(screen.getByText("여행").closest("a")?.getAttribute("href")).toBe(
      "/trips"
    );
    expect(screen.getByText("확인함").closest("a")?.getAttribute("href")).toBe(
      "/agent/inbox"
    );
  });
});
