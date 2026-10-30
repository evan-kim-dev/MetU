import { describe, expect, it } from "vitest";

import { toAutomationUiState } from "@/lib/onboarding/automation-ui-state";

describe("toAutomationUiState", () => {
  const cases: Array<{
    name: string;
    input: Parameters<typeof toAutomationUiState>[0];
    want: ReturnType<typeof toAutomationUiState>;
  }> = [
    {
      name: "no token -> off",
      input: {
        status: "done",
        hasActiveToken: false,
        hasRecentEvent: true,
        lastNotificationAt: null,
      },
      want: "off",
    },
    {
      name: "pending -> off",
      input: {
        status: "pending",
        hasActiveToken: true,
        hasRecentEvent: false,
        lastNotificationAt: null,
      },
      want: "off",
    },
    {
      name: "skipped -> off",
      input: {
        status: "skipped",
        hasActiveToken: true,
        hasRecentEvent: false,
        lastNotificationAt: null,
      },
      want: "off",
    },
    {
      name: "hasRecentEvent -> ok",
      input: {
        status: "partial",
        hasActiveToken: true,
        hasRecentEvent: true,
        lastNotificationAt: null,
      },
      want: "ok",
    },
    {
      name: "partial + server test only (no recent) -> unverified",
      input: {
        status: "partial",
        hasActiveToken: true,
        hasRecentEvent: false,
        lastNotificationAt: null,
      },
      want: "unverified",
    },
    {
      name: "lastNotificationAt without recent -> silent",
      input: {
        status: "done",
        hasActiveToken: true,
        hasRecentEvent: false,
        lastNotificationAt: "2026-10-01T00:00:00Z",
      },
      want: "silent",
    },
    {
      name: "token but never notified -> unverified",
      input: {
        status: "done",
        hasActiveToken: true,
        hasRecentEvent: false,
        lastNotificationAt: null,
      },
      want: "unverified",
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(toAutomationUiState(c.input)).toBe(c.want);
    });
  }
});
