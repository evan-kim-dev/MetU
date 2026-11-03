/**
 * 게스트 "내가 냈어요" 자리(K14가 채움). K10b에서는 빈 슬롯 + 안내만.
 */
export function GuestExpenseSlot() {
  return (
    <section
      aria-label="지출 제안"
      className="rounded-xl border border-dashed border-line-muted bg-surface-soft px-3 py-4 text-center"
    >
      <p className="text-sm font-bold text-ink-heading">내가 낸 지출</p>
      <p className="mt-1 text-xs text-ink-muted">
        호스트가 승인하면 정산에 들어가요. 곧 여기서 제안할 수 있어요.
      </p>
    </section>
  );
}
