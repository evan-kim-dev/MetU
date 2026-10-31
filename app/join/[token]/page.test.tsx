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

const useAuth = vi.fn();
const rpc = vi.fn();
const replace = vi.fn();
const afterJoinTrip = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "invite-token" }),
  useRouter: () => ({ replace }),
}));
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
vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => useAuth(),
}));
vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabase: () => ({ rpc: (...a: unknown[]) => rpc(...a) }),
}));
vi.mock("@/lib/trips/TripProvider", () => ({
  useTrips: () => ({ afterJoinTrip }),
}));

import JoinTripPage from "@/app/join/[token]/page";

const TRIP = "22222222-2222-4222-8222-222222222222";

const preview = {
  tripId: TRIP,
  destination: "도쿄",
  dateRange: "2026-07-20 · 3박 4일",
  ownerName: "민수",
  members: [{ id: "m-name-only", displayName: "철수", claimable: true }],
  claimMemberId: null,
};

beforeEach(() => {
  rpc.mockReset();
  replace.mockReset();
  afterJoinTrip.mockReset();
  afterJoinTrip.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("/join/[token]", () => {
  it("로그아웃이면 로그인 링크에 next 를 담는다", () => {
    useAuth.mockReturnValue({ user: null, provider: "guest" });
    render(<JoinTripPage />);

    const link = screen.getByRole("link", { name: "로그인" });
    expect(link.getAttribute("href")).toBe(
      `/login?next=${encodeURIComponent("/join/invite-token")}`
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it("만료/무효 초대는 기존 문구를 보여준다", async () => {
    useAuth.mockReturnValue({ user: { id: "u-b" }, provider: "kakao" });
    rpc.mockResolvedValue({ data: null, error: null });
    render(<JoinTripPage />);

    expect(
      await screen.findByText("초대가 만료되었거나 유효하지 않아요.")
    ).toBeTruthy();
  });

  it("합류에 성공하면 목록 갱신(afterJoinTrip)을 호출하고 가계부로 이동한다", async () => {
    useAuth.mockReturnValue({ user: { id: "u-b" }, provider: "kakao" });
    rpc.mockImplementation(async (name: string) => {
      if (name === "preview_trip_invite") return { data: preview, error: null };
      if (name === "join_trip") return { data: "member-id", error: null };
      return { data: null, error: { message: "unexpected" } };
    });
    render(<JoinTripPage />);

    fireEvent.click(await screen.findByRole("button", { name: "합류하기" }));

    await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
    expect(rpc).toHaveBeenCalledWith("join_trip", {
      p_token: "invite-token",
      p_claim_member_id: null,
      p_display_name: null,
    });
    expect(afterJoinTrip).toHaveBeenCalledWith(TRIP);
    expect(replace).toHaveBeenCalledWith(`/trips/${TRIP}/ledger`);
    // 갱신이 끝난 뒤에 이동한다
    expect(afterJoinTrip.mock.invocationCallOrder[0]!).toBeLessThan(
      replace.mock.invocationCallOrder[0]!
    );
  });

  it("목록 갱신이 실패해도 합류 이동은 막지 않는다", async () => {
    useAuth.mockReturnValue({ user: { id: "u-b" }, provider: "kakao" });
    afterJoinTrip.mockRejectedValue(new Error("network"));
    rpc.mockImplementation(async (name: string) => {
      if (name === "preview_trip_invite") return { data: preview, error: null };
      return { data: "member-id", error: null };
    });
    render(<JoinTripPage />);

    fireEvent.click(await screen.findByRole("button", { name: "합류하기" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/trips/${TRIP}/ledger`));
    expect(console.error).toHaveBeenCalled();
  });

  it("합류 중 초대가 소진되면 만료 문구를 보여주고 이동하지 않는다", async () => {
    useAuth.mockReturnValue({ user: { id: "u-b" }, provider: "kakao" });
    rpc.mockImplementation(async (name: string) => {
      if (name === "preview_trip_invite") return { data: preview, error: null };
      return { data: null, error: { message: "invite-invalid" } };
    });
    render(<JoinTripPage />);

    fireEvent.click(await screen.findByRole("button", { name: "합류하기" }));

    expect(
      await screen.findByText("초대가 만료되었거나 유효하지 않아요.")
    ).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
    expect(afterJoinTrip).not.toHaveBeenCalled();
  });
});
