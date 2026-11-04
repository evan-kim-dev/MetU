"use client";

type Props = { tips: string[] };

/** 공유 화면과 같은 팁 목록. 비어 있으면 렌더하지 않아요. */
export function TripDetailTipsSection({ tips }: Props) {
  if (tips.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-lg font-extrabold text-mu-fg">여행 팁</h3>
      <ul className="flex flex-col gap-2">
        {tips.map((tip) => (
          <li
            key={tip}
            className="rounded-2xl border border-mu-line bg-mu-card px-4 py-3 text-sm leading-relaxed text-mu-fg-2"
          >
            {tip}
          </li>
        ))}
      </ul>
    </section>
  );
}
