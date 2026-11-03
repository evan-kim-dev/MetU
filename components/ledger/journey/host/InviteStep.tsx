"use client";

import { TripInvitePanel } from "@/components/trips/ledger/TripInvitePanel";
import type { TripMember } from "@/lib/ledger/types";

type Props = {
  tripId: string;
  members: TripMember[];
  canInvite: boolean;
};

/** 호스트 ② 초대 단계. */
export function InviteStep({ tripId, members, canInvite }: Props) {
  return (
    <>
      <TripInvitePanel tripId={tripId} members={members} canInvite={canInvite} />
      <ul className="rounded-2xl bg-surface-white p-4 text-sm">
        <li className="mb-2 text-xs font-bold text-ink-muted">멤버</li>
        {members.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between py-2 text-ink-heading"
          >
            <span>{m.displayName}</span>
            <span className="text-xs text-ink-muted">
              {m.isOwner ? "호스트" : "멤버"}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
