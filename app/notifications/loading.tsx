import { ListPageSkeleton } from "@/components/ui/PageSkeleton";

export default function NotificationsLoading() {
  return <ListPageSkeleton title="알림" rows={4} showBack backHref="/" />;
}
