"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ImagePlus, X } from "lucide-react";
import {
  compressImageForMemory,
  loadCountryMemory,
  MAX_PHOTOS,
  saveCountryMemo,
  saveCountryPhotos,
  type CountryMemory,
} from "@/lib/trips/country-memory";
import {
  countryAlpha2FromIso,
  countryBlurbFromIso,
  countryLabelFromIso,
  resolveCountryIsoNumeric,
} from "@/lib/trips/visited-countries";
import type { Trip } from "@/lib/trips/types";

type VisitedCountrySheetProps = {
  isoNumeric: string;
  trips: Trip[];
  onClose: () => void;
};

export function VisitedCountrySheet({
  isoNumeric,
  trips,
  onClose,
}: VisitedCountrySheetProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const label = countryLabelFromIso(isoNumeric);
  const alpha2 = countryAlpha2FromIso(isoNumeric)?.toLowerCase();
  const blurb = countryBlurbFromIso(isoNumeric);

  const matchedTrips = useMemo(
    () =>
      trips.filter(
        (trip) =>
          resolveCountryIsoNumeric(trip.country, trip.destination) ===
          isoNumeric
      ),
    [isoNumeric, trips]
  );

  const [memory, setMemory] = useState<CountryMemory>(() =>
    loadCountryMemory(isoNumeric)
  );
  const [memoDraft, setMemoDraft] = useState(memory.memo);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = loadCountryMemory(isoNumeric);
    setMemory(next);
    setMemoDraft(next.memo);
    setError(null);
  }, [isoNumeric]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSaveMemo = () => {
    setSaving(true);
    const next = saveCountryMemo(isoNumeric, memoDraft);
    setMemory(next);
    setSaving(false);
  };

  const handleAddPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    const nextPhotos = [...memory.photos];
    for (const file of Array.from(files)) {
      if (nextPhotos.length >= MAX_PHOTOS) break;
      const result = await compressImageForMemory(file);
      if ("error" in result) {
        setError(result.error);
        continue;
      }
      nextPhotos.push(result.url);
    }
    const next = saveCountryPhotos(isoNumeric, nextPhotos);
    setMemory(next);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleRemovePhoto = (index: number) => {
    const next = saveCountryPhotos(
      isoNumeric,
      memory.photos.filter((_, i) => i !== index)
    );
    setMemory(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-ink-heading/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${label} 방문 기록`}
        className="relative z-10 flex max-h-[85dvh] w-full max-w-mobile flex-col rounded-t-3xl bg-surface-white shadow-soft"
      >
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {alpha2 ? (
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand/10 ring-1 ring-brand/15">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://flagcdn.com/w80/${alpha2}.png`}
                  alt=""
                  className="h-[18px] w-6 object-cover"
                />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="truncate text-lg font-extrabold text-ink-heading">
                {label}
              </h2>
              <p className="text-xs text-ink-caption">
                방문 기록 · 메모 · 사진
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-caption active:bg-surface-soft"
            aria-label="시트 닫기"
          >
            <X className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4">
          <section>
            <h3 className="mb-1.5 text-sm font-extrabold text-ink-heading">
              국가 정보
            </h3>
            <p className="text-sm leading-relaxed text-ink-body">{blurb}</p>
          </section>

          <section>
            <div className="mb-2 flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-brand" strokeWidth={2.2} />
              <h3 className="text-sm font-extrabold text-ink-heading">
                다녀온 일정
              </h3>
            </div>
            {matchedTrips.length === 0 ? (
              <p className="text-sm text-ink-caption">연결된 여행 기록이 없어요.</p>
            ) : (
              <ul className="space-y-2">
                {matchedTrips.map((trip) => (
                  <li
                    key={trip.id}
                    className="rounded-xl border border-line-soft bg-surface-soft px-3.5 py-3"
                  >
                    <p className="text-sm font-bold text-ink-heading">
                      {trip.destination || label}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-caption">
                      {trip.dateRange || "날짜 미정"}
                      {trip.status === "completed"
                        ? " · 완료"
                        : trip.status === "ongoing"
                          ? " · 여행 중"
                          : " · 예정"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-extrabold text-ink-heading">메모</h3>
            <textarea
              value={memoDraft}
              onChange={(e) => setMemoDraft(e.target.value)}
              rows={4}
              placeholder="맛집, 동선, 다음에 가고 싶은 곳 등을 남겨 보세요"
              className="w-full resize-none rounded-xl border border-line-soft bg-surface-white px-3.5 py-3 text-sm text-ink-heading outline-none focus:border-brand"
            />
            <button
              type="button"
              onClick={handleSaveMemo}
              disabled={saving || memoDraft.trim() === memory.memo}
              className="mt-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-surface-white disabled:opacity-40"
            >
              {saving ? "저장 중..." : "메모 저장"}
            </button>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-ink-heading">
                사진 ({memory.photos.length}/{MAX_PHOTOS})
              </h3>
              <button
                type="button"
                disabled={uploading || memory.photos.length >= MAX_PHOTOS}
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-brand disabled:opacity-40"
              >
                <ImagePlus className="h-3.5 w-3.5" strokeWidth={2.4} />
                {uploading ? "올리는 중" : "추가"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void handleAddPhotos(e.target.files)}
              />
            </div>
            {memory.photos.length === 0 ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-muted bg-surface-soft py-8 text-ink-caption"
              >
                <ImagePlus className="h-6 w-6" strokeWidth={2} />
                <span className="text-xs font-semibold">
                  간단한 여행 사진을 올려 보세요
                </span>
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {memory.photos.map((url, index) => (
                  <div
                    key={`${index}-${url.slice(0, 24)}`}
                    className="relative aspect-square overflow-hidden rounded-xl bg-surface-soft"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`${label} 사진 ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(index)}
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink-heading/70 text-surface-white"
                      aria-label="사진 삭제"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2.4} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {error ? (
              <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
