"use client";

import Link from "next/link";
import {
  BedDouble,
  CheckSquare,
  CloudSun,
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
  { id: "weather", label: "날씨", icon: CloudSun },
];

export function AISmartTipsShortcut() {
  return (
    <section className="rounded-mu-xl border border-mu-line bg-mu-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-mu-lg bg-mu-accent-soft">
          <CheckSquare className="h-4 w-4 text-mu-accent" strokeWidth={2.2} />
        </span>
        <h3 className="text-lg font-extrabold text-mu-fg">체크리스트</h3>
      </div>

      <div className="flex items-start justify-between gap-2">
        {CHECKLIST_ITEMS.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            href={`/checklist/${id}`}
            className="flex w-[72px] flex-col items-center gap-2 rounded-mu-lg transition-transform active:scale-95"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-mu-lg border border-mu-line bg-mu-card">
              <Icon className="h-5 w-5 text-mu-accent" strokeWidth={2.2} />
            </span>
            <span className="text-xs font-semibold tracking-wide text-mu-fg">
              {label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}