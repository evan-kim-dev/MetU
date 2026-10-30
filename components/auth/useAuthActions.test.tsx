// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { useAuthActions } from "@/components/auth/useAuthActions";

const loginAsGuest = vi.fn();

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({
    loginWithKakao: vi.fn(),
    loginWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
    resendSignupConfirmation: vi.fn(),
    loginAsGuest,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useAuthActions continueAsGuest", () => {
  it("returns ok:false when guest session save fails", async () => {
    loginAsGuest.mockResolvedValue({
      ok: false,
      error: {
        code: "guest-failed",
        message:
          "둘러보기를 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.",
        retryable: true,
      },
    });

    const { result } = renderHook(() => useAuthActions());
    const out = await result.current.continueAsGuest();
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.code).toBe("guest-failed");
    }
  });

  it("returns ok:true when guest login succeeds", async () => {
    loginAsGuest.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useAuthActions());
    const out = await result.current.continueAsGuest();
    expect(out.ok).toBe(true);
  });
});
