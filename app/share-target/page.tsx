"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Share2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExpenseConfirmSheet } from "@/components/ledger/ExpenseConfirmSheet";
import { PasteExpenseBox } from "@/components/ledger/PasteExpenseBox";
import { ReceiptUploader } from "@/components/ledger/ReceiptUploader";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { ExpenseDraftInput } from "@/lib/ledger/draft";
import { resizeImageToJpeg } from "@/lib/ledger/image";
import { receiptResponseToDraft } from "@/lib/ledger/receipt-client";
import {
  combineShareText,
  deleteShareInbox,
  isShareTargetSupported,
  isIosDevice,
  purgeExpiredShareInbox,
  readShareInbox,
} from "@/lib/ledger/share-inbox";
import {
  ensureOwnerMember,
  listCardProfiles,
  listMembers,
} from "@/lib/ledger/supabase";
import type { TripMember } from "@/lib/ledger/types";
import { suggestTripDates } from "@/lib/ledger/trip-dates";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useTrips } from "@/lib/trips/TripProvider";
import type { Trip } from "@/lib/trips/types";

type PendingShare = {
  inboxId?: string;
  text: string;
  file: File | null;
};

function pickPreferredTrip(trips: Trip[]): Trip | null {
  const today = new Date().toISOString().slice(0, 10);
  const active = trips.filter((t) => t.status !== "completed");
  for (const trip of active) {
    const range = suggestTripDates(trip.dateRange, today);
    if (range && today >= range.startDate && today <= range.endDate) {
      return trip;
    }
  }
  if (active.length === 1) return active[0] ?? null;
  const ongoing = active.find((t) => t.status === "ongoing");
  return ongoing ?? active[0] ?? null;
}

