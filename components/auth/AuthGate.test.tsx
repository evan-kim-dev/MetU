// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AuthGate } from "@/components/auth/AuthGate";

const replace = vi.fn();
let pathname = "/";
const searchParams = new URLSearchParams();
let auth: {
  isReady: boolean;
  isLoggedIn: boolean;
  user: { id: string; is_anonymous?: boolean } | null;
  isAnonymous: boolean;
  provider: "kakao" | "guest" | "supabase" | null;
} = {
  isReady: true,
  isLoggedIn: false,
  user: null,
  isAnonymous: false,
  provider: null,
};

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
    auth = {
      isReady: true,
      isLoggedIn: false,
      user: null,
      isAnonymous: false,
      provider: null,
    };
  });
  afterEach(() => cleanup());

  it.each(["/", "/about", "/s/abc", "/trips/share/abc", "/legal", "/login"])(
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

  it("opens /join/<token> without login (익명 합류)", () => {
    renderAt("/join/tok123");
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("content")).toBeTruthy();
  });

  it("renders /about for logged-in users too", () => {
    auth = {
      isReady: true,
      isLoggedIn: true,
      user: { id: "u1" },
      isAnonymous: false,
      provider: "kakao",
    };
    renderAt("/about");
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("content")).toBeTruthy();
  });

  it("게스트만 있으면 /login 에 머물러요 (무한 리다이렉트 방지)", () => {
    auth = {
      isReady: true,
      isLoggedIn: true,
      user: null,
      isAnonymous: false,
      provider: "guest",
    };
    renderAt("/login");
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("content")).toBeTruthy();
  });
});
