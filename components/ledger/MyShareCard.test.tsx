// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MyShareCard } from "@/components/ledger/MyShareCard";
import {
  MY_SHARE_ESTIMATE_HINT,
  MY_SHARE_PAY_HINT,
  resolveMyShare,
} from "@/lib/ledger/my-share";

afterEach(() => cleanup());

describe("MyShareCard", () => {
  it("payer confirmed shows pay hint and actions", () => {
    const view = resolveMyShare({
      liveBalance: -9000,
      hasSettlement: true,
      stale: false,
    });
    render(
      <MyShareCard
        view={view}
        payActions={<button type="button">토스 열기</button>}
      />
    );
    expect(screen.getByText("보낼 돈")).toBeTruthy();
    expect(screen.getByText(MY_SHARE_PAY_HINT)).toBeTruthy();
    expect(screen.getByRole("button", { name: "토스 열기" })).toBeTruthy();
  });

  it("receiver hides pay actions", () => {
    const view = resolveMyShare({
      liveBalance: 4000,
      hasSettlement: true,
      stale: false,
    });
    render(
      <MyShareCard
        view={view}
        payActions={<button type="button">토스 열기</button>}
      />
    );
    expect(screen.getByText("받을 돈")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "토스 열기" })).toBeNull();
  });

  it("no settlement shows estimate copy", () => {
    const view = resolveMyShare({
      liveBalance: -1000,
      hasSettlement: false,
      stale: false,
    });
    render(<MyShareCard view={view} />);
    expect(screen.getByText("예상 · 보낼 돈")).toBeTruthy();
    expect(screen.getByText(MY_SHARE_ESTIMATE_HINT)).toBeTruthy();
  });

  it("stale shows estimate", () => {
    const view = resolveMyShare({
      liveBalance: 2000,
      hasSettlement: true,
      stale: true,
    });
    render(<MyShareCard view={view} />);
    expect(screen.getByText("예상 · 받을 돈")).toBeTruthy();
    expect(screen.getByText(MY_SHARE_ESTIMATE_HINT)).toBeTruthy();
  });

  it("zero confirmed", () => {
    const view = resolveMyShare({
      liveBalance: 0,
      hasSettlement: true,
      stale: false,
    });
    render(<MyShareCard view={view} />);
    expect(screen.getByText("내 몫")).toBeTruthy();
  });
});
