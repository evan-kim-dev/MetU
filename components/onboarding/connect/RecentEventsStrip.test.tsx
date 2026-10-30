// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RecentEventsStrip } from "@/components/onboarding/connect/RecentEventsStrip";

afterEach(() => cleanup());

describe("RecentEventsStrip", () => {
  it("shows empty state", () => {
    render(<RecentEventsStrip events={[]} />);
    expect(screen.getByText("최근 받은 알림")).toBeTruthy();
    expect(screen.getByText("아직 받은 알림이 없어요")).toBeTruthy();
  });

  it("announces arrival", () => {
    render(
      <RecentEventsStrip
        events={[
          {
            id: "1",
            status: "done",
            createdAt: new Date().toISOString(),
            source: "notification",
            tripId: null,
            textPreview: "승인 1000원",
            error: null,
            reason: null,
            isTest: false,
          },
        ]}
        prevCount={0}
        announceArrival
      />
    );
    expect(screen.getByText("알림이 도착했어요 🎉")).toBeTruthy();
  });
});
