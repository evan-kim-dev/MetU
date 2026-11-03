"use client";

import { AmountCard } from "@/components/ds/AmountCard";
import {
  MY_SHARE_PAY_HINT,
  type MyShareView,
} from "@/lib/ledger/my-share";

type Props = {
  view: MyShareView;
  /** "왜 이 금액?" 등 */
  action?: React.ReactNode;
  /** 송금 앱 버튼 영역 (showPayActions일 때만 의미) */
  payActions?: React.ReactNode;
};

export function MyShareCard({ view, action, payActions }: Props) {
  const tone =
    view.kind === "owe" ? "accent" : view.kind === "receive" ? "ok" : "neutral";
  const sub =
    view.hint ??
    (view.showPayActions && payActions ? MY_SHARE_PAY_HINT : undefined);

  return (
    <section aria-label="내 몫" className="flex flex-col gap-3">
      <AmountCard
        label={view.label}
        amount={view.amountKrw}
        tone={tone}
        sub={sub}
        action={action}
      />
      {view.showPayActions && payActions ? (
        <div className="flex flex-col gap-2">{payActions}</div>
      ) : null}
    </section>
  );
}
