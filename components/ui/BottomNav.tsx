"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CircleUserRound,
  Inbox,
  Route,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** pathname 매칭에 href 대신 쓰는 접두 (확인함=/agent/inbox) */
  matchPrefix?: string;
}

/**
 * EDR trip-centric IA Phase 1: 하단 3탭.
 * 여행 · 확인함 · 내 정보. 홈/멧톡/가계부 허브는 하단에서 제거.
 */
const NAV_ITEMS: NavItem[] = [
  { href: "/trips", label: "여행", icon: Route },
  {
    href: "/agent/inbox",
    label: "확인함",
    icon: Inbox,
    matchPrefix: "/agent/inbox",
  },
  { href: "/profile", label: "내 정보", icon: CircleUserRound },
];

function isActive(pathname: string, item: NavItem) {
  const prefix = item.matchPrefix ?? item.href;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function NavIcon({
  icon: Icon,
  active,
}: {
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <span
      className={[
        "relative flex h-7 w-7 items-center justify-center rounded-mu-sm transition-colors duration-mu",
        active ? "bg-mu-accent-soft" : "bg-transparent",
      ].join(" ")}
    >
      <Icon
        className={[
          "h-4 w-4 transition-colors duration-mu",
          active ? "text-mu-accent" : "text-mu-fg-3",
        ].join(" ")}
        strokeWidth={active ? 2.25 : 1.75}
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.12 : 0}
      />
    </span>
  );
}

function SideNavItem({
  item,
  active,
}: {
  item: NavItem;
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      className="mu-focus relative flex min-h-tap w-full flex-col items-center justify-center gap-px px-1.5 transition-colors active:scale-[0.97] hover:opacity-90"
      aria-current={active ? "page" : undefined}
    >
      <NavIcon icon={item.icon} active={active} />
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
 * 하단 고정 네비게이션 바.
 * 모바일 캔버스 내부에 고정. 주 입구는 여행·확인함·내 정보만.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center">
      <div className="pointer-events-auto w-full max-w-mobile overflow-visible border-t border-mu-line bg-mu-card/95 pb-[env(safe-area-inset-bottom)] shadow-mu-sheet backdrop-blur-md">
        <ul className="grid h-14 grid-cols-3 items-center overflow-visible px-2">
          {NAV_ITEMS.map((item) => (
            <li
              key={item.href}
              className="flex h-full items-center justify-center"
            >
              <SideNavItem item={item} active={isActive(pathname, item)} />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
