// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuth = vi.fn();
const fetchUnassignedInboxCount = vi.fn();
const getBrowserSupabase = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/trips",
}));
vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => useAuth(),
}));
vi.mock("@/lib/ledger/inbox-count", () => ({
  fetchUnassignedInboxCount: (...a: unknown[]) =>
    fetchUnassignedInboxCount(...a),
}));
vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabase: () => getBrowserSupabase(),
}));

import { InboxTopButton } from "@/components/ui/InboxTopButton";

beforeEach(() => {
  useAuth.mockReturnValue({
    user: { id: "u1" },
    provider: "kakao",
    isReady: true,
  });
  getBrowserSupabase.mockReturnValue({});
  fetchUnassignedInboxCount.mockResolvedValue(0);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("InboxTopButton", () => {
  it("확인함으로 가는 링크예요", async () => {
    render(<InboxTopButton />);
    const link = await screen.findByRole("link", { name: "확인함" });
    expect(link.getAttribute("href")).toBe("/agent/inbox");
  });

  it("미배정이 있으면 건수를 aria-label 에 넣어요", async () => {
    fetchUnassignedInboxCount.mockResolvedValue(3);
    render(<InboxTopButton />);
    expect(
      await screen.findByRole("link", { name: "확인함 3건" })
    ).toBeTruthy();
  });
});
