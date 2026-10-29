import type { LedgerCategory, PaymentMethod, SplitType } from "@/lib/ledger/types";

/** parse-text / receipt / manual 공통 초안 (KRW 금액 없음) */
export type ExpenseDraftInput = {
  origin?: "rule" | "llm" | "manual" | "receipt";
  source: "receipt" | "sms" | "manual" | "voice" | "push" | "text";
  merchant: string | null;
  merchantKo?: string | null;
  amount: number | null;
  currency: string | null;
  spentOn: string | null;
  paidAt?: string | null;
  timeIsEstimated?: boolean;
  category: LedgerCategory | string;
  paymentMethod?: PaymentMethod | null;
  payerMemberId?: string | null;
  participantMemberIds?: string[] | null;
  splitType?: SplitType | null;
  confidence?: number;
  warnings?: string[];
  kind?: "approval" | "cancel" | "unknown";
  items?: Array<{
    name: string;
    nameKo?: string | null;
    qty?: number | null;
    unitPrice?: number | null;
    amount?: number | null;
  }>;
  rawInput?: unknown;
};
