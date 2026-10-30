export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-3 px-5 pt-8" aria-busy="true">
      <span className="sr-only" role="status">
        불러오는 중…
      </span>
      <div className="h-4 w-2/3 animate-pulse rounded bg-surface-soft" />
      <div className="h-4 w-full animate-pulse rounded bg-surface-soft" />
      <div className="h-4 w-5/6 animate-pulse rounded bg-surface-soft" />
    </div>
  );
}
