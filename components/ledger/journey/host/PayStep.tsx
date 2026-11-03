"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BottomCTA } from "@/components/ds/BottomCTA";
import { Button } from "@/components/ds/Button";
import { EmptyState } from "@/components/ds/EmptyState";
import { ProgressRing } from "@/components/ds/ProgressRing";
import { Sheet } from "@/components/ds/Sheet";
import { SettlementHistory } from "@/components/ledger/SettlementHistory";
import {
  useSettleReference,
  type SettleReference,
} from "@/components/ledger/useSettleReference";
import { useClipboardCopy } from "@/components/onboarding/connect/useClipboardCopy";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  PAY_APPS,
  PAY_DEEPLINK_NOTICE,
  PAY_OPEN_FAILED_MESSAGE,
  launchPayApp,
  payAmountText,
  payGuidance,
  type PayApp,
} from "@/lib/ledger/pay-links";
import {
  basisHash,
  computeBalances,
  type LedgerExpense,
} from "@/lib/ledger/settle";
import {
  buildShareText,
  shareReasonMessage,
} from "@/lib/ledger/settle-share";
import {
  fetchLatestSettlement,
  fetchSettlementHistory,
  listExpenses,
  listMembers,
  listVoidedExpenseIds,
  type SettlementHistoryItem,
  type SettlementSnapshot,
} from "@/lib/ledger/supabase";
import type { TripMember } from "@/lib/ledger/types";
import { formatKRW } from "@/lib/shared/format";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Props = {
  tripId: string;
  /** page = settle URL 아래 조합. journey = TripJourney 송금 칸. */
  mode?: "page" | "journey";
  /** 호스트 CTA(공유/리캡) vs 게스트 CTA(내 송금·완료) */
  audience?: "host" | "guest";
  /** 정산표가 없을 때 정산 단계로 */
  onSettle?: () => void;
  /** 호스트: 모두 송금 완료 시 리캡. 게스트: 내 송금 끝나면 완료 단계 */
  onRecap?: () => void;
  onDone?: () => void;
  /** settle URL 에서 SettleStep 과 공유할 참고 환율 상태 */
  reference?: SettleReference;
};

/**
 * 호스트 ⑥ 송금 단계. ProgressRing · 송금 목록(앱 열기·완료) · 공유 · 이전 정산(시트).
 * 금액 계산은 하지 않고, 저장된 정산표·RPC(mark_transfer_paid)만 써요.
 */
