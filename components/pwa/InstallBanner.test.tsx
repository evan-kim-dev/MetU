// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = {
  user: null as { id: string } | null,
  provider: "guest" as string,
};

vi.mock("next/navigation", () => ({
  usePathname: () => "/login",
}));

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => authState,
}));

import { InstallBanner } from "@/components/pwa/InstallBanner";

describe("InstallBanner", () => {
  beforeEach(() => {
    authState.user = null;
    authState.provider = "guest";
    localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it("renders null on /login", () => {
    const { container } = render(<InstallBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders null when not logged in", () => {
    authState.user = null;
    const { container } = render(<InstallBanner />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(/홈 화면/)).toBeNull();
  });
});
