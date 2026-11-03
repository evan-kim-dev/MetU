"use client";

import { useEffect, useState } from "react";

import { AgentInbox } from "@/components/agent/AgentInbox";
import { ProposalInbox } from "@/components/ledger/ProposalInbox";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  listCardProfiles,
  listMembers,
} from "@/lib/ledger/supabase";
import type { TripMember } from "@/lib/ledger/types";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Props = { tripId: string };

export function LedgerInboxClient({ tripId }: Props) {
  const { user, isAnonymous } = useAuth();
  const [members, setMembers] = useState<TripMember[]>([]);
  const [profiles, setProfiles] = useState<
    Array<{
      id: string;
      label: string;
      fee_rate: number | null;
      fee_flat_krw: number;
    }>
  >([]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase || !user) return;
    void (async () => {
      const [m, p] = await Promise.all([
        listMembers(supabase, tripId),
        listCardProfiles(supabase),
      ]);
      setMembers(m);
      setProfiles(
        (p as Array<Record<string, unknown>>).map((row) => ({
          id: String(row.id),
          label: String(row.label ?? ""),
          fee_rate:
            typeof row.fee_rate === "number"
              ? row.fee_rate
              : row.fee_rate == null
                ? null
                : Number(row.fee_rate),
          fee_flat_krw: Number(row.fee_flat_krw ?? 0),
        }))
      );
    })();
  }, [tripId, user]);

  const isOwner = Boolean(
    user &&
      members.some((m) => m.isOwner && m.userId === user.id) &&
      !isAnonymous
  );

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-4">
      {isOwner ? (
        <ProposalInbox
          tripId={tripId}
          members={members}
          cardProfiles={profiles}
        />
      ) : null}
      <AgentInbox tripId={tripId} />
    </div>
  );
}
