"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Inbox,
  Route,
  type LucideIcon,
} from "lucide-react";
import { INBOX_NAME } from "@/lib/ledger/inbox-copy";
import { useUnassignedInboxCount } from "@/lib/ledger/use-unassigned-inbox-count";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  /** 확인함 미배정 배지 */
  badge?: boolean;
}

/**
 * 하단 3탭: 여행 · 홈 · 확인함.
 * 내 정보는 상단 바 우측(`ProfileTopButton`).
 */
const NAV_ITEMS: NavItem[] = [
  { href: "/trips", label: "여행", icon: Route },
  { href: "/", label: "홈", icon: Home, exact: true },
  { href: "/agent/inbox", label: INBOX_NAME, icon: Inbox, badge: true },
];

function isActive(pathname: string, item: NavItem) {
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavIcon({
  icon: Icon,
  active,
  badgeCount,
}: {
  icon: LucideIcon;
  active: boolean;
  badgeCount?: number;
}) {
  return (
    <span
      className={[
        "relative flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-mu",
        active ? "bg-mu-accent-soft" : "bg-transparent",
      ].join(" ")}
    >
      <Icon
        className={[
          "h-5 w-5 transition-colors duration-mu",
          active ? "text-mu-accent" : "text-mu-fg-3",
        ].join(" ")}
        strokeWidth={active ? 2.25 : 1.75}
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.12 : 0}
      />
      {badgeCount != null && badgeCount > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-mu-err px-0.5 text-mu-caption font-extrabold leading-none text-mu-on-accent">
          {badgeCount > 9 ? "9+" : badgeCount}
        </span>
      ) : null}
    </span>
  );
}

function SideNavItem({
  item,
  active,
  badgeCount,
}: {
  item: NavItem;
  active: boolean;
  badgeCount?: number;
}) {
  const ariaLabel =
    item.badge && badgeCount != null && badgeCount > 0
      ? `${item.label} ${badgeCount > 9 ? "9+" : badgeCount}건`
      : item.label;

  return (
    <Link
      href={item.href}
      aria-label={ariaLabel}
      className="mu-focus relative flex min-h-tap w-full flex-col items-center justify-center gap-0.5 px-1 transition-colors active:scale-[0.97] hover:opacity-90"
      aria-current={active ? "page" : undefined}
    >
      <NavIcon icon={item.icon} active={active} badgeCount={badgeCount} />
      <span
        className={[
          "whitespace-nowrap text-mu-caption transition-colors",
          active ? "font-bold text-mu-accent" : "font-semibold text-mu-fg-3",
        ].join(" ")}
      >
        {item.label}
      </span>
    </Link>
  );
}

/**
 * 떠 있는 하단 네비게이션 (Threads/Instagram 독 느낌).
 * 모바일 캔버스 안, safe-area 위에 떠 있어요.
 */
export function BottomNav() {
  const pathname = usePathname();
  const inboxCount = useUnassignedInboxCount();

  return (
    <nav
      aria-label="하단 메뉴"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="pointer-events-auto w-full max-w-[22rem]">
        <ul className="grid h-14 grid-cols-3 items-center overflow-visible rounded-full border border-mu-line bg-mu-card/90 px-2 shadow-mu-float backdrop-blur-md">
          {NAV_ITEMS.map((item) => (
            <li
              key={item.href}
              className="flex h-full items-center justify-center"
            >
              <SideNavItem
                item={item}
                active={isActive(pathname, item)}
                badgeCount={item.badge ? inboxCount : undefined}
              />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
