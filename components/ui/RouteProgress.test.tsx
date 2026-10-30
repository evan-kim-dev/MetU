// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import { RouteProgress } from "@/components/ui/RouteProgress";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("RouteProgress", () => {
  it("shows progressbar on internal link click", () => {
    render(
      <div>
        <RouteProgress />
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- click capture test */}
        <a href="/trips">내부여행</a>
      </div>
    );
    act(() => {
      screen.getByRole("link", { name: "내부여행" }).dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
      );
    });
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });

  it("ignores target blank", () => {
    render(
      <div>
        <RouteProgress />
        <a href="/trips" target="_blank" rel="noreferrer">
          새탭
        </a>
      </div>
    );
    act(() => {
      screen.getByRole("link", { name: "새탭" }).dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
      );
    });
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("hides after 10s", () => {
    vi.useFakeTimers();
    render(
      <div>
        <RouteProgress />
        <a href="/agent">에이전트</a>
      </div>
    );
    act(() => {
      screen.getByRole("link", { name: "에이전트" }).dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
      );
    });
    expect(screen.getByRole("progressbar")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});
