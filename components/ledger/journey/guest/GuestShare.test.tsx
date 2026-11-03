// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { GuestShare } from "./GuestShare";

afterEach(() => cleanup());

describe("GuestShare", () => {
  it("보낼 돈이 있으면 송금 CTA 를 보여 줘요", () => {
    const onGoPay = vi.fn();
    render(
      <GuestShare
        tripId="t1"
        myShareKrw={-5000}
        settlementReady
        stale={false}
        onGoPay={onGoPay}
        onGoAdjust={vi.fn()}
        onRefresh={vi.fn()}
      />
    );
    expect(screen.getByRole("heading", { name: "내 몫이에요" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "송금하러 가기" }));
    expect(onGoPay).toHaveBeenCalledTimes(1);
  });

  it("보낼 돈이 없으면 분담 확인 CTA 를 보여 줘요", () => {
    const onGoAdjust = vi.fn();
    render(
      <GuestShare
        tripId="t1"
        myShareKrw={0}
        settlementReady
        stale={false}
        onGoPay={vi.fn()}
        onGoAdjust={onGoAdjust}
        onRefresh={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "내 분담 확인하기" }));
    expect(onGoAdjust).toHaveBeenCalledTimes(1);
  });
});
