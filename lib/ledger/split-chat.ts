import { z } from "zod";

import { SplitPatchSchema } from "@/lib/ledger/split-patch";

/** 채팅 본문 최대 길이 (마이그레이션 check 와 맞춤). */
export const SPLIT_CHAT_BODY_MAX = 2000;

export const SplitChatSenderKindSchema = z.enum(["user", "agent", "system"]);
export type SplitChatSenderKind = z.infer<typeof SplitChatSenderKindSchema>;

const PreviewShareRowSchema = z.strictObject({
  memberId: z.string().min(1).max(64),
  name: z.string().max(80),
  krw: z.number().int(),
});

/**
 * agent 미리보기 카드 payload.
 * 금액·분담은 서버 applySplitPatch 결과만 담는다 (LLM 계산 금지).
 */
export const SplitPreviewPayloadSchema = z.strictObject({
  type: z.literal("split_preview"),
  patch: SplitPatchSchema,
  beforeDigest: z.string().min(1).max(4_000),
  summary: z.string().trim().min(1).max(400),
  idempotencyKey: z.string().uuid(),
  expenseId: z.string().uuid(),
  label: z.string().max(200),
  before: z.array(PreviewShareRowSchema).max(40),
  after: z.array(PreviewShareRowSchema).max(40),
  canGuestConfirm: z.boolean(),
});

export type SplitPreviewPayload = z.infer<typeof SplitPreviewPayloadSchema>;

export const SplitAttachmentPayloadSchema = z.strictObject({
  type: z.literal("attachment"),
  kind: z.enum(["image", "file"]),
  url: z.string().url().max(2_000),
  fileName: z.string().trim().min(1).max(200),
});

export type SplitAttachmentPayload = z.infer<
  typeof SplitAttachmentPayloadSchema
>;

export const SplitChatPayloadSchema = z.discriminatedUnion("type", [
  SplitPreviewPayloadSchema,
  SplitAttachmentPayloadSchema,
]);

export type SplitChatPayload = z.infer<typeof SplitChatPayloadSchema>;

export const SplitChatMessageSchema = z.strictObject({
  id: z.string().uuid(),
  threadId: z.string().uuid(),
  senderKind: SplitChatSenderKindSchema,
  senderUserId: z.string().uuid().nullable(),
  senderName: z.string().max(80),
  body: z.string().min(1).max(SPLIT_CHAT_BODY_MAX),
  payload: SplitChatPayloadSchema.nullable(),
  createdAt: z.string().min(1),
});

export type SplitChatMessage = z.infer<typeof SplitChatMessageSchema>;

export const SplitChatSendBodySchema = z
  .strictObject({
    text: z.string().trim().max(SPLIT_CHAT_BODY_MAX).optional(),
    expenseId: z.string().uuid().optional(),
    attachment: z
      .strictObject({
        kind: z.enum(["image", "file"]),
        url: z.string().url().max(2_000),
        fileName: z.string().trim().min(1).max(200),
      })
      .optional(),
  })
  .superRefine((body, ctx) => {
    const hasText = Boolean(body.text && body.text.length > 0);
    if (!hasText && !body.attachment) {
      ctx.addIssue({
        code: "custom",
        message: "메시지 또는 첨부가 필요해요.",
      });
    }
  });

export const SplitChatConfirmBodySchema = z.strictObject({
  messageId: z.string().uuid(),
  beforeDigest: z.string().min(1).max(4_000),
  idempotencyKey: z.string().uuid(),
});

export function parseSplitChatPayload(
  raw: unknown
): SplitChatPayload | null {
  const parsed = SplitChatPayloadSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
