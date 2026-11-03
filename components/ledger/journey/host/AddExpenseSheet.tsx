"use client";

import { Camera, ClipboardPaste, Mic, PencilLine } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ds/Button";
import { Sheet } from "@/components/ds/Sheet";
import { PasteExpenseBox } from "@/components/ledger/PasteExpenseBox";
import { ReceiptUploader } from "@/components/ledger/ReceiptUploader";
import { VoiceInputButton } from "@/components/ledger/VoiceInputButton";
import { cn } from "@/lib/design/tokens";
import type { ExpenseDraftInput } from "@/lib/ledger/draft";

export type AddExpenseTab = "receipt" | "paste" | "voice";

const TABS: Array<{ key: AddExpenseTab; label: string; icon: typeof Camera }> = [
  { key: "receipt", label: "영수증", icon: Camera },
  { key: "paste", label: "붙여넣기·직접", icon: ClipboardPaste },
  { key: "voice", label: "음성", icon: Mic },
];

type Props = {
  tripId: string;
  /** null 이면 닫혀 있어요. */
  tab: AddExpenseTab | null;
  onTabChange: (tab: AddExpenseTab) => void;
  onClose: () => void;
  /** 딥링크로 열었을 때 탭의 첫 입력에 포커스를 줘요. */
  focusFirst?: boolean;
  onDrafts: (drafts: ExpenseDraftInput[]) => void;
  onCancelNotice: (draft: ExpenseDraftInput) => void;
  onManual: () => void;
};

/**
 * 지출 추가 시트: 영수증 · 붙여넣기/직접 입력 · 음성.
 * 금액·환율·분담은 확인 시트(ExpenseConfirmSheet)와 서버가 정해요.
 */
export function AddExpenseSheet({
  tripId,
  tab,
  onTabChange,
  onClose,
  focusFirst = false,
  onDrafts,
  onCancelNotice,
  onManual,
}: Props) {
  const baseId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const open = tab !== null;

  useEffect(() => {
    if (!open || !focusFirst) return;
    // Sheet 가 열리며 제목에 포커스를 준 뒤(0ms) 탭의 첫 버튼으로 옮겨요.
    const t = window.setTimeout(() => {
      panelRef.current
        ?.querySelector<HTMLElement>("button:not([disabled]), input:not([disabled]), textarea")
        ?.focus();
    }, 30);
    return () => window.clearTimeout(t);
  }, [open, focusFirst, tab]);

  if (!open) return null;

  return (
    <Sheet open onClose={onClose} title="지출 추가">
      <div role="tablist" aria-label="지출 추가 방법" className="grid grid-cols-3 gap-2">
        {TABS.map(({ key, label, icon: Icon }) => {
          const selected = key === tab;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`${baseId}-tab-${key}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              onClick={() => onTabChange(key)}
              className={cn(
                "mu-focus flex min-h-tap flex-col items-center justify-center gap-1 rounded-mu-md px-2 py-2 text-mu-label transition-colors duration-mu-fast ease-mu",
                selected
                  ? "bg-mu-accent-soft text-mu-accent"
                  : "bg-mu-sunken text-mu-fg-2"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              {label}
            </button>
          );
        })}
      </div>

      <div
        ref={panelRef}
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${tab}`}
        className="flex flex-col gap-3 pt-1"
      >
        {tab === "receipt" ? (
          <>
            <p className="text-mu-caption text-mu-fg-3">
              영수증을 찍거나 고르면 가게·금액·품목을 채워 확인 화면으로 넘겨요.
            </p>
            <ReceiptUploader tripId={tripId} onDraft={(d) => onDrafts([d])} />
          </>
        ) : null}
        {tab === "paste" ? (
          <>
            <p className="text-mu-caption text-mu-fg-3">
              카드 문자를 붙여 넣거나, 직접 적어요.
            </p>
            <PasteExpenseBox
              tripId={tripId}
              onDrafts={onDrafts}
              onCancelNotice={onCancelNotice}
            />
            <Button variant="secondary" onClick={onManual}>
              <PencilLine className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              직접 입력할게요
            </Button>
          </>
        ) : null}
        {tab === "voice" ? (
          <>
            <p className="text-mu-caption text-mu-fg-3">
              「점심 라멘 1,200엔 카드」처럼 말하면 받아 적어요.
            </p>
            <VoiceInputButton tripId={tripId} onDrafts={onDrafts} />
          </>
        ) : null}
      </div>
    </Sheet>
  );
}
