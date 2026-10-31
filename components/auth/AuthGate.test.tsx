// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AuthGate } from "@/components/auth/AuthGate";

const replace = vi.fn();
let pathname = "/";
const searchParams = new URLSearchParams();
let auth = { isReady: true, isLoggedIn: false };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => pathname,
  useSearchParams: () => searchParams,
}));

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => auth,
}));

function renderAt(path: string) {
  pathname = path;
  return render(
    <AuthGate>
      <p>content</p>
    </AuthGate>
  );
}

describe("AuthGate public paths", () => {
  beforeEach(() => {
    replace.mockClear();
    auth = { isReady: true, isLoggedIn: false };
  });
  afterEach(() => cleanup());

  it.each(["/about", "/s/abc", "/trips/share/abc", "/legal", "/login"])(
    "does not redirect logged-out users on %s",
    (path) => {
      renderAt(path);
      expect(replace).not.toHaveBeenCalled();
      expect(screen.getByText("content")).toBeTruthy();
    }
  );

  it("redirects logged-out users on /trips to /login with next", () => {
    renderAt("/trips");
    expect(replace).toHaveBeenCalledWith("/login?next=%2Ftrips");
  });

  it("keeps /join/<token> behind login and returns to it afterwards", () => {
    renderAt("/join/tok123");
    expect(replace).toHaveBeenCalledWith("/login?next=%2Fjoin%2Ftok123");
  });

  it("renders /about for logged-in users too", () => {
    auth = { isReady: true, isLoggedIn: true };
    renderAt("/about");
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("content")).toBeTruthy();
  });
});
