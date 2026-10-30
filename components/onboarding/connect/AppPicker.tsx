"use client";

import { useState } from "react";

import { NOTIF_APP_PRESETS } from "@/lib/ledger/notif/apps";

const TEST_APPS = ["Gmail", "카카오톡"] as const;

type Props = {
  selected: string[];
  onChange: (apps: string[]) => void;
};

export function AppPicker({ selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");

  const toggle = (name: string) => {
    if (selected.includes(name)) {
      onChange(selected.filter((a) => a !== name));
    } else {
      onChange([...selected, name]);
    }
  };

  const addCustom = () => {
    const name = custom.trim().slice(0, 40);
    if (!name) return;
    if (!selected.includes(name)) onChange([...selected, name]);
    setCustom("");
  };

  return (
    <details
      className="rounded-2xl border border-line-muted bg-surface-base p-3"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer text-sm font-semibold text-ink-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
        내 카드 앱 골라 두기 (선택)
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-sm leading-relaxed text-ink-body">
          고른 앱 이름이 위 안내에 들어가요. MetU는 앱을 가리지 않고, 폰
          자동화에 추가한 앱의 알림만 도착해요.
        </p>
        <p className="text-sm text-ink-body">
          고른 앱은 안내 문구에만 반영돼요. 폰의 자동화를 대신 설정해 주지는
          않아요.
        </p>
        <div className="flex flex-wrap gap-2">
          {NOTIF_APP_PRESETS.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={selected.includes(name)}
              className={[
                "min-h-11 rounded-xl px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                selected.includes(name)
                  ? "bg-brand text-surface-white"
                  : "bg-surface-soft text-ink-heading",
              ].join(" ")}
              onClick={() => toggle(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <p className="text-xs font-semibold text-ink-muted">
          테스트용으로 써 볼 앱
        </p>
        <div className="flex flex-wrap gap-2">
          {TEST_APPS.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={selected.includes(name)}
              className={[
                "min-h-11 rounded-xl px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                selected.includes(name)
                  ? "bg-brand text-surface-white"
                  : "bg-surface-soft text-ink-heading",
              ].join(" ")}
              onClick={() => toggle(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <label htmlFor="custom-app" className="sr-only">
            기타 앱 이름
          </label>
          <input
            id="custom-app"
            value={custom}
            maxLength={40}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="기타 앱 이름"
            className="min-h-11 flex-1 rounded-xl border border-line-muted bg-surface-base px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          />
          <button
            type="button"
            className="min-h-11 rounded-xl bg-surface-soft px-4 text-sm font-semibold text-ink-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            onClick={addCustom}
          >
            추가
          </button>
        </div>
      </div>
    </details>
  );
}
