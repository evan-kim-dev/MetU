// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { LoginContent } from "@/components/auth/LoginContent";

const replace = vi.fn();
const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: (path: string) => {
      replace(path);
      searchParams.delete("error");
    },
  }),
  useSearchParams: () => searchParams,
}));

vi.mock("@/components/ui/MetULogo", () => ({
  MetULogo: () => <div data-testid="logo" />,
}));

const signInWithKakao = vi.fn();
const continueAsGuest = vi.fn();

vi.mock("@/components/auth/useAuthActions", () => ({
  useAuthActions: () => ({
    signInWithKakao,
    signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
    resendConfirmation: vi.fn(),
    continueAsGuest,
  }),
}));

vi.mock("@/components/auth/EmailAuthForm", () => ({
  EmailAuthForm: ({ onSignedIn }: { onSignedIn?: () => void }) => (
    <button type="button" onClick={() => onSignedIn?.()}>
      mock-email-signed-in
    </button>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  searchParams.forEach((_, key) => searchParams.delete(key));
});

describe("LoginContent", () => {
  beforeEach(() => {
    continueAsGuest.mockResolvedValue({ ok: true });
    signInWithKakao.mockResolvedValue({ ok: true });
    vi.spyOn(window, "setInterval");
  });

  it("shows oauth cancel message and strips error query", async () => {
    searchParams.set("error", "access_denied");
    render(<LoginContent />);

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "로그인을 취소했어요."
      );
    });
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("keeps fixed h1 copy", () => {
    render(<LoginContent />);
    expect(
      screen.getByRole("heading", {
        name: "여행 경비, 같이 쓰고 알아서 정산해요",
      })
    ).toBeTruthy();
    expect(window.setInterval).not.toHaveBeenCalled();
  });

  it("shows guest loading state with aria-busy", async () => {
    let resolveGuest: (value: { ok: true }) => void = () => {};
    continueAsGuest.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGuest = resolve;
        })
    );

    render(<LoginContent />);
    fireEvent.click(
      screen.getByRole("button", { name: "로그인 없이 둘러보기" })
    );

    const busyBtn = screen.getByRole("button", { name: /들어가는 중/ });
    expect(busyBtn.getAttribute("aria-busy")).toBe("true");

    resolveGuest({ ok: true });
    await waitFor(() => {
      expect(replace).toHaveBeenCalled();
    });
  });

  it("updates post-login status after 5 seconds", () => {
    vi.useFakeTimers();
    render(<LoginContent />);
    fireEvent.click(
      screen.getByRole("button", { name: "이메일로 계속하기" })
    );
    fireEvent.click(screen.getByRole("button", { name: "mock-email-signed-in" }));

    expect(screen.getByRole("status").textContent).toContain(
      "로그인했어요. 화면을 불러오는 중이에요…"
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole("status").textContent).toContain(
      "조금 오래 걸리고 있어요. 잠시만 기다려 주세요."
    );
    vi.useRealTimers();
  });

  it("does not use text-2xs classes", () => {
    const { container } = render(<LoginContent />);
    expect(container.querySelector(".text-2xs")).toBeNull();
  });
});
