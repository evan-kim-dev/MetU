// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

import { GuestDone } from "./GuestDone";

afterEach(() => cleanup());

describe("GuestDone", () => {
  it("완료 요약과 홈 화면 추가 안내를 보여 줘요", () => {
    render(<GuestDone tripId="t1" />);
    expect(screen.getByRole("heading", { name: "정산이 끝났어요" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "여행 요약 보기" }).getAttribute("href")
    ).toBe("/trips/t1/ledger/report");
    expect(screen.getByText(/홈 화면에 추가/)).toBeTruthy();
  });
});
