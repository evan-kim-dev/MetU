import { z } from "zod";

import type { ExpenseDraftInput } from "@/lib/ledger/draft";
import type { TripMember } from "@/lib/ledger/types";

const ItemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  nameKo: z.string().trim().max(80).nullable().optional(),
  qty: z.number().finite().nullable().optional(),
  unitPrice: z.number().finite().nullable().optional(),
  amount: z.number().finite().nullable().optional(),
});

export const ProposalInputSchema = z.object({
  label: z.string().trim().min(1).max(80),
  amount: z
    .number()
    .finite()
    .gt(0)
    .refine((n) => {
      const scaled = Math.round(n * 100);
      return Math.abs(n * 100 - scaled) < 1e-8;
    }, "max-2-decimals"),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/),
  category: z.string().trim().min(1).max(20).default("기타"),
  spentOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  note: z.string().trim().max(200).nullable().optional(),
  items: z.array(ItemSchema).max(20).default([]),
  source: z.enum(["guest", "receipt"]).default("guest"),
});

export type ProposalInput = z.infer<typeof ProposalInputSchema>;

export type ProposalRow = {
  id: string;
  tripId: string;
  proposedBy: string;
  proposerMemberId: string;
  label: string;
  amount: number;
  currency: string;
  category: string;
  spentOn: string | null;
  note: string | null;
  items: Array<{
    name: string;
    nameKo?: string | null;
    qty?: number | null;
    unitPrice?: number | null;
    amount?: number | null;
  }>;
  source: "guest" | "receipt";
  status: "pending" | "approved" | "rejected" | "withdrawn";
  rejectReason: string | null;
  resolvedExpenseId: string | null;
  createdAt: string;
};

export const TOO_MANY_PENDING_MESSAGE =
  "대기 중인 제안이 너무 많아요. 호스트 확인 후 다시 올려 주세요.";

/** 금액·원화 환산 없음. 결제자=제안자, 참여자=전원. */
export function proposalToDraft(
  row: Pick<
    ProposalRow,
    | "label"
    | "amount"
    | "currency"
    | "category"
    | "spentOn"
    | "note"
    | "items"
    | "source"
    | "proposerMemberId"
  >,
  members: TripMember[]
): ExpenseDraftInput {
  return {
    origin: row.source === "receipt" ? "receipt" : "manual",
    source: row.source === "receipt" ? "receipt" : "manual",
    merchant: row.label,
    amount: row.amount,
    currency: row.currency,
    spentOn: row.spentOn,
    category: row.category || "기타",
    paymentMethod: "card",
    payerMemberId: row.proposerMemberId,
    participantMemberIds: members.map((m) => m.id),
    splitType: "equal",
    kind: "approval",
    items: row.items ?? [],
    rawInput: row.note ? { note: row.note } : undefined,
  };
}
