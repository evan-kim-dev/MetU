import { describe, expect, it } from "vitest";
import {
  evaluatePassword,
  signupPasswordErrorMessage,
} from "@/lib/auth/password-strength";

describe("evaluatePassword", () => {
  it("빈 값은 empty 예요", () => {
    const r = evaluatePassword("");
    expect(r.level).toBe("empty");
    expect(r.score).toBe(0);
    expect(r.meetsSignupPolicy).toBe(false);
  });

  it("짧은 숫자는 위험이에요", () => {
    const r = evaluatePassword("12345");
    expect(r.level).toBe("danger");
    expect(r.label).toBe("위험");
    expect(r.meetsLoginPolicy).toBe(false);
  });

  it("영문+숫자 8자면 보통이에요", () => {
    const r = evaluatePassword("abcdef12");
    expect(r.level).toBe("fair");
    expect(r.label).toBe("보통");
    expect(r.meetsSignupPolicy).toBe(false);
  });

  it("영문+숫자+특수문자 8자면 안전·가입 가능해요", () => {
    const r = evaluatePassword("Abcd123!");
    expect(r.level).toBe("strong");
    expect(r.label).toBe("안전");
    expect(r.meetsSignupPolicy).toBe(true);
    expect(r.meetsLoginPolicy).toBe(true);
  });
});

describe("signupPasswordErrorMessage", () => {
  it("미충족 규칙을 안내해요", () => {
    const msg = signupPasswordErrorMessage("abc");
    expect(msg).toContain("8자 이상");
  });

  it("정책 충족 시 null 이에요", () => {
    expect(signupPasswordErrorMessage("Abcd123!")).toBeNull();
  });
});
