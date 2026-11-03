// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TripMember } from "@/lib/ledger/types";

const rpc = vi.fn();
const writeText = vi.fn();
const listMembers = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabase: () => ({ rpc: (...a: unknown[]) => rpc(...a) }),
}));
vi.mock("@/lib/onboarding/qr-svg", () => ({
  renderQrSvg: vi.fn(async () => "<svg />"),
  svgToDataUri: (s: string) => `data:image/svg+xml,${s}`,
}));
vi.mock("@/lib/ledger/supabase", () => ({
  listMembers: (...a: unknown[]) => listMembers(...a),
}));

import { ToastProvider } from "@/components/ds/Toast";
import { InviteStep } from "./InviteStep";

const TRIP = "22222222-2222-4222-8222-222222222222";
const members: TripMember[] = [
  { id: "m-owner", tripId: TRIP, displayName: "가나", isOwner: true, userId: "u-a" },
  { id: "m-name", tripId: TRIP, displayName: "민수", isOwner: false, userId: null },
];

function renderStep(props: Partial<React.ComponentProps<typeof InviteStep>> = {}) {
  return render(
    <ToastProvider>
      <InviteStep tripId={TRIP} members={members} canInvite {...props} />
    </ToastProvider>
  );
}

beforeEach(() => {
  rpc.mockResolvedValue({ data: "tok-abc", error: null });
  writeText.mockResolvedValue(undefined);
  listMembers.mockResolvedValue(members);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  rpc.mockReset();
  writeText.mockReset();
  listMembers.mockReset();
});

describe("InviteStep", () => {
  it("초대 링크를 만들고, 공유가 없으면 복사로 대신하고 토스트를 띄워요", async () => {
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: "초대 링크 만들기" }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("create_trip_invite", {
        p_trip_id: TRIP,
        p_ttl_hours: 24,
        p_max_uses: 4,
      })
    );
    const input = (await screen.findByLabelText("동행자 초대 링크")) as HTMLInputElement;
    expect(input.value).toBe(`${window.location.origin}/join/tok-abc`);

    fireEvent.click(screen.getByRole("button", { name: "공유하기" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(input.value));
    expect(await screen.findByText("링크를 복사했어요. 메신저에 붙여 넣어 보내 주세요.")).toBeTruthy();
  });

  it("공유가 되면 navigator.share 로 넘기고 복사하지 않아요", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: "초대 링크 만들기" }));
    fireEvent.click(await screen.findByRole("button", { name: "공유하기" }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(writeText).not.toHaveBeenCalled();
  });

  it("복사가 막히면 길게 눌러 복사하라고 알려요", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: "초대 링크 만들기" }));
    fireEvent.click(await screen.findByRole("button", { name: "링크 복사" }));
    expect((await screen.findByRole("alert")).textContent).toContain("길게 눌러 복사");
  });

  it("참여 현황: 호스트·초대 대기를 보여 주고, 새로 들어오면 토스트와 부모 갱신", async () => {
    vi.useFakeTimers();
    const onMembersChanged = vi.fn();
    renderStep({ onMembersChanged });
    expect(screen.getByText("초대 대기")).toBeTruthy();
    expect(screen.getByText("1/2명")).toBeTruthy();

    const joined: TripMember[] = [
      members[0]!,
      { ...members[1]!, userId: "u-b" },
    ];
    listMembers.mockResolvedValue(joined);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.getByText("민수님이 들어왔어요")).toBeTruthy();
    expect(screen.getByText("참여 확인됨")).toBeTruthy();
    expect(screen.getByText("2/2명")).toBeTruthy();
    expect(onMembersChanged).toHaveBeenCalledWith(joined);
  });

  it("폴링 결과가 비어 있으면 무시해요 (조회 실패)", async () => {
    vi.useFakeTimers();
    listMembers.mockResolvedValue([]);
    renderStep();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.getByText("1/2명")).toBeTruthy();
  });

  it("호스트가 아니면 초대 도구 없이 참여 현황만 보여요", () => {
    renderStep({ canInvite: false });
    expect(screen.queryByRole("button", { name: "초대 링크 만들기" })).toBeNull();
    expect(screen.getByText("초대는 여행을 만든 호스트만 할 수 있어요.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "참여한 사람" })).toBeTruthy();
  });
});
