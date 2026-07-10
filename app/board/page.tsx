import { CommunityListPage } from "@/components/community/CommunityListPage";

export const dynamic = "force-dynamic";

export default function BoardPage() {
  return (
    <CommunityListPage
      heading="게시판"
      featureName="게시판"
      basePath="/board"
      categories={["all", "party", "question", "review", "tip"]}
      defaultCategory="all"
      defaultWriteCategory="party"
    />
  );
}
