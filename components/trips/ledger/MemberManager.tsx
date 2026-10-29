"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import type { TripMember } from "@/lib/ledger/types";

interface MemberManagerProps {
  members: TripMember[];
  readOnly?: boolean;
  onAdd?: (name: string) => Promise<boolean>;
  onRemove?: (memberId: string) => Promise<boolean>;
}

export function MemberManager({
  members,
  readOnly,
  onAdd,
  onRemove,
}: MemberManagerProps) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    if (!onAdd || !name.trim() || busy) return;
    setBusy(true);
    const ok = await onAdd(name.trim());
    setBusy(false);
    if (ok) setName("");
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-ink-caption">함께 정산할 멤버</p>
      <div className="flex flex-wrap gap-2">
        {members.map((m) => (
          <span
            key={m.id}
            className="inline-flex items-center gap-1 rounded-full bg-surface-soft px-3 py-1.5 text-sm font-bold text-ink-heading"
          >
            {m.displayName}
            {m.isOwner ? (
              <span className="text-[10px] font-semibold text-brand">나</span>
            ) : null}
            {!readOnly && !m.isOwner && onRemove ? (
              <button
                type="button"
                aria-label={`${m.displayName} 제거`}
                onClick={() => void onRemove(m.id)}
                className="ml-0.5 text-ink-caption active:text-danger"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </span>
        ))}
      </div>
      {!readOnly && onAdd ? (
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름 추가"
            maxLength={30}
            className="h-10 flex-1 rounded-xl border border-line-muted bg-surface-white px-3 text-sm text-ink-heading focus:border-brand focus:outline-none"
          />
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() => void handleAdd()}
            className="inline-flex h-10 items-center gap-1 rounded-xl bg-brand px-3 text-sm font-bold text-surface-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            추가
          </button>
        </div>
      ) : null}
    </div>
  );
}
