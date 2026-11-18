"use client";

import { useEffect, useState } from "react";

import { AgentInbox } from "@/components/agent/AgentInbox";
import { BotProposalInbox } from "@/components/ledger/BotProposalInbox";
import { ProposalInbox } from "@/components/ledger/ProposalInbox";
import { MobileShell } from "@/components/layout/MobileShell";
import { useAuth } from "@/lib/auth/AuthProvider";
import { INBOX_NAME } from "@/lib/ledger/inbox-copy";
import {
  listCardProfiles,
  listMembers,
} from "@/lib/ledger/supabase";
import type { TripMember } from "@/lib/ledger/types";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Props = { tripId: string };

/**
 * 여행 단위 확인함 — 쉘 1개 + 제안 UI + AgentInbox(embedded).
 * `/agent/inbox` 와 같은 리스트 컴포넌트를 쓰고, 딥링크만 분리한다.
 */
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
    <MobileShell
      title={INBOX_NAME}
      showBack
      backHref={`/trips/${tripId}/ledger`}
    >
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-4">
        <p className="text-xs leading-relaxed text-mu-fg-2">
          확정 전 대기열이에요. 확인하면 가계부에 들어가요.
        </p>
        <BotProposalInbox tripId={tripId} isHost={isOwner} />
        {isOwner ? (
          <ProposalInbox
            tripId={tripId}
            members={members}
            cardProfiles={profiles}
          />
        ) : null}
        <AgentInbox tripId={tripId} embedded />
      </div>
    </MobileShell>
  );
}
