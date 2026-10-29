"use client";

import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import type { ExpenseDraftInput } from "@/lib/ledger/draft";
import { receiptResponseToDraft } from "@/lib/ledger/receipt-client";

type Props = {
  tripId: string;
  onDraft: (draft: ExpenseDraftInput) => void;
};

async function resizeFallback(file: File): Promise<File> {
  try {
    const { resizeImageToJpeg } = await import("@/lib/ledger/image");
    return await resizeImageToJpeg(file);
  } catch {
    return file;
  }
}

export function ReceiptUploader({ tripId, onDraft }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const resized = await resizeFallback(file);
      const fd = new FormData();
      fd.set("tripId", tripId);
      fd.set("image", resized);
      const res = await fetch("/api/ledger/receipt", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        setError(
          res.status === 401
            ? "로그인이 필요해요."
            : res.status === 413
              ? "이미지가 너무 커요."
              : "영수증 인식에 실패했어요."
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
    } catch {
      setError("업로드에 실패했어요. JPEG/PNG로 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
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
      <p className="text-xs font-bold text-ink-heading">영수증 / 캡처 사진</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Camera className="h-3.5 w-3.5" />
          )}
          촬영 / 선택
        </button>
        <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
          <ImagePlus className="h-3.5 w-3.5" />
          여기로 끌어다 놓아도 돼요
        </span>
      </div>
      {error ? (
        <p className="text-xs font-semibold text-danger">{error}</p>
      ) : null}
    </div>
  );
}
