"use client";

import { GuestExpenseEntry } from "@/components/ledger/GuestExpenseEntry";
import type { TripMember } from "@/lib/ledger/types";

type Props = {
  tripId: string;
  members: TripMember[];
  meId: string;
  userId: string;
  defaultCurrency?: string;
};

/** 게스트 "내가 냈어요" 제안 자리 (K14). */
export function GuestExpenseSlot(props: Props) {
  return <GuestExpenseEntry {...props} />;
}
