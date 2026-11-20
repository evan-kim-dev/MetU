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

vi.mock("next/image", () => ({
  default: (props: { alt?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={props.alt ?? ""} data-testid="logo" />
  ),
}));

const signInWithKakao = vi.fn();

vi.mock("@/components/auth/useAuthActions", () => ({
  useAuthActions: () => ({
    signInWithKakao,
    signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
    resendConfirmation: vi.fn(),
    resetPassword: vi.fn(),
  }),
}));

vi.mock("@/components/auth/EmailAuthForm", () => ({
  EmailAuthForm: ({ onSignedIn }: { onSignedIn?: () => void }) => (
    <button type="button" onClick={() => onSignedIn?.()}>
      mock-email-signed-in
    </button>
  ),
}));

vi.mock("@/components/auth/LoginWorldHero", () => ({
  LoginWorldHero: () => <div data-testid="login-world-hero-mock" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  searchParams.forEach((_, key) => searchParams.delete(key));
});

describe("LoginContent", () => {
  beforeEach(() => {
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

  it("shows Nice to Met U lockup and world hero", () => {
    render(<LoginContent />);
    expect(screen.getByLabelText("Nice to Met U")).toBeTruthy();
    expect(screen.getByTestId("login-world-hero-mock")).toBeTruthy();
    expect(window.setInterval).not.toHaveBeenCalled();
  });

  it("does not offer browse-as-guest", () => {
    render(<LoginContent />);
    expect(
      screen.queryByRole("button", { name: "로그인 없이 둘러보기" })
    ).toBeNull();
  });

  it("shows email form first and kakao under 간편로그인", () => {
    render(<LoginContent />);
    expect(
      screen.getByRole("button", { name: "mock-email-signed-in" })
    ).toBeTruthy();
    expect(screen.getByText("또는 간편로그인")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "카카오 간편로그인" })
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "이메일로 계속하기" })
    ).toBeNull();
  });

  it("updates post-login status after 5 seconds", () => {
    vi.useFakeTimers();
    render(<LoginContent />);
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
