// @vitest-environment jsdom
import React from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";

const signInWithEmail = vi.fn();
const signUpWithEmail = vi.fn();
const resendConfirmation = vi.fn();

vi.mock("@/components/auth/useAuthActions", () => ({
  useAuthActions: () => ({
    signInWithKakao: vi.fn(),
    signInWithEmail,
    signUpWithEmail,
    resendConfirmation,
    continueAsGuest: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("EmailAuthForm", () => {
  beforeEach(() => {
    signInWithEmail.mockResolvedValue({ ok: true });
    signUpWithEmail.mockResolvedValue({ ok: true, status: "signed-in" });
  });

  it("shows submit hint when inputs are incomplete", () => {
    render(<EmailAuthForm />);
    expect(
      screen.getByText("이메일과 비밀번호(6자 이상)를 입력해 주세요.")
    ).toBeTruthy();
    const submit = document.querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it("shows inline email validation after blur", () => {
    render(<EmailAuthForm />);
    const email = screen.getByLabelText("이메일");
    fireEvent.change(email, { target: { value: "bad" } });
    fireEvent.blur(email);
    expect(screen.getByText("이메일 형식을 확인해 주세요.")).toBeTruthy();
  });

  it("toggles password visibility", () => {
    render(<EmailAuthForm />);
    const password = screen.getByLabelText("비밀번호") as HTMLInputElement;
    const toggle = screen.getByRole("button", { name: "비밀번호 표시" });
    expect(password.type).toBe("password");
    fireEvent.click(toggle);
    expect(password.type).toBe("text");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });

  it("maps login failure to Korean alert without raw message", async () => {
    signInWithEmail.mockResolvedValue({
      ok: false,
      error: {
        code: "invalid-credentials",
        message: "이메일 또는 비밀번호가 맞지 않아요.",
        retryable: false,
      },
    });

    render(<EmailAuthForm />);
    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "이메일 또는 비밀번호가 맞지 않아요."
      );
    });
    expect(screen.queryByText(/Invalid login/i)).toBeNull();
  });

  it("shows confirm email card and resend cooldown", async () => {
    signUpWithEmail.mockResolvedValue({
      ok: true,
      status: "confirm-email",
      email: "user@example.com",
    });

    render(<EmailAuthForm />);
    fireEvent.click(screen.getByRole("tab", { name: "회원가입" }));
    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "가입하기" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain(
        "확인 메일을 보냈어요"
      );
    });

    const resend = screen.getByRole("button", { name: /다시 보내기 \(60초\)/ });
    expect((resend as HTMLButtonElement).disabled).toBe(true);
  });
});
