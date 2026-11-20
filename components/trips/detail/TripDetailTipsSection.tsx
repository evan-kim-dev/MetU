"use client";

type Props = { tips: string[] };

/** 공유 화면과 같이 팁을 한 카드로 묶어 보여 줘요. */
export function TripDetailTipsSection({ tips }: Props) {
  if (tips.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-lg font-extrabold text-mu-fg">여행 팁</h3>
      <div className="rounded-2xl border border-mu-line bg-mu-card px-4 py-4">
        <ul className="flex flex-col gap-3">
          {tips.map((tip) => (
            <li
              key={tip}
              className="flex gap-2.5 text-sm leading-relaxed text-mu-fg-2"
            >
              <span
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-mu-accent"
                aria-hidden
              />
              <span className="min-w-0">{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
