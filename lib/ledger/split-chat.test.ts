import { describe, expect, it } from "vitest";

import {
  SplitChatConfirmBodySchema,
  SplitChatMessageSchema,
  SplitChatSendBodySchema,
  SplitPreviewPayloadSchema,
  parseSplitChatPayload,
} from "@/lib/ledger/split-chat";

const EXP = "22222222-2222-4222-8222-222222222222";
const KEY = "44444444-4444-4444-8444-444444444444";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MSG = "11111111-1111-4111-8111-111111111111";
const THREAD = "33333333-3333-4333-8333-333333333333";

function previewPayload(over: Record<string, unknown> = {}) {
  return {
    type: "split_preview",
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
    ...over,
  };
}

describe("split-chat schemas", () => {
  it("SplitPreviewPayload 를 검증해요", () => {
    const parsed = SplitPreviewPayloadSchema.safeParse(previewPayload());
    expect(parsed.success).toBe(true);
  });

  it("금액 필드가 patch 에 있으면 거절해요", () => {
    const bad = previewPayload({
      patch: {
        expenseId: EXP,
        exclude: [A],
        only: [],
        weights: [],
        itemExclusions: [],
        clarification: null,
        krwAmount: 1000,
      },
    });
    expect(SplitPreviewPayloadSchema.safeParse(bad).success).toBe(false);
  });

  it("parseSplitChatPayload 는 잘못된 payload 를 null 로 돌려요", () => {
    expect(parseSplitChatPayload({ type: "other" })).toBeNull();
    expect(parseSplitChatPayload(previewPayload())?.type).toBe("split_preview");
  });

  it("send/confirm body 스키마", () => {
    expect(
      SplitChatSendBodySchema.safeParse({ text: "민수 빼줘" }).success
    ).toBe(true);
    expect(SplitChatSendBodySchema.safeParse({ text: "" }).success).toBe(
      false
    );
    expect(
      SplitChatSendBodySchema.safeParse({
        attachment: {
          kind: "image",
          url: "https://example.com/a.jpg",
          fileName: "a.jpg",
        },
      }).success
    ).toBe(true);
    expect(
      SplitChatConfirmBodySchema.safeParse({
        messageId: MSG,
        beforeDigest: "d",
        idempotencyKey: KEY,
      }).success
    ).toBe(true);
  });

  it("메시지 스키마", () => {
    const msg = SplitChatMessageSchema.safeParse({
      id: MSG,
      threadId: THREAD,
      senderKind: "agent",
      senderUserId: null,
      senderName: "MetU AI",
      body: "이렇게 맞을까요?",
      payload: previewPayload(),
      createdAt: "2026-11-20T00:00:00.000Z",
    });
    expect(msg.success).toBe(true);
  });
});
