// @vitest-environment jsdom
import React from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Trip } from "@/lib/trips/types";

const USER = "11111111-1111-4111-8111-111111111111";
const TRIP_ID = "22222222-2222-4222-8222-222222222222";

const mocks = vi.hoisted(() => ({
  fetchTrips: vi.fn(),
  updateTrip: vi.fn(),
  insertTrip: vi.fn(),
}));

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: USER },
    provider: "kakao",
    isReady: true,
  }),
}));
vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabase: () => ({}),
}));
vi.mock("@/lib/trips/supabase", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/trips/supabase")>();
  return {
    ...actual,
    fetchTripsFromSupabase: mocks.fetchTrips,
    updateTripInSupabase: mocks.updateTrip,
    insertTripToSupabase: mocks.insertTrip,
    deleteTripFromSupabase: vi.fn(async () => true),
    upsertTripsToSupabase: vi.fn(async () => []),
  };
});

import { TripProvider, useTrips } from "@/lib/trips/TripProvider";

function makeTrip(over: Partial<Trip> = {}): Trip {
  return {
    id: TRIP_ID,
    destination: "도쿄",
    country: "일본",
    origin: "서울",
    dateRange: "2026-07-20 · 3박 4일",
    dDay: 0,
    budget: 0,
    spent: 0,
    people: 1,
    styles: [],
    imageUrl: "",
    expenses: [],
    status: "upcoming",
    startDate: "2026-07-20",
    endDate: "2026-07-23",
    ...over,
  };
}

const fetchMock = vi.fn();

function wrapper({ children }: { children: React.ReactNode }) {
  return <TripProvider>{children}</TripProvider>;
}

beforeEach(() => {
  mocks.fetchTrips.mockReset();
  mocks.updateTrip.mockReset();
  mocks.insertTrip.mockReset();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal("fetch", fetchMock);
  mocks.fetchTrips.mockResolvedValue([makeTrip()]);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TripProvider — 저장 후 미배정 재부착", () => {
  it("updateTrip: DB 저장이 끝난 뒤에만 attach-unassigned 를 호출하고 저장된 날짜를 보낸다", async () => {
    let resolveUpdate: (t: Trip | null) => void = () => undefined;
    mocks.updateTrip.mockImplementation(
      () => new Promise<Trip | null>((r) => (resolveUpdate = r))
    );

    const { result } = renderHook(() => useTrips(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    act(() => {
      result.current.updateTrip(TRIP_ID, { dateRange: "2026-08-01 · 2박 3일" });
    });

    // 저장이 아직 끝나지 않았으므로 attach 는 호출되면 안 된다 (레이스 방지).
    await Promise.resolve();
    expect(mocks.updateTrip).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();

    // 저장 호출에는 라벨에서 계산한 확정 날짜가 함께 간다.
    const sent = mocks.updateTrip.mock.calls[0]![3] as Partial<Trip>;
    expect(sent.dateRange).toBe("2026-08-01 · 2박 3일");
    expect(sent.startDate).toBe("2026-08-01");
    expect(sent.endDate).toBe("2026-08-03");

    await act(async () => {
      resolveUpdate(
        makeTrip({
          dateRange: "2026-08-01 · 2박 3일",
          startDate: "2026-08-01",
          endDate: "2026-08-03",
        })
      );
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/agent/attach-unassigned");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      tripId: TRIP_ID,
      startDate: "2026-08-01",
      endDate: "2026-08-03",
    });
  });

  it("updateTrip: 저장이 실패하면 attach 하지 않는다 (콘솔 경고만)", async () => {
    mocks.updateTrip.mockResolvedValue(null);
    const { result } = renderHook(() => useTrips(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await act(async () => {
      result.current.updateTrip(TRIP_ID, { dateRange: "2026-08-01 · 2박 3일" });
    });
    await waitFor(() => expect(mocks.updateTrip).toHaveBeenCalled());
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it("날짜와 무관한 수정(메모)은 attach 하지 않는다", async () => {
    mocks.updateTrip.mockResolvedValue(makeTrip({ memo: "메모" }));
    const { result } = renderHook(() => useTrips(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await act(async () => {
      result.current.updateTrip(TRIP_ID, { memo: "메모" });
    });
    await waitFor(() => expect(mocks.updateTrip).toHaveBeenCalled());
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("startDate 만 바뀌어도 attach 한다", async () => {
    mocks.updateTrip.mockResolvedValue(
      makeTrip({ startDate: "2026-07-25", endDate: "2026-07-25" })
    );
    const { result } = renderHook(() => useTrips(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await act(async () => {
      result.current.updateTrip(TRIP_ID, { startDate: "2026-07-25" });
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("addTrip: insert 가 끝난 뒤 저장된 날짜와 함께 attach 를 호출한다", async () => {
    const saved = makeTrip({ id: "55555555-5555-4555-8555-555555555555" });
    mocks.insertTrip.mockResolvedValue(saved);
    const { result } = renderHook(() => useTrips(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await act(async () => {
      await result.current.addTrip(makeTrip({ id: "local" }));
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(
      (fetchMock.mock.calls[0]![1] as RequestInit).body as string
    );
    expect(body).toMatchObject({ tripId: saved.id, startDate: "2026-07-20" });
  });

  it("attach 요청이 실패해도 던지지 않는다", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    mocks.updateTrip.mockResolvedValue(makeTrip());
    const { result } = renderHook(() => useTrips(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await act(async () => {
      result.current.updateTrip(TRIP_ID, { dateRange: "2026-08-01 · 2박 3일" });
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(console.warn).toHaveBeenCalled());
  });
});
