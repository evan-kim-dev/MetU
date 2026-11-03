"use client";

import type { TripRecap } from "@/lib/ledger/recap";
import { formatKRW } from "@/lib/shared/format";

type Props = {
  destination?: string;
  recap: TripRecap;
};

export function RecapCard({ destination, recap }: Props) {
  return (
    <article
      aria-label="여행 리캡"
      className="rounded-2xl border border-mu-line bg-mu-card p-6 shadow-sm"
    >
      {destination ? (
        <p className="text-mu-label text-mu-fg-3">{destination}</p>
      ) : null}
      <p className="mt-2 text-mu-label text-mu-fg-3">총지출</p>
      <p className="mu-num mt-1 text-mu-amount-xl text-mu-fg">
        {formatKRW(recap.totalKrw)}
      </p>

      {recap.perMemberOwed.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm font-extrabold text-mu-fg">1인당 몫</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {recap.perMemberOwed.map((m) => (
              <li
                key={m.memberId}
                className="flex min-h-[44px] items-center justify-between"
              >
                <span>{m.name}</span>
                <span className="mu-num font-bold">{formatKRW(m.krw)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {recap.topDay ? (
        <p className="mt-4 text-sm text-mu-fg-2">
          가장 많이 쓴 날{" "}
          <strong>
            {recap.topDay.date} · {formatKRW(recap.topDay.krw)}
          </strong>
        </p>
      ) : null}

      {recap.topCategory ? (
        <p className="mt-2 text-sm text-mu-fg-2">
          최다 카테고리{" "}
          <strong>
            {recap.topCategory.category} · {formatKRW(recap.topCategory.krw)}
          </strong>
        </p>
      ) : null}

      {recap.feeLeak ? (
        <p className="mt-4 text-sm text-mu-fg-2">
          측정된 수수료 누수{" "}
          <strong>{formatKRW(recap.feeLeak.measuredKrw)}</strong>
          <span className="text-mu-fg-3">
            {" "}
            ({recap.feeLeak.measuredCount}건 · 청구액 기준)
          </span>
        </p>
      ) : null}

      {recap.dccSuspectedCount != null ? (
        <p className="mt-2 text-xs text-mu-fg-3">
          DCC 의심 {recap.dccSuspectedCount}건
        </p>
      ) : null}

      {recap.recordCounts ? (
        <p className="mt-4 text-[11px] text-mu-fg-3">
          기록{" "}
          {Object.entries(recap.recordCounts)
            .map(([k, n]) => `${k} ${n}`)
            .join(" · ")}
        </p>
      ) : null}
    </article>
  );
}
