import { SkeletonBlock } from "@/components/ui/PageSkeleton";

/** 실제 구조와 같은 높이: [헤더 카드 h-36][버튼 2칸 h-14][리스트 3행 h-14] */
export function LedgerHomeSkeleton() {
  return (
    <div
      className="flex flex-col gap-4"
      aria-busy="true"
      aria-label="불러오는 중"
      role="status"
    >
      <SkeletonBlock className="h-36 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <SkeletonBlock className="h-14 w-full rounded-xl" />
        <SkeletonBlock className="h-14 w-full rounded-xl" />
      </div>
      <div className="flex flex-col gap-2">
        <SkeletonBlock className="h-14 w-full" />
        <SkeletonBlock className="h-14 w-full" />
        <SkeletonBlock className="h-14 w-full" />
      </div>
    </div>
  );
}
