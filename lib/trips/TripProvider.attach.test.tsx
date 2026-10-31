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

describe("TripProvider — 공유받은 여행", () => {
  it("isOwner=false 여행은 수정/삭제하지 않는다 (DB 호출 없음)", async () => {
    mocks.fetchTrips.mockResolvedValue([makeTrip({ isOwner: false })]);
    const { result } = renderHook(() => useTrips(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.activeTrips.map((t) => t.id)).toEqual([TRIP_ID]);

    await act(async () => {
      result.current.updateTrip(TRIP_ID, { memo: "바꾸기" });
      result.current.removeTrip(TRIP_ID);
    });

    expect(mocks.updateTrip).not.toHaveBeenCalled();
    expect(result.current.trips).toHaveLength(1);
    expect(result.current.trips[0]?.memo).toBeUndefined();
  });

  it("afterJoinTrip: 목록을 다시 불러오고 합류한 여행의 기간으로 attach 를 호출한다", async () => {
    const shared = makeTrip({ id: "66666666-6666-4666-8666-666666666666", isOwner: false });
    mocks.fetchTrips.mockResolvedValueOnce([makeTrip()]);
    const { result } = renderHook(() => useTrips(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.trips).toHaveLength(1);

    mocks.fetchTrips.mockResolvedValueOnce([makeTrip(), shared]);
    await act(async () => {
      await result.current.afterJoinTrip(shared.id);
    });

    expect(mocks.fetchTrips).toHaveBeenCalledTimes(2);
    expect(result.current.trips.map((t) => t.id)).toContain(shared.id);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/agent/attach-unassigned");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      tripId: shared.id,
      startDate: "2026-07-20",
      endDate: "2026-07-23",
    });
  });

  it("afterJoinTrip: 조회가 비어도 기존 목록을 지우지 않는다", async () => {
    const { result } = renderHook(() => useTrips(), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    mocks.fetchTrips.mockResolvedValueOnce([]);
    await act(async () => {
      await result.current.afterJoinTrip(TRIP_ID);
    });
    expect(result.current.trips).toHaveLength(1);
  });
});
