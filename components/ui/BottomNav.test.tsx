// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/agent",
}));

vi.mock("@/lib/community/CommunityProvider", () => ({
  useCommunityState: () => ({ posts: [] }),
  useCommunityActions: () => ({
    isPartyHost: () => false,
    isPartyJoined: () => false,
  }),
}));

vi.mock("@/lib/community/useChatRoomSummaries", () => ({
  useChatRoomSummaries: () => ({ unreadCountByPostId: { p1: 3 } }),
}));

import { BottomNav } from "@/components/ui/BottomNav";

afterEach(() => cleanup());

describe("BottomNav", () => {
  it("uses 가계부 label and not Agent", () => {
    render(<BottomNav />);
    expect(screen.getByText("가계부")).toBeTruthy();
    expect(document.body.textContent).not.toContain("Agent");
  });

  it("sets aria-current on active item", () => {
    render(<BottomNav />);
    const agent = screen.getByText("가계부").closest("a");
    expect(agent?.getAttribute("aria-current")).toBe("page");
  });

  it("includes badge count in aria-label", () => {
    // Force unread via mock — opod path
    render(<BottomNav />);
    // With empty posts, unread is 0 from reduce of empty map — mock returns {p1:3}
    // but chatRoomPostIds is empty so summaries may still be called with [].
    // Override: unreadCountByPostId is always returned regardless of ids.
    const opod = screen.getByText("멧톡").closest("a");
    expect(opod?.getAttribute("aria-label")).toBe("멧톡, 새 메시지 3개");
  });
});
