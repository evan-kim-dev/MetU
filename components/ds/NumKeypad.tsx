"use client";

import { Delete } from "lucide-react";
import { cn } from "@/lib/design/tokens";

export type NumKeypadProps = {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  className?: string;
};

const KEYS: Array<string | "backspace"> = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "",
  "0",
  "backspace",
];

export function NumKeypad({ onDigit, onBackspace, className }: NumKeypadProps) {
  return (
    <div
      className={cn("grid grid-cols-3 gap-2", className)}
      role="group"
      aria-label="숫자 키패드"
    >
      {KEYS.map((key, i) => {
        if (key === "") {
          return <div key={`empty-${i}`} aria-hidden className="min-h-touch" />;
        }
        if (key === "backspace") {
          return (
            <button
              key="backspace"
              type="button"
              onClick={onBackspace}
              aria-label="지우기"
              className="mu-focus flex min-h-touch items-center justify-center rounded-mu-md bg-mu-sunken text-mu-fg active:bg-mu-line"
            >
              <Delete className="h-5 w-5" aria-hidden />
            </button>
          );
        }
        return (
          <button
            key={key}
            type="button"
            onClick={() => onDigit(key)}
            className="mu-focus flex min-h-touch items-center justify-center rounded-mu-md bg-mu-sunken text-xl font-semibold text-mu-fg active:bg-mu-line"
          >
            {key}
          </button>
        );
      })}
    </div>
  );
}
