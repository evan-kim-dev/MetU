// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExpenseMemberChips } from "@/components/ledger/ExpenseMemberChips";

const members = [
  { id: "a", tripId: "t", displayName: "민수", isOwner: true, userId: "u1" },
  { id: "b", tripId: "t", displayName: "지영", isOwner: false, userId: "u2" },
];

afterEach(() => cleanup());

describe("ExpenseMemberChips", () => {
  it("참여/제외/비활성 상태와 aria-pressed", () => {
    const onToggle = vi.fn();
    render(
      <ExpenseMemberChips
        members={members}
        shares={{ a: 10000, b: 0 }}
        interactiveMemberIds={new Set(["a"])}
        onToggle={onToggle}
      />
    );
    const mine = screen.getByRole("button", { name: /민수, 참여 중/ });
    const other = screen.getByRole("button", { name: /지영, 제외됨/ });
    expect(mine.getAttribute("aria-pressed")).toBe("true");
    expect(other.getAttribute("aria-pressed")).toBe("false");
    expect((other as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(mine);
    expect(onToggle).toHaveBeenCalledWith("a", "exclude");
  });
});
