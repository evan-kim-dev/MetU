// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { CopyButton } from "@/components/onboarding/guide/CopyButton";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("CopyButton", () => {
  it("shows success label after clipboard write", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    render(<CopyButton text="hello" label="복사" />);
    fireEvent.click(screen.getByRole("button", { name: "복사" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "복사했어요 ✓" })).toBeTruthy();
    });
  });

  it("falls back to execCommand", async () => {
    Object.assign(navigator, { clipboard: undefined });
    document.execCommand = vi.fn().mockReturnValue(true);
    render(<CopyButton text="hello" />);
    fireEvent.click(screen.getByRole("button", { name: "복사" }));
    await waitFor(() => {
      expect(document.execCommand).toHaveBeenCalledWith("copy");
    });
  });

  it("shows manual hint when copy fails", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    document.execCommand = vi.fn().mockReturnValue(false);
    render(<CopyButton text="hello" />);
    fireEvent.click(screen.getByRole("button", { name: "복사" }));
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toMatch(/길게 눌러/);
    });
  });
});
