// @vitest-environment jsdom
import React from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/lib/trips/TripProvider", () => ({
  useTrips: () => ({
    isReady: true,
    trips: [{ id: "trip-a", destination: "오사카" }],
  }),
}));

vi.mock("@/components/layout/MobileShell", () => ({
  MobileShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

import { AgentRedirect } from "@/app/agent/AgentRedirect";

afterEach(() => {
  cleanup();
  replace.mockClear();
  window.localStorage.clear();
});

describe("AgentRedirect", () => {
  it("여행 1개면 그 여행 요약으로 가요", async () => {
    render(<AgentRedirect />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/trips/trip-a");
    });
  });
});
