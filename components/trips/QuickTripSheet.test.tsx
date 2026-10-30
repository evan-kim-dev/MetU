// @vitest-environment jsdom
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seoulDateIso } from "@/lib/onboarding/trip-window";

const addTrip = vi.fn();

vi.mock("@/lib/trips/TripProvider", () => ({
  useTrips: () => ({ addTrip }),
}));

import { QuickTripSheet } from "@/components/trips/QuickTripSheet";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  document.body.style.overflow = "";
});

beforeEach(() => {
  addTrip.mockImplementation(async (trip: unknown) => trip);
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
});

describe("QuickTripSheet", () => {
  it("shows destination validation error", async () => {
    render(<QuickTripSheet open onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "여행 만들기" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "여행지를 입력해 주세요."
    );
  });

  it("calls addTrip with default 5-day dateRange", async () => {
    const today = seoulDateIso(new Date());
    render(<QuickTripSheet open onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("어디로 가나요?"), {
      target: { value: "도쿄" },
    });
    fireEvent.click(screen.getByRole("button", { name: "여행 만들기" }));
    await waitFor(() => expect(addTrip).toHaveBeenCalled());
    const arg = addTrip.mock.calls[0]![0] as { dateRange: string };
    expect(arg.dateRange).toBe(`${today} · 4박 5일`);
  });

  it("disables stepper at boundaries", () => {
    render(<QuickTripSheet open onClose={() => {}} />);
    const dec = screen.getByRole("button", { name: "하루 줄이기" });
    const inc = screen.getByRole("button", { name: "하루 늘리기" });
    for (let i = 0; i < 10; i++) fireEvent.click(dec);
    expect((dec as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("1일")).toBeTruthy();
    for (let i = 0; i < 40; i++) fireEvent.click(inc);
    expect((inc as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("30일")).toBeTruthy();
  });

  it("shows submitting label while addTrip pending", async () => {
    let resolve!: (v: unknown) => void;
    addTrip.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );
    render(<QuickTripSheet open onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("어디로 가나요?"), {
      target: { value: "도쿄" },
    });
    fireEvent.click(screen.getByRole("button", { name: "여행 만들기" }));
    expect(await screen.findByText("만드는 중…")).toBeTruthy();
    resolve({ id: "t1" });
  });

  it("keeps input and shows error when addTrip rejects", async () => {
    addTrip.mockRejectedValue(new Error("fail"));
    render(<QuickTripSheet open onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("어디로 가나요?"), {
      target: { value: "도쿄" },
    });
    fireEvent.click(screen.getByRole("button", { name: "여행 만들기" }));
    expect(
      await screen.findByText(/여행을 만들지 못했어요/)
    ).toBeTruthy();
    expect(
      (screen.getByLabelText("어디로 가나요?") as HTMLInputElement).value
    ).toBe("도쿄");
    expect(screen.getByText("다시 시도")).toBeTruthy();
  });

  it("closes on Escape when idle, not while submitting", async () => {
    const onClose = vi.fn();
    let resolve!: (v: unknown) => void;
    addTrip.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );
    render(<QuickTripSheet open onClose={onClose} />);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("어디로 가나요?"), {
      target: { value: "도쿄" },
    });
    fireEvent.click(screen.getByRole("button", { name: "여행 만들기" }));
    await screen.findByText("만드는 중…");
    onClose.mockClear();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).not.toHaveBeenCalled();
    resolve({ id: "t1" });
  });

  it("focuses destination input when opened", async () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, "focus");
    render(<QuickTripSheet open onClose={() => {}} />);
    const input = screen.getByLabelText("어디로 가나요?");
    await waitFor(() => {
      expect(focusSpy).toHaveBeenCalled();
    });
    expect(focusSpy.mock.instances).toContain(input);
    focusSpy.mockRestore();
  });
});
