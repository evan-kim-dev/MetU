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
    <section className="ai-surface-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand/10">
          <CheckSquare className="h-4 w-4 text-brand" strokeWidth={2.2} />
        </span>
        <h3 className="text-lg font-extrabold text-ink-heading">체크리스트</h3>
      </div>

      <div className="flex items-start justify-between gap-2">
        {CHECKLIST_ITEMS.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            href={`/checklist/${id}`}
            className="flex w-[72px] flex-col items-center gap-2 rounded-xl transition-transform active:scale-95"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-brand/10 bg-gradient-to-br from-brand/12 to-[#818CF8]/10">
              <Icon className="h-5 w-5 text-brand" strokeWidth={2.2} />
            </span>
            <span className="text-xs font-semibold tracking-wide text-ink-heading">
              {label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
