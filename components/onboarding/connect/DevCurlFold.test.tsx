// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/fetch-json", () => ({
  apiFetchJson: vi.fn(),
}));

vi.mock("@/components/onboarding/guide/DevSnippet", () => ({
  DevSnippet: () => <div>dev-snippet-mock</div>,
}));

import { DevCurlFold } from "@/components/onboarding/connect/DevCurlFold";

afterEach(() => cleanup());

describe("DevCurlFold", () => {
  it("hides curl content while collapsed", () => {
    render(<DevCurlFold />);
    const details = screen.getByText("개발자용 (curl로 연결 테스트)").closest(
      "details"
    );
    expect(details).toBeTruthy();
    expect(details?.open).toBeFalsy();
    expect(screen.queryByText(/curl -X POST/i)).toBeNull();
  });
});
