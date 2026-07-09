"use client";

import Link from "next/link";
import {
  BedDouble,
  CalendarDays,
  CheckSquare,
  FileText,
  Plane,
  type LucideIcon,
} from "lucide-react";
import type { ChecklistCategoryId } from "@/lib/checklist/categories";

const CHECKLIST_ITEMS: {
  id: ChecklistCategoryId;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "flight", label: "항공", icon: Plane },
  { id: "hotel", label: "숙박", icon: BedDouble },
  { id: "docs", label: "서류", icon: FileText },
  { id: "event", label: "행사", icon: CalendarDays },
];

export function AISmartTipsShortcut() {
  return (
    <section className="rounded-xl border border-line-soft bg-surface-white p-4 shadow-soft">
      <div className="mb-4 flex h-7 w-full items-center gap-2">
        <span className="flex h-[12.56px] w-[16.67px] items-center justify-center text-brand">
          <CheckSquare className="h-[12.56px] w-[16.67px]" strokeWidth={2.2} />
        </span>
        <h3 className="text-[20px] font-semibold leading-7 text-ink-heading">
          체크리스트
        </h3>
      </div>

      <div className="flex items-start justify-between gap-2">
        {CHECKLIST_ITEMS.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            href={`/checklist/${id}`}
            className="flex w-[72px] flex-col items-center gap-2 rounded-xl transition-transform active:scale-95"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10">
              <Icon className="h-5 w-5 text-brand" strokeWidth={2.2} />
            </span>
            <span className="text-sm font-medium tracking-wide text-ink-heading">
              {label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
