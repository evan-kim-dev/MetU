"use client";

import { useState } from "react";

import { Sheet } from "@/components/ds/Sheet";
import { resizeImageToJpeg } from "@/lib/ledger/image";
import {
  createProposal,
  listMyProposals,
} from "@/lib/ledger/proposals-client";
import type { ProposalRow } from "@/lib/ledger/proposals";
import type { TripMember } from "@/lib/ledger/types";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Props = {
  tripId: string;
  members: TripMember[];
  meId: string;
  userId: string;
  defaultCurrency?: string;
};

type DraftFields = {
  label: string;
  amount: string;
  currency: string;
  category: string;
  spentOn: string;
  note: string;
};

const EMPTY: DraftFields = {
  label: "",
  amount: "",
  currency: "KRW",
  category: "기타",
  spentOn: new Date().toISOString().slice(0, 10),
  note: "",
};

export function GuestExpenseEntry({
  tripId,
  meId,
  userId,
  defaultCurrency = "KRW",
}: Props) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<DraftFields>({
    ...EMPTY,
    currency: defaultCurrency.toUpperCase(),
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [aiFilled, setAiFilled] = useState(false);
  const [usedReceipt, setUsedReceipt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mine, setMine] = useState<ProposalRow[]>([]);

  async function refreshMine() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setMine(await listMyProposals(supabase, tripId, userId));
  }

  async function onPickImage(file: File | null) {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const jpeg = await resizeImageToJpeg(file);
      const body = new FormData();
      body.set("tripId", tripId);
      body.set("image", jpeg, "receipt.jpg");
      const res = await fetch("/api/ledger/receipt", {
        method: "POST",
        body,
      });
      const json = (await res.json()) as {
        ok?: boolean;
        draft?: {
          merchant?: string | null;
          amount?: number | null;
          currency?: string | null;
          spentOn?: string | null;
          category?: string | null;
          items?: Array<{ name: string }>;
        };
        error?: string;
      };
      if (!res.ok || !json.draft) {
        setMessage("영수증을 읽지 못했어요. 직접 입력해 주세요.");
        return;
      }
      const d = json.draft;
      setFields((prev) => ({
        label:
          !touched.label && d.merchant ? String(d.merchant) : prev.label,
        amount:
          !touched.amount && d.amount != null
            ? String(d.amount)
            : prev.amount,
        currency:
          !touched.currency && d.currency
            ? String(d.currency).toUpperCase()
            : prev.currency,
        spentOn:
          !touched.spentOn && d.spentOn ? String(d.spentOn) : prev.spentOn,
        category:
          !touched.category && d.category
            ? String(d.category)
            : prev.category,
        note: prev.note,
      }));
      setUsedReceipt(true);
      setAiFilled(true);
      setMessage("AI가 채웠어요. 확인해 주세요.");
    } catch {
      setMessage("영수증을 읽지 못했어요. 직접 입력해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setMessage(null);
    const amount = Number(fields.amount);
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setMessage("로그인이 필요해요.");
      setBusy(false);
      return;
    }
    const result = await createProposal(supabase, {
      tripId,
      proposerMemberId: meId,
      draft: {
        label: fields.label.trim(),
        amount,
        currency: fields.currency.trim().toUpperCase(),
        category: fields.category.trim() || "기타",
        spentOn: fields.spentOn || null,
        note: fields.note.trim() ? fields.note.trim() : null,
        items: [],
        source: usedReceipt ? "receipt" : "guest",
      },
    });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setOpen(false);
    setFields({ ...EMPTY, currency: defaultCurrency.toUpperCase() });
    setTouched({});
    setAiFilled(false);
    setUsedReceipt(false);
    setMessage("호스트가 확인하면 정산에 반영돼요.");
    await refreshMine();
  }

  async function withdraw(id: string) {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const { resolveProposal } = await import("@/lib/ledger/proposals-client");
    const result = await resolveProposal(supabase, {
      id,
      decision: "withdrawn",
    });
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    await refreshMine();
  }

  return (
    <section
      aria-label="지출 제안"
      className="rounded-xl border border-dashed border-line-muted bg-surface-soft px-3 py-4"
    >
      <p className="text-sm font-bold text-ink-heading">내가 낸 지출</p>
      <p className="mt-1 text-xs text-ink-muted">
        호스트가 승인하면 정산에 들어가요.
      </p>
      <button
        type="button"
        className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-brand px-3 text-sm font-bold text-white"
        onClick={() => {
          setOpen(true);
          void refreshMine();
        }}
      >
        내가 냈어요
      </button>

      {message ? (
        <p role="status" className="mt-2 text-xs text-ink-body">
          {message}
        </p>
      ) : null}

      {mine.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {mine.map((p) => (
            <li
              key={p.id}
              className="rounded-lg bg-surface-white px-3 py-2 text-xs ring-1 ring-line-soft"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-ink-heading">{p.label}</span>
                <span className="font-semibold">
                  {p.amount} {p.currency}
                </span>
              </div>
              <p className="mt-1 text-ink-muted">
                {p.status === "pending"
                  ? "대기 중"
                  : p.status === "approved"
                    ? "승인됨"
                    : p.status === "rejected"
                      ? `거절됨${p.rejectReason ? ` · ${p.rejectReason}` : ""}`
                      : "철회됨"}
              </p>
              {p.status === "pending" ? (
                <button
                  type="button"
                  className="mt-1 min-h-[44px] font-bold text-brand underline"
                  onClick={() => void withdraw(p.id)}
                >
                  철회
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="내가 낸 지출 제안"
      >
        <div className="flex flex-col gap-3">
          <label className="text-xs font-bold text-ink-heading">
            항목
            <input
              className="mt-1 min-h-[44px] w-full rounded-lg border border-line-soft px-3 text-sm"
              value={fields.label}
              onChange={(e) => {
                setTouched((t) => ({ ...t, label: true }));
                setFields((f) => ({ ...f, label: e.target.value }));
              }}
            />
          </label>
          <label className="text-xs font-bold text-ink-heading">
            금액
            <input
              inputMode="decimal"
              className="mt-1 min-h-[44px] w-full rounded-lg border border-line-soft px-3 text-sm"
              value={fields.amount}
              onChange={(e) => {
                setTouched((t) => ({ ...t, amount: true }));
                setFields((f) => ({ ...f, amount: e.target.value }));
              }}
            />
          </label>
          <label className="text-xs font-bold text-ink-heading">
            통화
            <input
              className="mt-1 min-h-[44px] w-full rounded-lg border border-line-soft px-3 text-sm uppercase"
              value={fields.currency}
              maxLength={3}
              onChange={(e) => {
                setTouched((t) => ({ ...t, currency: true }));
                setFields((f) => ({
                  ...f,
                  currency: e.target.value.toUpperCase(),
                }));
              }}
            />
          </label>
          <label className="text-xs font-bold text-ink-heading">
            날짜
            <input
              type="date"
              className="mt-1 min-h-[44px] w-full rounded-lg border border-line-soft px-3 text-sm"
              value={fields.spentOn}
              onChange={(e) => {
                setTouched((t) => ({ ...t, spentOn: true }));
                setFields((f) => ({ ...f, spentOn: e.target.value }));
              }}
            />
          </label>
          <label className="text-xs font-bold text-ink-heading">
            영수증 사진 (선택)
            <input
              type="file"
              accept="image/*"
              className="mt-1 block w-full text-xs"
              disabled={busy}
              onChange={(e) => void onPickImage(e.target.files?.[0] ?? null)}
            />
          </label>
          {aiFilled ? (
            <p className="text-xs font-semibold text-brand">
              AI가 채웠어요. 확인해 주세요.
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy}
            className="min-h-[44px] rounded-xl bg-brand text-sm font-bold text-white disabled:opacity-60"
            onClick={() => void submit()}
          >
            제안 보내기
          </button>
        </div>
      </Sheet>
    </section>
  );
}
