"use client";

import { useState } from "react";
import {
  DCC_PUBLIC_STAT_NOTE,
  DCC_PUBLIC_STAT_URL,
} from "@/lib/ledger/dcc";
import type { ExpenseFlags as Flags } from "@/lib/ledger/types";

type Props = {
  flags?: Flags | null;
};

export function ExpenseFlags({ flags }: Props) {
  const [open, setOpen] = useState(false);
  if (!flags) return null;

  const dcc = flags.dcc;
  const showDcc = dcc && dcc.level !== "none";
  const showDup = flags.dupCharge === true;
  if (!showDcc && !showDup) return null;

  return (
    <div className="mt-1 flex flex-col gap-1">
      <div className="flex flex-wrap gap-1.5">
        {showDcc ? (
          <button
            type="button"
            className="inline-flex min-h-tap items-center rounded-lg bg-amber-50 px-2 text-xs font-bold text-amber-800 ring-1 ring-amber-200"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {dcc.level === "confirmed" ? "원화결제 확정" : "원화결제 의심"}
          </button>
        ) : null}
        {showDup ? (
          <span className="inline-flex min-h-tap items-center rounded-lg bg-rose-50 px-2 text-xs font-bold text-rose-800 ring-1 ring-rose-200">
            중복결제 가능성
          </span>
        ) : null}
      </div>
      {open && showDcc ? (
        <div className="rounded-xl bg-surface-soft px-3 py-2 text-xs leading-relaxed text-ink-body">
          <p>
            해외 결제를 원화로 하면 현지통화 결제보다 불리할 수 있어요(일반
            정보).
          </p>
          {dcc.level === "confirmed" &&
          dcc.markupPct != null &&
          dcc.markupKrw != null ? (
            <p className="mt-1 font-bold text-ink-heading">
              시장환율 대비 약{" "}
              {(dcc.markupPct * 100).toFixed(1)}% (₩
              {dcc.markupKrw.toLocaleString("ko-KR")})
            </p>
          ) : null}
          <p className="mt-1">다음 결제는 현지통화로 선택하세요.</p>
          <p className="mt-1 text-ink-caption">
            카드사에 해외원화결제 차단 가능 여부를 확인해 보세요.
          </p>
          <p className="mt-2 text-[11px] text-ink-caption">
            {DCC_PUBLIC_STAT_NOTE}{" "}
            <a
              href={DCC_PUBLIC_STAT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              출처
            </a>
          </p>
        </div>
      ) : null}
    </div>
  );
}
