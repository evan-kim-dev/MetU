"use client";

import { useCallback, useEffect, useState } from "react";

import type { GuidePlatform } from "@/lib/onboarding/guide-content";

const STORAGE_KEY = "metu.guide.progress.v1";

type ProgressStore = { ios: string[]; android: string[] };

function readStore(): ProgressStore {
  if (typeof window === "undefined") {
    return { ios: [], android: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ios: [], android: [] };
    const parsed = JSON.parse(raw) as ProgressStore;
    return {
      ios: Array.isArray(parsed.ios) ? parsed.ios : [],
      android: Array.isArray(parsed.android) ? parsed.android : [],
    };
  } catch {
    return { ios: [], android: [] };
  }
}

function writeStore(store: ProgressStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* private mode */
  }
}

export function useGuideProgress(platform: GuidePlatform, stepIds: string[]) {
  const [doneSet, setDoneSet] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const store = readStore();
    setDoneSet(
      new Set(platform === "ios" ? store.ios : store.android)
    );
  }, [platform]);

  const doneCount = stepIds.filter((id) => doneSet.has(id)).length;

  const toggleDone = useCallback(
    (stepId: string, done: boolean) => {
      const next = readStore();
      const key = platform === "ios" ? "ios" : "android";
      const set = new Set(next[key]);
      if (done) set.add(stepId);
      else set.delete(stepId);
      next[key] = [...set];
      writeStore(next);
      setDoneSet(set);
    },
    [platform]
  );

  const resetAll = useCallback(() => {
    const next = readStore();
    if (platform === "ios") next.ios = [];
    else next.android = [];
    writeStore(next);
    setDoneSet(new Set());
  }, [platform]);

  return {
    doneSet,
    doneCount,
    total: stepIds.length,
    toggleDone,
    resetAll,
    isDone: (id: string) => doneSet.has(id),
  };
}

type GuideProgressProps = {
  done: number;
  total: number;
  onReset: () => void;
};

export function GuideProgressBar({ done, total, onReset }: GuideProgressProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div
      className="sticky top-[calc(env(safe-area-inset-top)+3rem)] z-10 space-y-2 bg-surface-base/95 py-2 backdrop-blur-sm"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-surface-soft px-3 py-1 text-xs font-semibold text-ink-heading">
          {done}/{total} 단계
        </span>
        <button
          type="button"
          onClick={onReset}
          className="min-h-11 px-2 text-xs font-medium text-brand underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          처음부터 다시
        </button>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-soft"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="가이드 진행"
      >
        <div
          className="h-full bg-brand transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
