"use client";

import { useEffect, useMemo, useState } from "react";
import type { ExpenseDraftInput } from "@/lib/ledger/draft";
import {
  findDuplicateCandidates,
  type DuplicateCandidate,
} from "@/lib/ledger/dedupe";
import { getFxQuote } from "@/lib/ledger/fx";
import { computeKrw } from "@/lib/ledger/money";
import { computeShares } from "@/lib/ledger/settle";
import { listExpenses, saveExpense } from "@/lib/ledger/supabase";
import type { TripMember } from "@/lib/ledger/types";
import { formatKRW } from "@/lib/shared/format";
import { getBrowserSupabase } from "@/lib/supabase/browser";

const CATEGORIES = ["식비", "교통", "숙소", "관광", "쇼핑", "기타"] as const;
const CURRENCIES = ["KRW", "JPY", "USD", "EUR", "THB", "VND", "TWD", "GBP"] as const;

type CardProfile = {
  id: string;
  label: string;
  fee_rate: number | null;
  fee_flat_krw: number;
};

type Props = {
  tripId: string;
  members: TripMember[];
  drafts: ExpenseDraftInput[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  onSaved: () => void;
  cardProfiles?: CardProfile[];
};

export function ExpenseConfirmSheet({
  tripId,
  members,
  drafts,
  index,
  onIndexChange,
  onClose,
  onSaved,
  cardProfiles = [],
}: Props) {
  const draft = drafts[index];
  const [merchant, setMerchant] = useState(draft?.merchant ?? "");
  const [merchantKo, setMerchantKo] = useState(draft?.merchantKo ?? "");
  const [amount, setAmount] = useState(String(draft?.amount ?? ""));
  const [currency, setCurrency] = useState(
    (draft?.currency ?? "KRW").toUpperCase()
  );
  const [spentOn, setSpentOn] = useState(draft?.spentOn ?? "");
  const [category, setCategory] = useState(draft?.category ?? "기타");
  const [paymentMethod, setPaymentMethod] = useState<
    "card" | "cash" | "transfer"
  >(draft?.paymentMethod ?? "card");
  const [payerId, setPayerId] = useState(
    draft?.payerMemberId ?? members.find((m) => m.isOwner)?.id ?? members[0]?.id ?? ""
  );
  const [participants, setParticipants] = useState<string[]>(
    draft?.participantMemberIds?.length
      ? draft.participantMemberIds
      : members.map((m) => m.id)
  );
  const [splitType, setSplitType] = useState<"equal" | "fixed" | "ratio">(
    draft?.splitType === "fixed" || draft?.splitType === "ratio"
      ? draft.splitType
      : "equal"
  );
  const [cardProfileId, setCardProfileId] = useState<string>("");
  const [fxRate, setFxRate] = useState<number | null>(null);
  const [fxMeta, setFxMeta] = useState<{
    rateDate: string | null;
    source: string;
    isFallback: boolean;
  } | null>(null);
  const [feeUnset, setFeeUnset] = useState(true);
  const [feeRate, setFeeRate] = useState<number | null>(null);
  const [feeFlat, setFeeFlat] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dupes, setDupes] = useState<DuplicateCandidate[]>([]);
  const [ignoreDupes, setIgnoreDupes] = useState(false);

  useEffect(() => {
    if (!draft) return;
    setMerchant(draft.merchant ?? "");
    setMerchantKo(draft.merchantKo ?? "");
    setAmount(String(draft.amount ?? ""));
    setCurrency((draft.currency ?? "KRW").toUpperCase());
    setSpentOn(draft.spentOn ?? "");
    setCategory(draft.category ?? "기타");
    setPaymentMethod(draft.paymentMethod ?? "card");
    setPayerId(
      draft.payerMemberId ??
        members.find((m) => m.isOwner)?.id ??
        members[0]?.id ??
        ""
    );
    setParticipants(
      draft.participantMemberIds?.length
        ? draft.participantMemberIds
        : members.map((m) => m.id)
    );
    setSplitType(
      draft.splitType === "fixed" || draft.splitType === "ratio"
        ? draft.splitType
        : "equal"
    );
    setError("");
    setIgnoreDupes(false);
    setDupes([]);
  }, [draft, members, index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    async function loadFx() {
      if (!spentOn || !currency || !payerId) return;
      const q = await getFxQuote({
        tripId,
        currency,
        date: spentOn,
        paymentMethod,
        payerMemberId: payerId,
      });
      if (cancelled) return;
      if (q) {
        setFxRate(q.rate);
        setFxMeta({
          rateDate: q.rateDate,
          source: q.source,
          isFallback: q.isFallback,
        });
      } else if (currency === "KRW") {
        setFxRate(1);
        setFxMeta({ rateDate: spentOn, source: "auto_daily", isFallback: false });
      } else {
        setFxRate(null);
        setFxMeta(null);
      }
    }
    void loadFx();
    return () => {
      cancelled = true;
    };
  }, [tripId, currency, spentOn, paymentMethod, payerId]);

  useEffect(() => {
    const p = cardProfiles.find((c) => c.id === cardProfileId);
    if (!p) {
      setFeeUnset(true);
      setFeeRate(null);
      setFeeFlat(0);
      return;
    }
    setFeeUnset(p.fee_rate == null);
    setFeeRate(p.fee_rate);
    setFeeFlat(p.fee_flat_krw ?? 0);
  }, [cardProfileId, cardProfiles]);

  const amountNum = Number(amount);

  useEffect(() => {
    let cancelled = false;
    async function checkDupes() {
      if (!draft || !(amountNum > 0) || !currency || !spentOn) {
        setDupes([]);
        return;
      }
      const supabase = getBrowserSupabase();
      if (!supabase) return;
      const existing = await listExpenses(supabase, tripId);
      if (cancelled) return;
      const hits = findDuplicateCandidates(
        {
          currency,
          amount: amountNum,
          merchant: merchant || draft.merchant || "",
          spentOn,
          paidAt: draft.paidAt,
          kind: draft.kind,
          fxRateToKrw: fxRate ?? undefined,
        },
        existing.map((e) => ({
          id: e.id,
          currency: e.currency,
          amount: e.amount,
          merchant: e.merchant || e.label,
          spentOn: e.spentOn ?? "",
          krwAmount: e.krwAmount,
          paidAt: e.paidAt,
        }))
      );
      setDupes(hits);
    }
    void checkDupes();
    return () => {
      cancelled = true;
    };
  }, [draft, tripId, amountNum, currency, spentOn, merchant, fxRate]);
  const breakdown = useMemo(() => {
    if (!(amountNum > 0) || !(fxRate && fxRate > 0)) return null;
    return computeKrw({
      amount: amountNum,
      fxRate,
      feeRate: paymentMethod === "card" ? feeRate : 0,
      feeFlatKrw: paymentMethod === "card" ? feeFlat : 0,
    });
  }, [amountNum, fxRate, feeRate, feeFlat, paymentMethod]);

  const sharesOk = useMemo(() => {
    if (!breakdown) return false;
    const r = computeShares({
      type: splitType === "fixed" || splitType === "ratio" ? "equal" : splitType,
      krwAmount: breakdown.krwAmount,
      participants,
    });
    // confirm sheet: equal only for save path unless fixed inputs added later
    return r.ok && participants.length > 0;
  }, [breakdown, splitType, participants]);

  const canSave =
    Boolean(merchant.trim()) &&
    amountNum > 0 &&
    Boolean(currency) &&
    Boolean(spentOn) &&
    Boolean(payerId) &&
    Boolean(breakdown) &&
    sharesOk &&
    !(fxMeta?.isFallback && fxRate == null) &&
    (dupes.length === 0 || ignoreDupes);

  async function handleSave() {
    if (!canSave || !breakdown || !fxRate) return;
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setError("로그인이 필요해요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const row = await saveExpense(supabase, {
        tripId,
        paidBy: payerId,
        merchant: merchant.trim(),
        merchantKo: merchantKo.trim() || null,
        category,
        amount: amountNum,
        currency,
        paymentMethod,
        cardProfileId: cardProfileId || null,
        cardLabel:
          cardProfiles.find((c) => c.id === cardProfileId)?.label ?? null,
        fxRate,
        fxRateDate: fxMeta?.rateDate ?? null,
        fxSource: fxMeta?.source === "cash_manual" ? "cash_manual" : "auto_daily",
        fxIsFallback: fxMeta?.isFallback ?? false,
        feeRate: paymentMethod === "card" ? feeRate : 0,
        feeFlatKrw: paymentMethod === "card" ? feeFlat : 0,
        source:
          draft?.source === "receipt"
            ? "receipt"
            : draft?.source === "voice"
              ? "voice"
              : draft?.source === "sms" || draft?.source === "push"
                ? "sms"
                : "manual",
        rawInput: draft?.rawInput ?? null,
        items: draft?.items ?? [],
        spentOn,
        paidAt: draft?.paidAt ?? null,
        splitType: "equal",
        participants,
      });
      if (!row) {
        setError("저장에 실패했어요.");
        return;
      }
      if (index + 1 < drafts.length) onIndexChange(index + 1);
      else {
        onSaved();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  if (!draft) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface-white p-4 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-ink-heading">
            지출 확인
            {drafts.length > 1 ? (
              <span className="ml-2 text-xs font-semibold text-ink-muted">
                {index + 1}/{drafts.length}
              </span>
            ) : null}
          </h3>
          <button
            type="button"
            className="text-xs font-bold text-ink-muted"
            onClick={onClose}
          >
            닫기
          </button>
        </div>

        {dupes.length > 0 && !ignoreDupes ? (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
            <p className="font-bold text-amber-900">같은 결제 같아요</p>
            <p className="mt-1 text-amber-800">
              후보 {dupes.length}건 · 점수 {dupes[0]!.score}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="font-bold text-amber-900 underline"
                onClick={onClose}
              >
                합치기(저장 취소)
              </button>
              <button
                type="button"
                className="font-bold text-amber-900 underline"
                onClick={() => setIgnoreDupes(true)}
              >
                다른 결제예요
              </button>
            </div>
          </div>
        ) : null}

        {(draft.warnings?.length || (feeUnset && paymentMethod === "card")) && (
          <ul className="mb-3 flex flex-col gap-1">
            {draft.timeIsEstimated ? (
              <li className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">
                시간 추정
              </li>
            ) : null}
            {feeUnset && paymentMethod === "card" ? (
              <li className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">
                수수료 미설정
              </li>
            ) : null}
            {(draft.warnings ?? []).map((w) => (
              <li
                key={w}
                className="rounded-md bg-surface-soft px-2 py-1 text-[11px] font-semibold text-ink-body"
              >
                {w}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold">상호(원문)</span>
            <input
              className="rounded-lg border border-line px-3 py-2"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold">상호(한국어)</span>
            <input
              className="rounded-lg border border-line px-3 py-2"
              value={merchantKo}
              onChange={(e) => setMerchantKo(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold">금액</span>
              <input
                inputMode="decimal"
                className="rounded-lg border border-line px-3 py-2"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold">통화</span>
              <select
                className="rounded-lg border border-line px-3 py-2"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold">날짜</span>
            <input
              type="date"
              className="rounded-lg border border-line px-3 py-2"
              value={spentOn}
              onChange={(e) => setSpentOn(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold">카테고리</span>
            <select
              className="rounded-lg border border-line px-3 py-2"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            {(["card", "cash", "transfer"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  paymentMethod === m
                    ? "bg-brand text-white"
                    : "bg-surface-soft text-ink-body"
                }`}
                onClick={() => setPaymentMethod(m)}
              >
                {m === "card" ? "카드" : m === "cash" ? "현금" : "이체"}
              </button>
            ))}
          </div>
          {paymentMethod === "card" && cardProfiles.length > 0 ? (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold">카드 프로필</span>
              <select
                className="rounded-lg border border-line px-3 py-2"
                value={cardProfileId}
                onChange={(e) => setCardProfileId(e.target.value)}
              >
                <option value="">선택 안 함</option>
                {cardProfiles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold">결제자</span>
            <select
              className="rounded-lg border border-line px-3 py-2"
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs font-bold">참여자</legend>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const on = participants.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className={`cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold ${
                      on ? "bg-brand/15 text-brand" : "bg-surface-soft"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mr-1"
                      checked={on}
                      onChange={() =>
                        setParticipants((prev) =>
                          on
                            ? prev.filter((id) => id !== m.id)
                            : [...prev, m.id]
                        )
                      }
                    />
                    {m.displayName}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {breakdown && fxRate != null ? (
            <div className="rounded-xl bg-surface-soft px-3 py-2 text-xs">
              <p className="font-bold text-ink-heading">
                약 {formatKRW(breakdown.krwBase)}
                {breakdown.feeKrw > 0
                  ? ` + 수수료 ${formatKRW(breakdown.feeKrw)}`
                  : ""}{" "}
                = {formatKRW(breakdown.krwAmount)}
              </p>
              <p className="mt-1 text-ink-muted">
                환율 {fxRate}
                {fxMeta?.rateDate ? ` · 기준일 ${fxMeta.rateDate}` : ""}
                {fxMeta?.source === "cash_manual" ? " · 현금 환율" : " · 일자별"}
                {fxMeta?.isFallback ? " · 대체값(확인 필요)" : ""}
              </p>
              <label className="mt-2 flex items-center gap-2">
                <span>환율 직접 수정</span>
                <input
                  inputMode="decimal"
                  className="w-28 rounded border border-line px-2 py-1"
                  value={String(fxRate)}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n) && n > 0) setFxRate(n);
                  }}
                />
              </label>
            </div>
          ) : (
            <p className="text-xs font-semibold text-danger">
              {paymentMethod === "cash"
                ? "현금 환율을 입력하거나 설정해 주세요."
                : "환율을 불러오는 중이거나 실패했어요."}
            </p>
          )}
        </div>

        {error ? (
          <p className="mt-2 text-xs font-semibold text-danger">{error}</p>
        ) : null}

        <button
          type="button"
          disabled={!canSave || saving}
          className="mt-4 w-full rounded-xl bg-brand py-3 text-sm font-extrabold text-white disabled:opacity-40"
          onClick={() => void handleSave()}
        >
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>
    </div>
  );
}
