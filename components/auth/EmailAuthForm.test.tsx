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

function typeValidEmail(value = "a@b.com") {
  const email = screen.getByLabelText("이메일");
  fireEvent.change(email, { target: { value } });
  // 비밀번호 단계는 이메일 blur/Enter 후에만 열려요.
  fireEvent.blur(email);
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
  });

  it("starts with email only until a valid email is entered", () => {
    render(<EmailAuthForm />);
    expect(screen.getByLabelText("이메일")).toBeTruthy();
    expect(screen.queryByLabelText("비밀번호")).toBeNull();
    expect(screen.queryByRole("tab", { name: "로그인" })).toBeNull();
    expect(document.querySelector('button[type="submit"]')).toBeNull();

    const email = screen.getByLabelText("이메일");
    fireEvent.change(email, { target: { value: "user@gmail.c" } });
    expect(screen.queryByLabelText("비밀번호")).toBeNull();

    fireEvent.change(email, { target: { value: "user@gmail.com" } });
    expect(screen.queryByLabelText("비밀번호")).toBeNull();

    fireEvent.blur(email);

    expect(screen.getByLabelText("비밀번호")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "로그인" })).toBeTruthy();
    expect(
      screen.queryByText("이메일과 비밀번호(6자 이상)를 입력해 주세요.")
    ).toBeNull();
    const submit = document.querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
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
    fireEvent.click(screen.getByRole("tab", { name: "회원가입" }));
    fireEvent.change(screen.getByLabelText("비밀번호"), {
      target: { value: "123456" },
    });
    expect(screen.getByText("위험")).toBeTruthy();
    expect(screen.getByRole("meter", { name: "비밀번호 보안 강도" })).toBeTruthy();
    expect(screen.getByLabelText("비밀번호 규칙")).toBeTruthy();
    expect(screen.getByText("8자 이상")).toBeTruthy();
    const submit = screen.getByRole("button", { name: "가입하기" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows inline email validation after blur", () => {
    render(<EmailAuthForm />);
    const email = screen.getByLabelText("이메일");
    fireEvent.change(email, { target: { value: "bad" } });
    fireEvent.blur(email);
    expect(screen.getByText("이메일 형식을 확인해 주세요.")).toBeTruthy();
    expect(screen.queryByLabelText("비밀번호")).toBeNull();
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
    fireEvent.click(screen.getByRole("tab", { name: "회원가입" }));
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
