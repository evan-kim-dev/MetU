/** @vitest-environment jsdom */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResumeCard } from "./ResumeCard";
import type { SettlementSnapshot } from "@/lib/ledger/supabase";

afterEach(() => cleanup());

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

function snap(
  partial: Partial<SettlementSnapshot> & Pick<SettlementSnapshot, "status">
): SettlementSnapshot {
  return {
    id: "s1",
    version: 1,
    origin: "manual",
    basisHash: "h",
    shareToken: null,
    transfers: [],
    ...partial,
  };
}

describe("ResumeCard", () => {
  it("기록 단계·확인 건수를 보여 주고 ledger 딥링크는 step 없이 가요", () => {
    render(
      <ResumeCard
        tripId="t1"
        automationUi="ok"
        memberCount={3}
        expenseCount={2}
        pendingReviewCount={2}
        settlement={null}
      />
    );
    expect(screen.getByText("지금 할 일")).toBeTruthy();
    expect(screen.getByText("③ 기록 · 확인할 지출 2건")).toBeTruthy();
    const link = screen.getByRole("link", { name: /이어서 하기/ });
    expect(link.getAttribute("href")).toBe("/trips/t1/ledger");
  });

  it("송금 미완료면 송금 단계 뱃지를 보여 줘요", () => {
    render(
      <ResumeCard
        tripId="t1"
        automationUi="ok"
        memberCount={2}
        expenseCount={4}
        pendingReviewCount={0}
        settlement={snap({
          status: "open",
          transfers: [
            {
              id: "a",
              from: "m1",
              to: "m2",
              krw: 1000,
              status: "pending",
            },
            {
              id: "b",
              from: "m2",
              to: "m1",
              krw: 500,
              status: "paid",
            },
          ],
        })}
      />
    );
    expect(screen.getByText("⑥ 송금 · 1/2")).toBeTruthy();
  });

  it("게스트 문구는 내 몫 보기 CTA", () => {
    render(
      <ResumeCard
        tripId="t1"
        role="guest"
        automationUi={null}
        memberCount={2}
        expenseCount={1}
        pendingReviewCount={0}
        settlement={null}
      />
    );
    expect(screen.getByText("① 내 몫")).toBeTruthy();
    expect(screen.getByRole("link", { name: /내 몫 보기/ })).toBeTruthy();
  });

  it("로딩 중에는 스켈레톤만", () => {
    render(
      <ResumeCard
        tripId="t1"
        automationUi="ok"
        memberCount={null}
        expenseCount={null}
        pendingReviewCount={null}
        settlement={undefined}
        loading
      />
    );
    expect(screen.getByTestId("resume-card").getAttribute("aria-busy")).toBe(
      "true"
    );
    expect(screen.queryByRole("link")).toBeNull();
  });
});
