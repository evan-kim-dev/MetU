import { CommunityListPage } from "@/components/community/CommunityListPage";

export default function BoardPage() {
  return (
    <CommunityListPage
      heading="게시판"
      featureName="게시판"
      basePath="/board"
      categories={["all", "party", "question", "review", "tip", "chat"]}
      defaultCategory="all"
      defaultWriteCategory="party"
    />
  );
}
