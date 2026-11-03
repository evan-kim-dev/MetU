// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

afterEach(() => cleanup());

describe("PrimaryButton", () => {
  it("disabled 는 mu 비활성 토큰을 써요", () => {
    render(<PrimaryButton disabled>확인</PrimaryButton>);
    const btn = screen.getByRole("button", { name: "확인" });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(btn.className).toContain("disabled:bg-mu-sunken");
  });

  it("active 는 플랫 accent (그라디언트 없음)", () => {
    render(<PrimaryButton>활성</PrimaryButton>);
    const cls = screen.getByRole("button", { name: "활성" }).className;
    expect(cls).toContain("bg-mu-accent");
    expect(cls).not.toContain("ai-gradient");
    expect(cls).not.toContain("shadow-glow");
  });

  it("loading 은 aria-busy 와 disabled", () => {
    render(<PrimaryButton loading>로딩</PrimaryButton>);
    const btn = screen.getByRole("button", { name: /로딩/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(btn.getAttribute("aria-busy")).toBe("true");
    expect(btn.className).toContain("bg-mu-accent");
  });

  it("secondary 도 mu 토큰", () => {
    render(
      <PrimaryButton variant="secondary" disabled>
        취소
      </PrimaryButton>
    );
    expect(screen.getByRole("button", { name: "취소" }).className).toContain(
      "bg-mu-card"
    );
  });
});
