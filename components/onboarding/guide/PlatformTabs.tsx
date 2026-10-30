"use client";

import type { GuidePlatform } from "@/lib/onboarding/guide-content";

type PlatformTabsProps = {
  value: GuidePlatform;
  onChange: (p: GuidePlatform) => void;
};

export function PlatformTabs({ value, onChange }: PlatformTabsProps) {
  const tabs: { id: GuidePlatform; label: string }[] = [
    { id: "ios", label: "iPhone" },
    { id: "android", label: "Android" },
  ];

  return (
    <div
      role="tablist"
      aria-label="플랫폼 선택"
      className="flex gap-2 rounded-xl bg-surface-soft p-1"
    >
      {tabs.map((tab) => {
        const selected = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                onChange(tab.id === "ios" ? "android" : "ios");
              }
            }}
            className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              selected
                ? "bg-surface-base text-ink-heading shadow-sm"
                : "text-ink-muted"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