export function PayStep({
  tripId,
  mode = "journey",
  audience = "host",
  onSettle,
  onRecap,
  onDone,
  reference: referenceProp,
}: Props) {
  const { user } = useAuth();
  const [members, setMembers] = useState<TripMember[]>([]);
  const [expenses, setExpenses] = useState<LedgerExpense[]>([]);
  const [fxFallbackCount, setFxFallbackCount] = useState(0);
  const [settlement, setSettlement] = useState<SettlementSnapshot | null>(null);
  const [history, setHistory] = useState<SettlementHistoryItem[]>([]);
  const [basisState, setBasisState] = useState<{
    source: LedgerExpense[];
    hash: string;
  } | null>(null);
  const [msg, setMsg] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [payNote, setPayNote] = useState("");
  const [origin, setOrigin] = useState("");
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const textCopy = useClipboardCopy();
  const linkCopy = useClipboardCopy();
  const amountCopy = useClipboardCopy();
  const payCleanup = useRef<(() => void) | null>(null);
  const localReference = useSettleReference();
  const reference = referenceProp ?? localReference;

  useEffect(() => {
    setOrigin(window.location.origin);
    setCanNativeShare(typeof navigator.share === "function");
    return () => payCleanup.current?.();
  }, []);

  const loadSettlement = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const res = await fetchLatestSettlement(supabase, tripId);
    if (!res.ok) {
      setLoadError(true);
      return;
    }
    setSettlement(res.settlement);
    const past = await fetchSettlementHistory(supabase, tripId);
    if (past) setHistory(past);
  }, [tripId]);

  const reload = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const [m, e, voided] = await Promise.all([
      listMembers(supabase, tripId),
      listExpenses(supabase, tripId),
      listVoidedExpenseIds(supabase, tripId),
    ]);
    if (voided === null) setLoadError(true);
    const active = e.filter((row) => !voided?.has(row.id));
    setMembers(m);
    setExpenses(
      active.map((row) => ({
        id: row.id,
        paidBy: row.paidBy,
        krwAmount: row.krwAmount,
        shares: row.shares,
      }))
    );
    setFxFallbackCount(active.filter((row) => row.fxIsFallback).length);
    await loadSettlement();
    setLoaded(true);
  }, [tripId, loadSettlement]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    void basisHash(expenses).then((hash) => {
      if (!cancelled) setBasisState({ source: expenses, hash });
    });
    return () => {
      cancelled = true;
    };
  }, [expenses]);

  const balances = useMemo(
    () =>
      computeBalances(
        members.map((m) => m.id),
        expenses
      ),
    [members, expenses]
  );

  const names = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m.displayName])),
    [members]
  );
  const nameOf = (id: string) => names[id] ?? "?";

  const me = useMemo(
    () =>
      user ? members.find((m) => m.userId && m.userId === user.id) : undefined,
    [members, user]
  );

  const basis =
    loaded && basisState && basisState.source === expenses
      ? basisState.hash
      : "";
  const transfers = useMemo(() => settlement?.transfers ?? [], [settlement]);
  const status = settlement?.status ?? "";
  const sharePath = settlement?.shareToken ? `/s/${settlement.shareToken}` : "";
  const shareUrl = sharePath && origin ? `${origin}${sharePath}` : "";

  const stale = Boolean(
    settlement &&
      (settlement.status === "stale" ||
        (basis && basis !== settlement.basisHash))
  );
  const allPaid =
    transfers.length > 0 && transfers.every((t) => t.status === "paid");
  const completed = status === "completed" || allPaid;
  const paidCount = transfers.filter((t) => t.status === "paid").length;
  const isOwner = Boolean(me?.isOwner);
  const myOutgoing = transfers.filter((t) => me && t.from === me.id);
  const myOutgoingUnpaid = myOutgoing.filter((t) => t.status !== "paid");
  const myOutgoingDone =
    myOutgoing.length > 0 && myOutgoingUnpaid.length === 0;
  const visibleTransfers =
    audience === "guest" && me
      ? transfers.filter((t) => t.from === me.id || t.to === me.id)
      : transfers;

  const shareResult = useMemo(() => {
    if (!settlement || transfers.length === 0) return null;
    return buildShareText({
      names,
      transfers,
      balances,
      shareUrl: shareUrl || null,
      fxFallbackCount,
      conversion: reference.shareConversion,
    });
  }, [
    settlement,
    transfers,
    names,
    balances,
    shareUrl,
    fxFallbackCount,
    reference.shareConversion,
  ]);

  const shareText = !stale && shareResult?.ok ? shareResult.text : null;
  const shareBlockedMessage = stale
    ? "지출이 바뀌어서 공유 문구를 만들 수 없어요. 정산을 다시 계산해 주세요."
    : shareResult && !shareResult.ok
      ? shareReasonMessage(shareResult.reason)
      : "";

  async function markPaid(transferId: string) {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const { error } = await supabase.rpc("mark_transfer_paid", {
      p_transfer_id: transferId,
    });
    if (error) {
      console.error("[mark_transfer_paid]", error.message);
      setMsg("완료 처리 실패");
      return;
    }
    setMsg("");
    await loadSettlement();
  }

  async function copyShareText() {
    if (!shareText) return;
    await textCopy.copy(shareText);
  }

  async function copyShareLink() {
    if (!shareUrl) return;
    await linkCopy.copy(shareUrl);
  }

  async function nativeShare() {
    if (!shareText || typeof navigator.share !== "function") return;
    try {
      await navigator.share({
        title: "정산 안내",
        text: shareText,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      console.error("[navigator.share]", e instanceof Error ? e.message : e);
      setMsg("공유하지 못했어요. 복사해서 보내 주세요.");
    }
  }

  function openPayApp(app: PayApp, krw: number) {
    const amount = payAmountText(krw);
    if (!amount) {
      setMsg("금액을 확인할 수 없어요.");
      return;
    }
    void amountCopy.copy(amount).then((ok) => {
      setPayNote((prev) =>
        prev === PAY_OPEN_FAILED_MESSAGE
          ? prev
          : ok
            ? payGuidance(app.label, formatKRW(krw))
            : `금액을 복사하지 못했어요. ${formatKRW(krw)}을 직접 입력해 주세요.`
      );
    });
    setPayNote(payGuidance(app.label, formatKRW(krw)));
    payCleanup.current?.();
    payCleanup.current = launchPayApp(app.id, {
      onFallback: () => setPayNote(PAY_OPEN_FAILED_MESSAGE),
    });
  }

  const settleHref = `/trips/${tripId}/ledger?step=settle`;
  const recapHref = `/trips/${tripId}/ledger/recap`;

  if (loaded && !settlement) {
    return (
      <div className={mode === "page" ? "pb-8" : "pb-24"}>
        <EmptyState
          icon={Wallet}
          title="먼저 정산을 계산해요"
          body={
            audience === "guest"
              ? "호스트가 정산을 만들면 내가 보낼 금액이 여기에 보여요."
              : "호스트가 정산표를 만들면 여기서 송금할 수 있어요."
          }
          action={
            audience === "guest" ? undefined : onSettle ? (
              <Button onClick={onSettle}>정산하러 가기</Button>
            ) : (
              <Link
                href={settleHref}
                className="mu-focus text-mu-label text-mu-accent"
              >
                정산 화면 보기
              </Link>
            )
          }
        />
      </div>
    );
  }

  return (
    <div
      className={
        mode === "page"
          ? "flex flex-col gap-4 pb-8"
          : "flex flex-col gap-4 pb-24"
      }
    >
      {mode === "journey" ? (
        <div>
          <h2 className="text-mu-title text-mu-fg">송금을 챙겨요</h2>
          <p className="mt-1 text-mu-body text-mu-fg-2">
            {audience === "guest"
              ? "내 송금만 보여요. 앱에서 보낸 뒤 ‘송금 완료’를 눌러 주세요."
              : "앱에서 직접 송금한 뒤, 여기서 완료를 눌러 주세요."}
          </p>
        </div>
      ) : null}

      {loadError ? (
        <p className="rounded-mu-md bg-mu-warn/10 px-3 py-2 text-mu-caption font-semibold text-mu-warn">
          정산 정보를 모두 불러오지 못했어요. 새로고침해 주세요.
        </p>
      ) : null}

      {stale ? (
        <div className="rounded-mu-md bg-mu-warn/10 px-3 py-2 text-mu-caption font-semibold text-mu-warn">
          <p>송금표가 최신이 아니에요. 정산 단계에서 다시 계산해 주세요.</p>
          {onSettle ? (
            <button
              type="button"
              className="mt-2 min-h-tap text-mu-caption font-bold text-mu-accent"
              onClick={onSettle}
            >
              정산 단계로
            </button>
          ) : (
            <Link
              href={settleHref}
              className="mt-2 inline-flex min-h-tap items-center text-mu-caption font-bold text-mu-accent"
            >
              정산 단계로
            </Link>
          )}
        </div>
      ) : null}

      {settlement?.origin === "auto" && !completed ? (
        <div className="rounded-mu-md bg-mu-bg px-3 py-2 text-mu-caption font-semibold text-mu-fg-2">
          자동으로 만든 정산 제안이에요. 금액을 확인하고 직접 송금해 주세요.
        </div>
      ) : null}

      {completed ? (
        <p
          role="status"
          className="rounded-mu-md bg-mu-ok/10 px-3 py-2 text-mu-caption font-bold text-mu-ok"
        >
          정산 완료
        </p>
      ) : null}

      {settlement && visibleTransfers.length > 0 ? (
        <div className="flex items-center gap-3 rounded-mu-md border border-mu-line bg-mu-card p-3">
          <ProgressRing
            value={
              audience === "guest"
                ? myOutgoing.filter((t) => t.status === "paid").length
                : paidCount
            }
            max={
              audience === "guest"
                ? Math.max(myOutgoing.length, 1)
                : transfers.length
            }
            size={72}
            label={
              audience === "guest"
                ? `내 송금 ${myOutgoing.filter((t) => t.status === "paid").length}/${myOutgoing.length || 0} 완료`
                : `${paidCount}/${transfers.length} 송금 완료`
            }
          />
          <p className="text-mu-body font-bold text-mu-fg">
            {audience === "guest"
              ? `내 송금 ${myOutgoing.filter((t) => t.status === "paid").length}/${myOutgoing.length || 0} 완료`
              : `${paidCount}/${transfers.length} 완료`}
          </p>
        </div>
      ) : null}

      <ul className="flex flex-col gap-2">
        {visibleTransfers.map((t) => {
          const mineOut = Boolean(me && t.from === me.id);
          const canMark = isOwner || mineOut;
          return (
            <li
              key={t.id}
              className="flex flex-col gap-2 rounded-mu-md border border-mu-line bg-mu-card p-3 text-mu-body"
            >
              <div className="flex items-center justify-between gap-2">
                <span>
                  {nameOf(t.from)} → {nameOf(t.to)}{" "}
                  <strong className="mu-num">{formatKRW(t.krw)}</strong>
                </span>
                {t.status === "paid" ? (
                  <span className="text-mu-caption font-bold text-mu-ok">
                    완료
                  </span>
                ) : canMark ? (
                  <button
                    type="button"
                    className="min-h-tap min-w-tap px-2 text-mu-caption font-bold text-mu-accent"
                    onClick={() => void markPaid(t.id)}
                  >
                    송금 완료
                  </button>
                ) : null}
              </div>
              {t.status !== "paid" && mineOut && !stale ? (
                <div className="flex flex-wrap gap-2">
                  {PAY_APPS.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      className="min-h-tap rounded-mu-sm border border-mu-accent px-3 text-mu-caption font-bold text-mu-accent"
                      onClick={() => openPayApp(app, t.krw)}
                    >
                      {app.label} 열기
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {payNote ? (
        <div
          role="status"
          className="rounded-mu-md bg-mu-bg px-3 py-2 text-mu-caption text-mu-fg-2"
        >
          <p>{payNote}</p>
          <p className="mt-1 font-semibold">{PAY_DEEPLINK_NOTICE}</p>
          {amountCopy.label ? (
            <p className="mt-1 text-mu-fg-3">{amountCopy.label}</p>
          ) : null}
        </div>
      ) : null}

      {audience === "host" && settlement && transfers.length > 0 ? (
        <section
          aria-label="정산 공유"
          className="flex flex-col gap-2 rounded-mu-md bg-mu-bg p-3 text-mu-caption"
        >
          <p className="font-bold text-mu-fg">동행에게 공유하기</p>
          {shareBlockedMessage ? (
            <p className="font-semibold text-mu-warn">{shareBlockedMessage}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!shareText}
              className="min-h-tap rounded-mu-sm bg-mu-accent px-3 font-bold text-white disabled:opacity-40"
              onClick={() => void copyShareText()}
            >
              {textCopy.label ?? "문구 복사"}
            </button>
            {canNativeShare ? (
              <button
                type="button"
                disabled={!shareText}
                className="min-h-tap rounded-mu-sm border border-mu-accent px-3 font-bold text-mu-accent disabled:opacity-40"
                onClick={() => void nativeShare()}
              >
                공유하기
              </button>
            ) : null}
            {shareUrl ? (
              <button
                type="button"
                className="min-h-tap rounded-mu-sm border border-mu-accent px-3 font-bold text-mu-accent"
                onClick={() => void copyShareLink()}
              >
                {linkCopy.label ?? "링크 복사"}
              </button>
            ) : null}
          </div>
          {sharePath ? (
            <Link className="break-all text-mu-accent" href={sharePath}>
              {sharePath}
            </Link>
          ) : null}
        </section>
      ) : null}

      {mode === "journey" && audience === "host" ? (
        <>
          <button
            type="button"
            className="min-h-tap self-start text-mu-caption font-bold text-mu-accent"
            onClick={() => setHistoryOpen(true)}
          >
            이전 정산 보기
          </button>
          <Sheet
            open={historyOpen}
            onClose={() => setHistoryOpen(false)}
            title="이전 정산"
          >
            <SettlementHistory
              items={history}
              currentId={settlement?.id ?? null}
              origin={origin}
            />
          </Sheet>
        </>
      ) : null}

      {mode === "page" ? (
        <SettlementHistory
          items={history}
          currentId={settlement?.id ?? null}
          origin={origin}
        />
      ) : null}

      {msg ? <p className="text-mu-caption text-mu-fg-3">{msg}</p> : null}

      {mode === "journey" && audience === "host" ? (
        <BottomCTA
          label={completed ? "리캡 보기" : "정산 현황 공유하기"}
          onClick={() => {
            if (completed) {
              if (onRecap) onRecap();
              else window.location.href = recapHref;
              return;
            }
            void copyShareText();
          }}
          disabled={!completed && !shareText}
          hint={
            completed
              ? undefined
              : shareText
                ? "문구를 복사해 동행에게 보내요"
                : shareBlockedMessage || undefined
          }
        />
      ) : null}

      {mode === "journey" && audience === "guest" ? (
        <BottomCTA
          label={
            myOutgoingDone || myOutgoing.length === 0
              ? "완료 확인"
              : "송금 완료했어요"
          }
          onClick={() => {
            if (myOutgoingDone || myOutgoing.length === 0) {
              onDone?.();
              return;
            }
            setMsg(
              "아직 보낼 송금이 있어요. 앱에서 보낸 뒤 각 항목의 ‘송금 완료’를 눌러 주세요."
            );
          }}
          hint={
            myOutgoingUnpaid.length > 0
              ? `남은 송금 ${myOutgoingUnpaid.length}건`
              : myOutgoing.length === 0
                ? "내가 보낼 금액은 없어요"
                : undefined
          }
        />
      ) : null}
    </div>
  );
}
