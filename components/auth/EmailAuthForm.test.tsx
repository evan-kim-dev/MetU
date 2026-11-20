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
const resetPassword = vi.fn();

vi.mock("@/components/auth/useAuthActions", () => ({
  useAuthActions: () => ({
    signInWithKakao: vi.fn(),
    signInWithEmail,
    signUpWithEmail,
    resendConfirmation,
    resetPassword,
    continueAsGuest: vi.fn(),
  }),
}));

function typeValidEmail(value = "a@b.com") {
  fireEvent.change(screen.getByLabelText("아이디"), {
    target: { value },
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("EmailAuthForm", () => {
  beforeEach(() => {
    signInWithEmail.mockResolvedValue({ ok: true });
    signUpWithEmail.mockResolvedValue({ ok: true, status: "signed-in" });
    resetPassword.mockResolvedValue({ ok: true });
  });

  it("처음부터 아이디·비밀번호와 비밀번호 찾기|회원가입을 보여 줘요", () => {
    render(<EmailAuthForm />);
    expect(screen.getByLabelText("아이디")).toBeTruthy();
    expect(screen.getByLabelText("비밀번호")).toBeTruthy();
    expect(screen.getByLabelText("로그인 유지")).toBeTruthy();
    expect(
      (screen.getByLabelText("로그인 유지") as HTMLInputElement).checked
    ).toBe(true);
    expect(screen.getByRole("button", { name: "비밀번호 찾기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "회원가입" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "로그인" })).toBeTruthy();
    expect(screen.queryByRole("tablist")).toBeNull();
    const submit = screen.getByRole("button", {
      name: "로그인",
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it("로그인 유지 토글을 끄면 선호를 저장해요", () => {
    render(<EmailAuthForm />);
    const toggle = screen.getByLabelText("로그인 유지") as HTMLInputElement;
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(false);
    expect(window.localStorage.getItem("metu.auth.remember")).toBe("0");
  });

  it("비밀번호 찾기는 아이디가 있을 때 재설정 메일을 보내요", async () => {
    render(<EmailAuthForm />);
    typeValidEmail("user@example.com");
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 찾기" }));
    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith("user@example.com");
    });
    expect(screen.getByText(/비밀번호 재설정 메일을 보냈어요/)).toBeTruthy();
  });

  it("로그인에서는 보안 강도를 숨겨요", () => {
    render(<EmailAuthForm />);
    typeValidEmail();
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "123" },
    });
    expect(screen.queryByText("위험")).toBeNull();
    expect(
      screen.queryByRole("meter", { name: "비밀번호 보안 강도" })
    ).toBeNull();
  });

  it("회원가입에서만 보안 강도와 규칙을 보여 줘요", () => {
    render(<EmailAuthForm />);
    typeValidEmail();
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "123456" },
    });
    expect(screen.getByText("위험")).toBeTruthy();
    expect(screen.getByRole("meter", { name: "비밀번호 보안 강도" })).toBeTruthy();
    expect(screen.getByLabelText("비밀번호 규칙")).toBeTruthy();
    expect(screen.getByText("8자 이상")).toBeTruthy();
    expect(screen.getByRole("button", { name: "로그인" })).toBeTruthy();
    const submit = screen.getByRole("button", { name: "가입하기" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows inline email validation after blur", () => {
    render(<EmailAuthForm />);
    const email = screen.getByLabelText("아이디");
    fireEvent.change(email, { target: { value: "bad" } });
    fireEvent.blur(email);
    expect(screen.getByText("이메일 형식을 확인해 주세요.")).toBeTruthy();
  });

  it("toggles password visibility", () => {
    render(<EmailAuthForm />);
    typeValidEmail();
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
    typeValidEmail();
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
    typeValidEmail("user@example.com");
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "Abcd123!" },
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
