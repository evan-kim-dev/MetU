"use client";

type Props = {
  children: React.ReactNode;
};

export function StickyActionBar({ children }: Props) {
  return (
    <div className="sticky bottom-0 z-20 border-t border-line-muted bg-surface-base pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}
