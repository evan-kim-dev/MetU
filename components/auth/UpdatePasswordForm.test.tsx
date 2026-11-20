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
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";

const updatePassword = vi.fn();

vi.mock("@/components/auth/useAuthActions", () => ({
  useAuthActions: () => ({
    updatePassword,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("UpdatePasswordForm", () => {
  beforeEach(() => {
    updatePassword.mockResolvedValue({ ok: true });
  });

  it("규칙·확인이 맞을 때만 저장해요", async () => {
    const onUpdated = vi.fn();
    render(<UpdatePasswordForm onUpdated={onUpdated} />);

    const submit = screen.getByRole("button", {
      name: "비밀번호 저장",
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("새 비밀번호"), {
      target: { value: "Abcd123!" },
    });
    fireEvent.change(screen.getByLabelText("새 비밀번호 확인"), {
      target: { value: "Abcd123!" },
    });
    expect(submit.disabled).toBe(false);

    fireEvent.click(submit);
    await waitFor(() => {
      expect(updatePassword).toHaveBeenCalledWith("Abcd123!");
      expect(onUpdated).toHaveBeenCalled();
    });
  });

  it("확인 불일치면 안내해요", () => {
    render(<UpdatePasswordForm />);
    fireEvent.change(screen.getByLabelText("새 비밀번호"), {
      target: { value: "Abcd123!" },
    });
    fireEvent.change(screen.getByLabelText("새 비밀번호 확인"), {
      target: { value: "other" },
    });
    fireEvent.blur(screen.getByLabelText("새 비밀번호 확인"));
    expect(screen.getByText("비밀번호가 서로 달라요.")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "비밀번호 저장" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });
});
