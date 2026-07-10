import { CommunityListPage } from "@/components/community/CommunityListPage";

export const dynamic = "force-dynamic";

export default function OpodPage() {
  return (
    <CommunityListPage
      featureName="멧톡"
      basePath="/opod"
      categories={["party"]}
      defaultCategory="party"
      defaultWriteCategory="party"
      showChatRooms
      showPostList={false}
    />
  );
}

