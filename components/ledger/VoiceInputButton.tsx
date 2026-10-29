"use client";

import { Mic, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ExpenseDraftInput } from "@/lib/ledger/draft";

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  }
}

type Props = {
  tripId: string;
  onDrafts: (drafts: ExpenseDraftInput[]) => void;
};

export function VoiceInputButton({ tripId, onDrafts }: Props) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
    );
  }, []);

  if (!supported) return null;

  function listen() {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "ko-KR";
    rec.interimResults = true;
    rec.continuous = false;
    setListening(true);
    setError("");
    rec.onresult = (ev) => {
      const t = ev.results[0]?.[0]?.transcript ?? "";
      setText(t);
    };
    rec.onerror = () => {
      setError("음성 인식에 실패했어요. 권한을 확인해 주세요.");
      setListening(false);
    };
    rec.onend = () => setListening(false);
    rec.start();
  }

  async function analyze() {
    const value = text.trim();
    if (!value) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ledger/parse-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, text: value, source: "voice" }),
      });
      if (!res.ok) {
        setError("분석에 실패했어요.");
        return;
      }
      const data = (await res.json()) as { drafts?: ExpenseDraftInput[] };
      const drafts = (data.drafts ?? []).filter((d) => d.kind !== "cancel");
      if (drafts.length) onDrafts(drafts);
      else setError("지출로 읽을 내용이 없어요.");
    } catch {
      setError("네트워크 오류예요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl bg-surface-soft p-3">
      <p className="text-xs font-bold text-ink-heading">음성 입력</p>
      <p className="mt-1 text-[10px] text-ink-muted">
        Chrome 계열은 음성이 브라우저 제공자 서버로 전송될 수 있어요. HTTPS
        필요.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white"
          onClick={listen}
          disabled={listening}
        >
          {listening ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Mic className="h-3.5 w-3.5" />
          )}
          {listening ? "듣는 중…" : "말하기"}
        </button>
        <button
          type="button"
          disabled={busy || !text.trim()}
          className="rounded-lg bg-surface-white px-3 py-2 text-xs font-bold ring-1 ring-line disabled:opacity-40"
          onClick={() => void analyze()}
        >
          분석
        </button>
      </div>
      <textarea
        className="mt-2 min-h-[64px] w-full rounded-lg border border-line px-2 py-1.5 text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="인식된 문장을 여기서 수정할 수 있어요"
      />
      {error ? (
        <p className="mt-1 text-xs font-semibold text-danger">{error}</p>
      ) : null}
    </div>
  );
}
