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

const fetchMock = vi.fn();
const removeChannel = vi.fn();
const subscribe = vi.fn(() => ({ unsubscribe: vi.fn() }));
const channelOn = vi.fn(() => ({ subscribe }));
const channel = vi.fn(() => ({ on: channelOn }));

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "u-1" }, isAnonymous: false }),
}));
vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabase: () => ({
    channel,
    removeChannel,
  }),
}));

import { SplitChatRoom } from "./SplitChatRoom";

const THREAD = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MSG = "11111111-1111-4111-8111-111111111111";
const KEY = "44444444-4444-4444-8444-444444444444";
const EXP = "22222222-2222-4222-8222-222222222222";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const previewPayload = {
  type: "split_preview" as const,
  patch: {
    expenseId: EXP,
    exclude: [A],
    only: [],
    weights: [],
    itemExclusions: [],
    clarification: null,
  },
  beforeDigest: "digest",
  summary: "이렇게 맞을까요?",
  idempotencyKey: KEY,
  expenseId: EXP,
  label: "저녁",
  before: [{ memberId: A, name: "민수", krw: 10000 }],
  after: [{ memberId: A, name: "민수", krw: 0 }],
  canGuestConfirm: true,
};

describe("SplitChatRoom", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (!init?.method || init.method === "GET") {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            threadId: THREAD,
            messages: [
              {
                id: MSG,
                threadId: THREAD,
                senderKind: "agent",
                senderUserId: null,
                senderName: "MetU AI",
                body: "이렇게 맞을까요?",
                payload: previewPayload,
                createdAt: "2026-11-20T00:00:00.000Z",
              },
            ],
          }),
        };
      }
      if (String(url).includes("/confirm")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            systemMessage: {
              id: "sys-1",
              threadId: THREAD,
              senderKind: "system",
              senderUserId: null,
              senderName: "시스템",
              body: "반영했어요",
              payload: null,
              createdAt: "2026-11-20T00:00:02.000Z",
            },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({ ok: true, threadId: THREAD }),
      };
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("열리면 멤버·메시지를 보여 줘요", async () => {
    render(
      <SplitChatRoom
        tripId="trip-1"
        variant="inline"
        members={[
          { id: "a", displayName: "민수", userId: "u-1" },
          { id: "b", displayName: "지영", userId: "u-2" },
        ]}
      />
    );
    expect(await screen.findByTestId("split-chat-room")).toBeTruthy();
    expect(screen.getByTestId("split-chat-members").textContent).toMatch(
      /민수/
    );
    expect(await screen.findByTestId("split-preview-card")).toBeTruthy();
    expect(screen.getByText(/저녁/)).toBeTruthy();
  });

  it("적용을 누르면 confirm API 를 호출해요", async () => {
    render(<SplitChatRoom tripId="trip-1" variant="inline" />);
    await screen.findByTestId("split-preview-card");
    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/trips/trip-1/split-chat/confirm",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            messageId: MSG,
            beforeDigest: "digest",
            idempotencyKey: KEY,
          }),
        })
      );
    });
    expect(await screen.findByText("반영했어요")).toBeTruthy();
  });
});
