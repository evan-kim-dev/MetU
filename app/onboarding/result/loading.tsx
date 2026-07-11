import { DetailPageSkeleton } from "@/components/ui/PageSkeleton";

/** 폴백 일정은 동기 생성이라 거의 즉시 렌더됩니다. */
export default function ResultLoading() {
  return <DetailPageSkeleton title="AI 추천 결과" backHref="/onboarding" />;
}
