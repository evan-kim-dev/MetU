"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CircleUserRound,
  Home,
  LayoutGrid,
  MessageSquareText,
  Route,
  type LucideIcon,
} from "lucide-react";
import { useCommunity } from "@/lib/community/CommunityProvider";
import { useChatRoomSummaries } from "@/lib/community/useChatRoomSummaries";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const LEFT_ITEMS: NavItem[] = [
  { href: "/trips", label: "내 여행", icon: Route },
  { href: "/board", label: "게시판", icon: LayoutGrid },
];

const RIGHT_ITEMS: NavItem[] = [
  { href: "/opod", label: "멧톡", icon: MessageSquareText },
  { href: "/profile", label: "프로필", icon: CircleUserRound },
];

const HOME_ITEM: NavItem = { href: "/", label: "홈", icon: Home };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavIcon({
  icon: Icon,
  active,
  size = "md",
}: {
  icon: LucideIcon;
  active: boolean;
  size?: "md" | "lg";
}) {
  const iconClass = size === "lg" ? "h-5 w-5" : "h-4 w-4";

  return (
    <span
      className={[
        "relative flex items-center justify-center transition-all duration-200",
        size === "md" ? "h-7 w-7 rounded-lg" : "h-10 w-10 rounded-full",
        active
          ? "bg-gradient-to-br from-brand/18 via-brand-mid/14 to-brand-soft/18 ring-1 ring-brand/25 shadow-glow"
          : "bg-transparent",
      ].join(" ")}
    >
      <Icon
        className={[
          iconClass,
          "transition-colors duration-200",
          active ? "text-brand" : "text-ink-caption",
        ].join(" ")}
        strokeWidth={active ? 2.4 : 2}
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.12 : 0}
      />
    </span>
  );
}

function SideNavItem({
  href,
  label,
  icon,
  active,
  badgeCount,
}: NavItem & { active: boolean; badgeCount?: number }) {
  return (
    <Link
      href={href}
      className="relative flex w-full flex-col items-center justify-center gap-px px-1.5 transition-colors active:scale-[0.97] hover:opacity-90"
      aria-current={active ? "page" : undefined}
    >
      <NavIcon icon={icon} active={active} />
      <span
        className={[
          "text-[9px] transition-colors",
          active ? "font-bold text-brand" : "font-semibold text-ink-caption",
        ].join(" ")}
      >
        {label}
      </span>
      {badgeCount && badgeCount > 0 ? (
        <span className="absolute right-1.5 top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-[#FAE100] to-[#FDE047] px-1.5 py-0.5 text-[9px] font-extrabold leading-none text-ink-heading shadow-sm">
          {badgeCount > 999 ? "999+" : badgeCount}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * 하단 고정 네비게이션 바.
 * 모바일 캔버스 내부에 고정되며 홈 버튼을 중앙에 강조한다.
 */
export function BottomNav() {
  const pathname = usePathname();
  const homeActive = isActive(pathname, HOME_ITEM.href);
  const { posts, isPartyHost, isPartyJoined } = useCommunity();

  const chatRoomPostIds = useMemo(
    () =>
      posts
        .filter(
          (post) =>
            post.category === "party" &&
            (isPartyHost(post) || isPartyJoined(post))
        )
        .map((post) => post.id),
    [isPartyHost, isPartyJoined, posts]
  );

  const { unreadCountByPostId } = useChatRoomSummaries(chatRoomPostIds, true);
  const opodUnreadCount = useMemo(
    () => Object.values(unreadCountByPostId).reduce((sum, count) => sum + count, 0),
    [unreadCountByPostId]
  );

  const HomeIcon = HOME_ITEM.icon;

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center">
      <div className="pointer-events-auto w-full max-w-mobile overflow-visible border-t border-line-soft/70 bg-surface-white/95 pb-[env(safe-area-inset-bottom)] shadow-nav backdrop-blur-md">
        <ul className="grid h-[56px] grid-cols-5 items-center overflow-visible px-1">
          {LEFT_ITEMS.map((item) => (
            <li key={item.href} className="flex h-full items-center justify-center">
              <SideNavItem {...item} active={isActive(pathname, item.href)} />
            </li>
          ))}

          <li className="relative flex h-full flex-col items-center justify-center gap-px overflow-visible">
            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-visible">
              <Link
                href={HOME_ITEM.href}
                aria-current={homeActive ? "page" : undefined}
                aria-label="홈"
                className={[
                  "absolute left-1/2 top-1/2 z-10 flex h-12 w-12 -translate-x-1/2 -translate-y-[calc(50%+12px)] items-center justify-center rounded-full border-[3px] border-surface-white ai-gradient-bg shadow-[0_10px_24px_rgba(37,99,235,0.5)] transition-all active:scale-95",
                  homeActive ? "ring-2 ring-brand/50" : "hover:brightness-105",
                ].join(" ")}
              >
                <HomeIcon
                  className="h-6 w-6 fill-surface-white text-surface-white"
                  strokeWidth={2.2}
                />
              </Link>
            </span>
            <span
              className={[
                "text-[9px] font-bold transition-colors",
                homeActive
                  ? "bg-gradient-to-r from-brand to-[#6366F1] bg-clip-text text-transparent"
                  : "text-brand",
              ].join(" ")}
            >
              {HOME_ITEM.label}
            </span>
          </li>

          {RIGHT_ITEMS.map((item) => (
            <li key={item.href} className="flex h-full items-center justify-center">              <SideNavItem
                {...item}
                active={isActive(pathname, item.href)}
                badgeCount={item.href === "/opod" ? opodUnreadCount : undefined}
              />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
