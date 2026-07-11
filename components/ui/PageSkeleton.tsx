import { MobileShell } from "@/components/layout/MobileShell";

export function SkeletonBlock({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-2xl bg-surface-soft ${className}`}
      aria-hidden
    />
  );
}

/** 목록형 화면(여행/게시판) 공통 스켈레톤 */
export function ListPageSkeleton({
  title,
  rows = 3,
  showBack = false,
  backHref = "/",
}: {
  title: string;
  rows?: number;
  showBack?: boolean;
  backHref?: string;
}) {
  return (
    <MobileShell title={title} showBack={showBack} backHref={backHref}>
      <div className="flex flex-col gap-3 px-5 pb-2 pt-5" aria-busy="true" aria-label="불러오는 중">
        <SkeletonBlock className="h-10 w-full rounded-xl" />
        {Array.from({ length: rows }, (_, index) => (
          <SkeletonBlock key={index} className="h-28 w-full" />
        ))}
      </div>
    </MobileShell>
  );
}

/** 상세 화면 공통 스켈레톤 */
export function DetailPageSkeleton({
  title,
  backHref = "/",
}: {
  title: string;
  backHref?: string;
}) {
  return (
    <MobileShell title={title} showBack backHref={backHref}>
      <div className="flex flex-col gap-4 px-5 pb-2 pt-5" aria-busy="true" aria-label="불러오는 중">
        <SkeletonBlock className="h-52 w-full rounded-xl2" />
        <div className="grid grid-cols-2 gap-3">
          <SkeletonBlock className="h-20" />
          <SkeletonBlock className="h-20" />
        </div>
        <SkeletonBlock className="h-36 w-full" />
        <SkeletonBlock className="h-24 w-full" />
      </div>
    </MobileShell>
  );
}

/** 홈 섹션용 인라인 스켈레톤 */
export function SectionSkeleton({
  title,
  heightClass = "h-52",
}: {
  title?: string;
  heightClass?: string;
}) {
  return (
    <section className="flex flex-col gap-3" aria-busy="true" aria-label="불러오는 중">
      {title ? (
        <div className="flex items-center justify-between">
          <SkeletonBlock className="h-5 w-28 rounded-md" />
          <SkeletonBlock className="h-4 w-14 rounded-md" />
        </div>
      ) : null}
      <SkeletonBlock className={`w-full rounded-xl2 ${heightClass}`} />
    </section>
  );
}
