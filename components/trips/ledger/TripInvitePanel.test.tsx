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

import type { TripMember } from "@/lib/ledger/types";

const rpc = vi.fn();
const writeText = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabase: () => ({ rpc: (...a: unknown[]) => rpc(...a) }),
}));

import { TripInvitePanel } from "@/components/trips/ledger/TripInvitePanel";

const TRIP = "22222222-2222-4222-8222-222222222222";
const members: TripMember[] = [
  { id: "m-owner", tripId: TRIP, displayName: "민수", isOwner: true, userId: "u-a" },
  { id: "m-joined", tripId: TRIP, displayName: "지영", isOwner: false, userId: "u-b" },
  { id: "m-name-only", tripId: TRIP, displayName: "철수", isOwner: false, userId: null },
];

beforeEach(() => {
  rpc.mockReset();
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  Object.defineProperty(navigator, "share", {
    value: undefined,
    configurable: true,
  });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TripInvitePanel", () => {
  it("소유자가 아니면 아무것도 그리지 않는다 (초대 버튼 없음)", () => {
    const { container } = render(
      <TripInvitePanel tripId={TRIP} members={members} canInvite={false} />
    );
    expect(container.innerHTML).toBe("");
    expect(screen.queryByRole("button", { name: "동행자 초대" })).toBeNull();
  });

  it("동행자 초대 → create_trip_invite 호출, 링크 표시, 만료·인원 문구, 복사", async () => {
    rpc.mockResolvedValue({ data: "tokentoken123", error: null });
    render(<TripInvitePanel tripId={TRIP} members={members} canInvite />);

    const btn = screen.getByRole("button", { name: "동행자 초대" });
    expect(btn.className).toContain("min-h-11");
    fireEvent.click(btn);

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("create_trip_invite", { p_trip_id: TRIP })
    );
    const input = (await screen.findByLabelText("동행자 초대 링크")) as HTMLInputElement;
    expect(input.value).toBe(`${window.location.origin}/join/tokentoken123`);
    expect(screen.getByText(/72시간 동안, 최대 10명까지/)).toBeTruthy();
    // navigator.share 가 없으면 공유 버튼은 없다
    expect(screen.queryByRole("button", { name: "공유하기" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "링크 복사" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/join/tokentoken123`
      )
    );
    expect(await screen.findByText("복사했어요")).toBeTruthy();
  });

  it("navigator.share 가 있으면 공유하기로 링크를 넘긴다", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    rpc.mockResolvedValue({ data: "tok-share", error: null });
    render(<TripInvitePanel tripId={TRIP} members={members} canInvite />);

    fireEvent.click(screen.getByRole("button", { name: "동행자 초대" }));
    fireEvent.click(await screen.findByRole("button", { name: "공유하기" }));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share.mock.calls[0]![0]).toMatchObject({
      url: `${window.location.origin}/join/tok-share`,
    });
  });

  it("이름만 있는 멤버에게는 claim 링크(1회용)를 따로 만든다", async () => {
    rpc.mockResolvedValue({ data: "claimtoken", error: null });
    render(<TripInvitePanel tripId={TRIP} members={members} canInvite />);

    // 이미 계정이 있는 멤버(지영)와 소유자(민수)는 대상이 아니다
    expect(screen.queryByRole("button", { name: "지영에게 초대 링크" })).toBeNull();
    expect(screen.queryByRole("button", { name: "민수에게 초대 링크" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "철수에게 초대 링크" }));

    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("create_trip_invite", {
        p_trip_id: TRIP,
        p_claim_member_id: "m-name-only",
        p_max_uses: 1,
      })
    );
    const input = (await screen.findByLabelText("철수 초대 링크")) as HTMLInputElement;
    expect(input.value).toBe(`${window.location.origin}/join/claimtoken`);
    expect(screen.getByText(/72시간 동안, 1번만/)).toBeTruthy();
  });

  it("RPC 가 실패하면 한국어 오류만 보이고 원인은 로그에만 남긴다 (토큰 로그 없음)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "forbidden" } });
    render(<TripInvitePanel tripId={TRIP} members={members} canInvite />);

    fireEvent.click(screen.getByRole("button", { name: "동행자 초대" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("초대 링크를 만들지 못했어요");
    expect(alert.textContent).not.toContain("forbidden");
    expect(console.error).toHaveBeenCalledWith("[invite] create_trip_invite", "forbidden");
  });

  it("성공해도 토큰을 console 에 남기지 않는다", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    rpc.mockResolvedValue({ data: "supersecrettoken", error: null });
    render(<TripInvitePanel tripId={TRIP} members={members} canInvite />);

    fireEvent.click(screen.getByRole("button", { name: "동행자 초대" }));
    await screen.findByLabelText("동행자 초대 링크");

    const logged = [...log.mock.calls, ...vi.mocked(console.error).mock.calls]
      .flat()
      .map(String)
      .join(" ");
    expect(logged).not.toContain("supersecrettoken");
  });
});