export default function ShareTargetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, provider, isReady: authReady } = useAuth();
  const { trips, isReady: tripsReady } = useTrips();

  const [tripId, setTripId] = useState<string>("");
  const [members, setMembers] = useState<TripMember[]>([]);
  const [profiles, setProfiles] = useState<
    Array<{
      id: string;
      label: string;
      fee_rate: number | null;
      fee_flat_krw: number;
    }>
  >([]);
  const [pending, setPending] = useState<PendingShare | null>(null);
  const [loadError, setLoadError] = useState("");
  const [processError, setProcessError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [queue, setQueue] = useState<ExpenseDraftInput[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const processedRef = useRef<string | null>(null);

  const shareCapable = isShareTargetSupported();
  const activeTrips = useMemo(
    () => trips.filter((t) => t.status !== "completed"),
    [trips]
  );

  useEffect(() => {
    void purgeExpiredShareInbox();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadPayload() {
      setLoadError("");
      const id = searchParams.get("id");
      const textParam = searchParams.get("text");

      if (id) {
        const payload = await readShareInbox(id);
        if (cancelled) return;
        if (!payload) {
          setLoadError("공유 내용을 찾지 못했어요. 다시 공유해 주세요.");
          router.replace("/share-target");
          return;
        }
        setPending({
          inboxId: id,
          text: combineShareText(payload.meta),
          file: payload.file,
        });
        return;
      }

      if (textParam?.trim()) {
        setPending({
          text: textParam.trim().slice(0, 2000),
          file: null,
        });
        router.replace("/share-target");
      }
    }
    void loadPayload();
    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  useEffect(() => {
    if (!tripsReady || activeTrips.length === 0) return;
    if (tripId && activeTrips.some((t) => t.id === tripId)) return;
    const preferred = pickPreferredTrip(trips);
    if (preferred) setTripId(preferred.id);
  }, [tripsReady, trips, activeTrips, tripId]);

  const loadLedger = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase || !user || provider === "guest" || !tripId) return;
    let m = await listMembers(supabase, tripId);
    if (m.length === 0) {
      await ensureOwnerMember(
        supabase,
        tripId,
        user.id,
        user.user_metadata?.name?.trim() ||
          user.user_metadata?.nickname?.trim() ||
          "나"
      );
      m = await listMembers(supabase, tripId);
    }
    const p = await listCardProfiles(supabase);
    setMembers(m);
    setProfiles(p as typeof profiles);
  }, [tripId, user, provider]);

  useEffect(() => {
    void loadLedger();
  }, [loadLedger]);

  const cleanupPending = useCallback(async (inboxId?: string) => {
    if (inboxId) await deleteShareInbox(inboxId);
    setPending(null);
    processedRef.current = null;
  }, []);

  useEffect(() => {
    const share = pending;
    if (!share || !authReady) return;
    if (!user || provider === "guest") return;

    const shareInboxId = share.inboxId;
    const shareText = share.text;
    const shareFile = share.file;

    // Images still need a trip (receipt flow). Text can go unassigned.
    if (shareFile && !tripId) return;
    if (shareFile && members.length === 0) return;
    if (!shareFile && !shareText.trim()) return;

    const key = `${shareInboxId ?? "text"}:${shareText}:${shareFile?.name ?? ""}:${tripId || "none"}`;
    if (processedRef.current === key) return;
    processedRef.current = key;

    let cancelled = false;

    async function run() {
      setProcessing(true);
      setProcessError("");
      try {
        if (shareFile && tripId) {
          let resized: File;
          try {
            resized = await resizeImageToJpeg(shareFile);
          } catch {
            resized = shareFile;
          }
          const fd = new FormData();
          fd.set("tripId", tripId);
          fd.set("image", resized);
          const res = await fetch("/api/ledger/receipt", { method: "POST", body: fd });
          if (cancelled) return;
          if (!res.ok) {
            setProcessError(
              res.status === 401
                ? "로그인이 필요해요."
                : "영수증 인식에 실패했어요."
            );
            processedRef.current = null;
            return;
          }
          const data = (await res.json()) as Parameters<
            typeof receiptResponseToDraft
          >[0];
          const mapped = receiptResponseToDraft(data);
          if (!mapped.ok) {
            setProcessError("영수증이 아닌 것 같아요.");
            processedRef.current = null;
            return;
          }
          setQueue([mapped.draft]);
          setQueueIndex(0);
        } else if (shareText.trim() && tripId) {
          const res = await fetch("/api/ledger/parse-text", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tripId,
              text: shareText.trim(),
              source: "push",
            }),
          });
          if (cancelled) return;
          if (!res.ok) {
            setProcessError(
              res.status === 401
                ? "로그인이 필요해요."
                : "텍스트 분석에 실패했어요."
            );
            processedRef.current = null;
            return;
          }
          const data = (await res.json()) as { drafts?: ExpenseDraftInput[] };
          const drafts = (data.drafts ?? []).filter((d) => d.kind !== "cancel");
          if (!drafts.length) {
            setProcessError("지출로 읽을 내용이 없어요.");
            processedRef.current = null;
            return;
          }
          setQueue(drafts);
          setQueueIndex(0);
        } else if (shareText.trim()) {
          const res = await fetch("/api/agent/ingest-text", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: shareText.trim(),
              tripId: null,
            }),
          });
          if (cancelled) return;
          if (!res.ok) {
            setProcessError(
              res.status === 401
                ? "로그인이 필요해요."
                : "미할당 저장에 실패했어요."
            );
            processedRef.current = null;
            return;
          }
          setProcessError("");
          router.push("/agent/inbox");
        }
        await cleanupPending(shareInboxId);
      } catch {
        if (!cancelled) {
          setProcessError("처리 중 오류가 났어요.");
          processedRef.current = null;
        }
      } finally {
        if (!cancelled) setProcessing(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    pending,
    tripId,
    authReady,
    user,
    provider,
    members.length,
    cleanupPending,
    router,
  ]);

  function openDrafts(drafts: ExpenseDraftInput[]) {
    setQueue(drafts);
    setQueueIndex(0);
  }

  if (!authReady || !tripsReady) {
    return (
      <div className="h-48 animate-pulse rounded-2xl bg-surface-soft m-4" aria-busy />
    );
  }

  if (!user || provider === "guest") {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-3 px-4 py-8">
        <h1 className="text-xl font-extrabold text-ink-heading">공유로 지출 추가</h1>
        <p className="text-sm text-ink-body">로그인 후 가계부에 바로 넣을 수 있어요.</p>
        <Link href="/login?next=%2Fshare-target" className="text-sm font-bold text-brand">
          로그인하기
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Share2 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-extrabold text-ink-heading">공유로 지출 추가</h1>
          <p className="mt-1 text-xs leading-5 text-ink-body">
            {shareCapable
              ? "다른 앱에서 MetU로 영수증·문자를 공유하면 가계부 초안이 만들어져요."
              : "홈 화면에 설치한 Android 앱에서만 시스템 공유를 받을 수 있어요."}
          </p>
          {isIosDevice() ? (
            <p className="mt-2 rounded-lg bg-surface-soft px-2 py-1.5 text-[11px] font-semibold text-ink-body">
              iOS Safari / 홈 화면 앱은 Web Share Target을 지원하지 않아요. 아래 붙여넣기·
              사진 업로드를 이용해 주세요.
            </p>
          ) : null}
        </div>
      </div>

      {loadError ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
          {loadError}
        </p>
      ) : null}
      {processError ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
          {processError}
        </p>
      ) : null}
      {processing ? (
        <p className="text-xs font-semibold text-ink-muted">공유 내용 분석 중…</p>
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-bold text-ink-heading">여행 선택</span>
        <select
          className="min-h-11 rounded-lg border border-line px-3 py-2 text-sm"
          value={tripId}
          onChange={(e) => setTripId(e.target.value)}
        >
          <option value="">여행 없이 미할당으로 받기</option>
          {activeTrips.map((t) => (
            <option key={t.id} value={t.id}>
              {t.destination} · {t.dateRange}
            </option>
          ))}
        </select>
        {activeTrips.length === 0 ? (
          <p className="text-xs text-ink-muted">
            여행은 나중에 만들어도 돼요. 텍스트는{" "}
            <Link href="/agent/inbox" className="font-bold text-brand">
              수신함
            </Link>
            에 미할당으로 들어가요.
          </p>
        ) : null}
      </label>

      {(!shareCapable || !pending) && tripId && members.length > 0 ? (
        <>
          <PasteExpenseBox tripId={tripId} onDrafts={openDrafts} />
          <ReceiptUploader tripId={tripId} onDraft={(d) => openDrafts([d])} />
        </>
      ) : null}

      {queue.length > 0 && tripId && members.length > 0 ? (
        <ExpenseConfirmSheet
          tripId={tripId}
          members={members}
          drafts={queue}
          index={queueIndex}
          onIndexChange={setQueueIndex}
          onClose={() => setQueue([])}
          onSaved={() => {
            setQueue([]);
            router.push(`/trips/${tripId}/ledger`);
          }}
          cardProfiles={profiles}
        />
      ) : null}
    </div>
  );
}
