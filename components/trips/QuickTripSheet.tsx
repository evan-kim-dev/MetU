"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { AirportSearchField } from "@/components/onboarding/AirportSearchField";
import { formatPlaceDestination } from "@/lib/places/autocomplete";
import type { PlaceItem } from "@/lib/places/autocomplete";
import { seoulDateIso } from "@/lib/onboarding/trip-window";
import { addDays } from "@/lib/shared/dates";
import { buildQuickTrip } from "@/lib/trips/quick-trip";
import { useTrips } from "@/lib/trips/TripProvider";
import type { Trip } from "@/lib/trips/types";

export type QuickTripSheetReason = "first-run" | "inbox" | "hub";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (trip: Trip) => void;
  reason?: QuickTripSheetReason;
};

type Phase = "idle" | "submitting" | "error";

const SUBTITLE: Record<QuickTripSheetReason, string> = {
  "first-run":
    "알림과 지출을 담을 여행 하나만 먼저 만들어요. 일정과 예산은 나중에 채워도 돼요.",
  hub: "알림과 지출을 담을 여행 하나만 먼저 만들어요. 일정과 예산은 나중에 채워도 돼요.",
  inbox: "여행을 만들면 기간이 맞는 알림이 자동으로 이 여행에 붙어요.",
};

function formatMd(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${Number(m[2])}월 ${Number(m[3])}일`;
}

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function QuickTripSheet({
  open,
  onClose,
  onCreated,
  reason = "first-run",
}: Props) {
  const { addTrip } = useTrips();
  const titleId = useId();
  const destId = useId();
  const startId = useId();
  const destErrorId = useId();
  const startErrorId = useId();
  const destRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const [destination, setDestination] = useState("");
  const [country, setCountry] = useState("");
  const [startIso, setStartIso] = useState(() => seoulDateIso(new Date()));
  const [days, setDays] = useState(5);
  const [phase, setPhase] = useState<Phase>("idle");
  const [destError, setDestError] = useState("");
  const [startError, setStartError] = useState("");
  const [online, setOnline] = useState(true);
  const [toast, setToast] = useState(false);

  const submitting = phase === "submitting";

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setDestination("");
    setCountry("");
    setStartIso(seoulDateIso(new Date()));
    setDays(5);
    setPhase("idle");
    setDestError("");
    setStartError("");
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => destRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      previousFocus.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(false), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const closeIfIdle = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [onClose, submitting]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeIfIdle();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeIfIdle]);

  const nights = days - 1;
  const endIso = isValidIsoDate(startIso) ? addDays(startIso, nights) : "";
  const preview =
    isValidIsoDate(startIso) && endIso
      ? `${formatMd(startIso)} ~ ${formatMd(endIso)} · ${nights}박 ${days}일`
      : "";

  async function submit() {
    const trimmed = destination.trim();
    let ok = true;
    if (!trimmed) {
      setDestError("여행지를 입력해 주세요.");
      ok = false;
    } else {
      setDestError("");
    }
    if (!isValidIsoDate(startIso)) {
      setStartError("출발일을 골라 주세요.");
      ok = false;
    } else {
      setStartError("");
    }
    if (!ok || !online || submitting) return;

    setPhase("submitting");
    try {
      const trip = buildQuickTrip({
        destination: trimmed,
        country,
        startIso,
        days,
      });
      const saved = await addTrip(trip);
      setPhase("idle");
      onClose();
      setToast(true);
      onCreated?.(saved);
    } catch {
      setPhase("error");
    }
  }

  function onFormSubmit(e: FormEvent) {
    e.preventDefault();
    void submit();
  }

  function onDestKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById(startId)?.focus();
    }
  }

  return (
    <>
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto w-[min(100%,440px)] px-4"
        >
          <p className="rounded-2xl bg-ink-heading px-4 py-3 text-sm font-semibold text-surface-white shadow-soft">
            여행을 만들었어요. 알림이 오면 기간에 맞춰 이 여행에 모아요.
          </p>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            type="button"
            aria-label="닫기"
            className="absolute inset-0 bg-black/40"
            disabled={submitting}
            onClick={closeIfIdle}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 flex w-full max-w-mobile max-h-[88dvh] flex-col overflow-y-auto rounded-t-3xl bg-surface-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-soft"
          >
            {phase === "error" ? (
              <div
                role="alert"
                className="mb-3 rounded-xl bg-danger/10 px-3 py-3 text-sm text-danger"
              >
                <p className="font-semibold">
                  여행을 만들지 못했어요. 인터넷 연결을 확인하고 다시 시도해
                  주세요.
                </p>
                <button
                  type="button"
                  className="mt-2 inline-flex min-h-11 items-center font-bold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  onClick={() => void submit()}
                >
                  다시 시도
                </button>
              </div>
            ) : null}

            <h2
              id={titleId}
              className="text-lg font-extrabold text-ink-heading"
            >
              빠르게 여행 만들기
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-body">
              {SUBTITLE[reason]}
            </p>

            <form className="mt-4 flex flex-col gap-4" onSubmit={onFormSubmit}>
              <div className="flex flex-col gap-1.5">
                <AirportSearchField
                  label="어디로 가나요?"
                  placeholder="예: 도쿄"
                  value={destination}
                  inputId={destId}
                  inputRef={destRef}
                  placesMode="cities"
                  maxLength={40}
                  disabled={submitting}
                  aria-invalid={destError ? true : undefined}
                  aria-describedby={destError ? destErrorId : undefined}
                  formatValue={formatPlaceDestination}
                  onChange={(next) => {
                    setDestination(next);
                    setCountry("");
                    if (next.trim()) setDestError("");
                  }}
                  onSelectPlace={(place: PlaceItem) => {
                    const countryName =
                      place.type === "country"
                        ? place.name
                        : (place.countryName ?? "");
                    setCountry(countryName);
                  }}
                  onInputKeyDown={onDestKeyDown}
                />
                {destError ? (
                  <p
                    id={destErrorId}
                    role="alert"
                    className="text-sm font-semibold text-danger"
                  >
                    {destError}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={startId}
                  className="text-sm font-bold text-ink-heading"
                >
                  출발일
                </label>
                <input
                  id={startId}
                  type="date"
                  value={startIso}
                  disabled={submitting}
                  aria-invalid={startError ? true : undefined}
                  aria-describedby={
                    startError ? startErrorId : `${startId}-hint`
                  }
                  onChange={(e) => setStartIso(e.target.value)}
                  className="h-12 w-full rounded-xl border border-line-soft bg-surface-white px-3 text-base text-ink-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
                />
                <p
                  id={`${startId}-hint`}
                  className="text-xs text-ink-body"
                >
                  이미 떠났다면 오늘 날짜 그대로 두세요.
                </p>
                {startError ? (
                  <p
                    id={startErrorId}
                    role="alert"
                    className="text-sm font-semibold text-danger"
                  >
                    {startError}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-ink-heading">
                  며칠 여행인가요?
                </span>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    aria-label="하루 줄이기"
                    disabled={submitting || days <= 1}
                    onClick={() => setDays((d) => Math.max(1, d - 1))}
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-soft text-lg font-bold text-ink-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40"
                  >
                    −
                  </button>
                  <span aria-live="polite" className="text-base font-bold">
                    {days}일
                  </span>
                  <button
                    type="button"
                    aria-label="하루 늘리기"
                    disabled={submitting || days >= 30}
                    onClick={() => setDays((d) => Math.min(30, d + 1))}
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-soft text-lg font-bold text-ink-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40"
                  >
                    ＋
                  </button>
                </div>
              </div>

              {preview ? (
                <p
                  aria-live="polite"
                  className="rounded-xl bg-surface-soft px-3 py-2 text-sm font-semibold text-ink-body"
                >
                  {preview}
                </p>
              ) : null}

              {!online ? (
                <p role="status" className="text-sm font-semibold text-ink-body">
                  인터넷에 연결되면 만들 수 있어요.
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting || !online}
                aria-busy={submitting || undefined}
                className="ai-gradient-bg flex min-h-touch w-full items-center justify-center rounded-2xl text-base font-bold text-surface-white shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:bg-none disabled:bg-line-muted disabled:opacity-70"
              >
                {submitting ? "만드는 중…" : "여행 만들기"}
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={closeIfIdle}
                className="inline-flex min-h-11 items-center justify-center text-sm font-bold text-ink-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
              >
                닫기
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
