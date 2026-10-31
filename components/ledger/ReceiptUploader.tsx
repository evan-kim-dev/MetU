"use client";

import Link from "next/link";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toUserFacingError } from "@/lib/errors/user-message";
import type { ExpenseDraftInput } from "@/lib/ledger/draft";
import { resizeImageToJpeg } from "@/lib/ledger/image";
import { receiptResponseToDraft } from "@/lib/ledger/receipt-client";
import {
  interpretReceiptEvent,
  type ReceiptEventOutcome,
} from "@/lib/ledger/receipt-event";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Props = {
  tripId: string;
  /** "바로 확인" 경로: 수신함 없이 확인 시트로 바로 연다. */
  onDraft: (draft: ExpenseDraftInput) => void;
};

type Phase = "idle" | "uploading" | "reading";
type Done = Exclude<ReceiptEventOutcome, "pending">;

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_TRIES = 30;
const ACCEPT = "image/jpeg,image/png,image/webp";

const DONE_TEXT: Record<Done, string> = {
  saved: "영수증을 읽어서 가계부에 넣었어요.",
  merged: "이미 있는 지출에 영수증을 붙였어요.",
  review: "영수증을 읽었어요. 수신함에서 확인해 주세요.",
  not_receipt: "영수증이 아닌 것 같아요.",
  failed: "영수증을 읽지 못했어요. 다시 시도해 주세요.",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ReceiptUploader({ tripId, onDraft }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const aliveRef = useRef(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  /** true 면 수신함 대신 확인 시트로 바로 확인 (기존 경로) */
  const [instant, setInstant] = useState(false);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const busy = phase !== "idle";

  async function resize(file: File): Promise<File | null> {
    try {
      return await resizeImageToJpeg(file);
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : "JPEG/PNG 로 다시 올려 주세요."
      );
      return null;
    }
  }

  async function failFromResponse(res: Response) {
    const body = (await res.json().catch(() => ({}))) as unknown;
    const mapped = toUserFacingError({
      source: "upload",
      status: res.status,
      body,
      retryAfterHeader: res.headers.get("retry-after"),
    });
    setError(mapped.message);
  }

  async function pollEvent(eventId: string) {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setTimedOut(true);
      return;
    }
    for (let i = 0; i < POLL_MAX_TRIES; i++) {
      if (!aliveRef.current) return;
      const { data, error: qErr } = await supabase
        .from("agent_events")
        .select("status, result")
        .eq("id", eventId)
        .maybeSingle();
      if (!aliveRef.current) return;
      if (!qErr && data) {
        const outcome = interpretReceiptEvent(
          String(data.status),
          data.result
        );
        if (outcome !== "pending") {
          setDone(outcome);
          return;
        }
      }
      await sleep(POLL_INTERVAL_MS);
    }
    if (aliveRef.current) setTimedOut(true);
  }

  async function uploadToInbox(file: File) {
    const resized = await resize(file);
    if (!resized) return;
    const fd = new FormData();
    fd.set("tripId", tripId);
    fd.set("file", resized);
    fd.set("source", "upload");
    const res = await fetch("/api/events/upload", { method: "POST", body: fd });
    if (!res.ok) {
      await failFromResponse(res);
      return;
    }
    const json = (await res.json().catch(() => ({}))) as { eventId?: string };
    if (!json.eventId) {
      setError("업로드에 실패했어요. 다시 시도해 주세요.");
      return;
    }
    setPhase("reading");
    await pollEvent(json.eventId);
  }

  async function uploadInstant(file: File) {
    const resized = await resize(file);
    if (!resized) return;
    const fd = new FormData();
    fd.set("tripId", tripId);
    fd.set("image", resized);
    const res = await fetch("/api/ledger/receipt", { method: "POST", body: fd });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as unknown;
      const mapped = toUserFacingError({
        source: "upload",
        status: res.status,
        body,
        retryAfterHeader: res.headers.get("retry-after"),
      });
      setError(
        res.status >= 500
          ? "영수증 인식에 실패했어요. 다시 시도해 주세요."
          : mapped.message
      );
      return;
    }
    const data = (await res.json()) as Parameters<
      typeof receiptResponseToDraft
    >[0];
    const mapped = receiptResponseToDraft(data);
    if (!mapped.ok) {
      setError("영수증이 아닌 것 같아요.");
      return;
    }
    onDraft(mapped.draft);
  }

  async function upload(file: File) {
    if (busy) return;
    setPhase("uploading");
    setError("");
    setDone(null);
    setTimedOut(false);
    try {
      if (instant) await uploadInstant(file);
      else await uploadToInbox(file);
    } catch {
      setError("업로드에 실패했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      if (aliveRef.current) setPhase("idle");
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void upload(f);
    e.target.value = "";
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-xl bg-surface-soft p-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) void upload(f);
      }}
    >
      <p className="text-xs font-bold text-ink-heading">영수증 사진</p>
      <input
        ref={cameraRef}
        type="file"
        accept={ACCEPT}
        capture="environment"
        className="hidden"
        onChange={onPick}
      />
      <input
        ref={galleryRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={onPick}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          onClick={() => cameraRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Camera className="h-3.5 w-3.5" />
          )}
          촬영하기
        </button>
        <button
          type="button"
          disabled={busy}
          className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-surface-white px-3 py-2 text-xs font-bold text-ink-heading ring-1 ring-line disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          onClick={() => galleryRef.current?.click()}
        >
          <ImagePlus className="h-3.5 w-3.5" />
          앨범에서 고르기
        </button>
      </div>
      <button
        type="button"
        aria-pressed={instant}
        disabled={busy}
        className="inline-flex min-h-11 items-center self-start text-[11px] font-semibold text-ink-muted underline-offset-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        onClick={() => setInstant((v) => !v)}
      >
        {instant
          ? "수신함 없이 바로 확인하는 중이에요 (눌러서 끄기)"
          : "수신함 없이 바로 확인할래요"}
      </button>
      {phase === "uploading" ? (
        <p role="status" className="text-xs font-semibold text-ink-muted">
          올리는 중이에요
        </p>
      ) : null}
      {phase === "reading" ? (
        <p role="status" className="text-xs font-semibold text-ink-muted">
          읽는 중이에요
        </p>
      ) : null}
      {done ? (
        <p
          role="status"
          className={`text-xs font-semibold ${
            done === "failed" || done === "not_receipt"
              ? "text-danger"
              : "text-emerald-800"
          }`}
        >
          {DONE_TEXT[done]}{" "}
          {done === "saved" || done === "merged" ? (
            <Link
              href={`/trips/${tripId}/ledger`}
              className="inline-flex min-h-11 items-center font-bold text-brand"
            >
              가계부 보기
            </Link>
          ) : done === "review" || done === "failed" ? (
            <Link
              href={`/trips/${tripId}/ledger/inbox`}
              className="inline-flex min-h-11 items-center font-bold text-brand"
            >
              수신함 열기
            </Link>
          ) : null}
        </p>
      ) : null}
      {timedOut ? (
        <p role="status" className="text-xs font-semibold text-ink-muted">
          아직 읽는 중이에요. 잠시 뒤{" "}
          <Link
            href={`/trips/${tripId}/ledger/inbox`}
            className="inline-flex min-h-11 items-center font-bold text-brand"
          >
            수신함
          </Link>
          에서 확인해 주세요.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
