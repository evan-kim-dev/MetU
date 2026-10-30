// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

afterEach(() => cleanup());

describe("PrimaryButton", () => {
  it("disabled includes bg-none", () => {
    render(<PrimaryButton disabled>확인</PrimaryButton>);
    const btn = screen.getByRole("button", { name: "확인" });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(btn.className).toContain("disabled:bg-none");
  });

  it("active has gradient", () => {
    render(<PrimaryButton>활성</PrimaryButton>);
    expect(screen.getByRole("button", { name: "활성" }).className).toContain(
      "ai-gradient-bg"
    );
  });

  it("loading keeps gradient and aria-busy", () => {
    render(<PrimaryButton loading>로딩</PrimaryButton>);
    const btn = screen.getByRole("button", { name: /로딩/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(btn.getAttribute("aria-busy")).toBe("true");
    expect(btn.className).toContain("ai-gradient-bg");
  });

  it("secondary disabled unchanged class presence", () => {
    render(
      <PrimaryButton variant="secondary" disabled>
        취소
      </PrimaryButton>
    );
    expect(screen.getByRole("button", { name: "취소" }).className).toContain(
      "disabled:text-ink-caption"
    );
  });
});
