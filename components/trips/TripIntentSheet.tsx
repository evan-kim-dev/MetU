"use client";

import {
  CalendarPlus,
  MessageSquare,
  Scale,
  Wallet,
  Banknote,
} from "lucide-react";
import { Sheet } from "@/components/ds/Sheet";

export type TripIntent =
  | "schedule"
  | "expense"
  | "split"
  | "cash"
  | "bot";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (intent: TripIntent) => void;
};

const ITEMS: Array<{
  intent: TripIntent;
  label: string;
  desc: string;
  icon: typeof CalendarPlus;
}> = [
  {
    intent: "schedule",
    label: "일정 추가",
    desc: "장소·동선을 일정에 넣어요",
    icon: CalendarPlus,
  },
  {
    intent: "expense",
    label: "지출 기록",
    desc: "영수증·붙여넣기·음성",
    icon: Wallet,
  },
  {
    intent: "split",
    label: "분담 조정",
    desc: "사람별 몫을 미리 보고 바꿔요",
    icon: Scale,
  },
  {
    intent: "cash",
    label: "현금 인출",
    desc: "ATM·환전을 현금 주머니에 넣어요",
    icon: Banknote,
  },
  {
    intent: "bot",
    label: "MetU에게 말하기",
    desc: "분담·일정 제안 → 확인 후 반영",
    icon: MessageSquare,
  },
];

/**
 * 여행 화면 `+` 하나에서 의도만 고른다. 메뉴 탭을 새로 만들지 않아요.
 */
export function TripIntentSheet({ open, onClose, onSelect }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="무엇을 할까요?">
      <ul className="flex flex-col gap-2 pb-2">
        {ITEMS.map(({ intent, label, desc, icon: Icon }) => (
          <li key={intent}>
            <button
              type="button"
              className="mu-focus flex min-h-tap w-full items-center gap-3 rounded-mu-lg border border-mu-line bg-mu-card px-3 py-3 text-left active:bg-mu-sunken"
              onClick={() => {
                onSelect(intent);
                onClose();
              }}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mu-accent-soft text-mu-accent">
                <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-mu-body font-bold text-mu-fg">
                  {label}
                </span>
                <span className="text-mu-caption text-mu-fg-3">{desc}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
