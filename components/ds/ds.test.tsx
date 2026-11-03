// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  act,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BottomCTA } from "./BottomCTA";
import { MemberChip } from "./MemberChip";
import { ProgressRing } from "./ProgressRing";
import { Sheet } from "./Sheet";
import { Stepper } from "./Stepper";
import { ToastProvider, useToast } from "./Toast";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Stepper", () => {
  it("marks current step with aria-current and exposes labels", () => {
    const onSelect = vi.fn();
    render(
      <Stepper
        currentKey="record"
        onSelect={onSelect}
        steps={[
          { key: "connect", label: "연결", status: "done" },
          { key: "invite", label: "초대", status: "done" },
          { key: "record", label: "기록", status: "current", badge: "확인 필요 2건" },
          { key: "adjust", label: "분담", status: "todo" },
          { key: "settle", label: "정산", status: "todo" },
          { key: "pay", label: "송금", status: "todo" },
        ]}
      />
    );
    const nav = screen.getByRole("navigation", { name: "정산 단계" });
    const current = nav.querySelector('[aria-current="step"]');
    expect(current).toBeTruthy();
    expect(current?.getAttribute("aria-label")).toContain("확인 필요 2건");
    const invite = Array.from(nav.querySelectorAll("button")).find((b) =>
      (b.getAttribute("aria-label") ?? "").startsWith("초대")
    );
    expect(invite).toBeTruthy();
    fireEvent.click(invite!);
    expect(onSelect).toHaveBeenCalledWith("invite");
  });
});

describe("MemberChip", () => {
  it("toggles aria-pressed", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <MemberChip name="민수" selected={false} onToggle={onToggle} />
    );
    const btn = screen.getByRole("button", { name: "민수" });
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalled();
    rerender(<MemberChip name="민수" selected onToggle={onToggle} />);
    expect(
      screen.getByRole("button", { name: "민수" }).getAttribute("aria-pressed")
    ).toBe("true");
  });
});

describe("BottomCTA", () => {
  it("disables and keeps label while loading", () => {
    render(
      <BottomCTA
        label="정산 계산하기"
        onClick={() => {}}
        disabled
        hint="권한이 없어요"
      />
    );
    const btn = screen.getByRole("button", { name: "정산 계산하기" });
    expect(btn).toHaveProperty("disabled", true);
    expect(btn.getAttribute("aria-describedby")).toBe("mu-bottom-cta-hint");
  });

  it("shows spinner but keeps label when loading", () => {
    render(<BottomCTA label="저장하기" onClick={() => {}} loading />);
    expect(screen.getByRole("button", { name: "저장하기" })).toHaveProperty(
      "disabled",
      true
    );
  });
});

describe("ProgressRing", () => {
  it("exposes label and hides when max is 0", () => {
    const { rerender } = render(
      <ProgressRing value={2} max={4} label="송금 2건 중 4건 완료" />
    );
    expect(
      screen.getByRole("img", { name: "송금 2건 중 4건 완료" })
    ).toBeTruthy();
    rerender(<ProgressRing value={0} max={0} />);
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("Sheet", () => {
  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="단계 보기" onClose={onClose}>
        <p>내용</p>
      </Sheet>
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

function ToastProbe() {
  const { show } = useToast();
  return (
    <button type="button" onClick={() => show({ text: "합류했어요" })}>
      토스트
    </button>
  );
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("queues one toast and auto-dismisses", () => {
    render(
      <ToastProvider>
        <ToastProbe />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "토스트" }));
    expect(screen.getByRole("status").textContent).toContain("합류했어요");
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });
});
