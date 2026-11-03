import type { SplitPatch } from "@/lib/ledger/split-patch";

export type ShareRow = { memberId: string; name: string; krw: number };

export type SplitPreviewPayload = {
  expenseId: string;
  label: string;
  kind: string;
  before: ShareRow[];
  after: ShareRow[];
  beforeDigest: string;
  krwAmount?: number;
  splitType?: string;
  myBefore?: number;
  myAfter?: number;
};

export type SplitPreviewBusy = "preview" | "apply" | "undo" | null;

export type { SplitPatch };
