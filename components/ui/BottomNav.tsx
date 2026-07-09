"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Map, MessageCircle, Wallet, User, type LucideIcon } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const LEFT_ITEMS: NavItem[] = [
  { href: "/trips", label: "내 여행", icon: Map },
  { href: "/budget", label: "예산", icon: Wallet },
];

const RIGHT_ITEMS: NavItem[] = [
  { href: "/opod", label: "ㅇ팟", icon: MessageCircle },
  { href: "/profile", label: "프로필", icon: User },
];

const HOME_ITEM: NavItem = { href: "/", label: "홈", icon: Home };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function SideNavItem({
  href,
  label,
  icon: Icon,
  active,
}: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      className="flex h-full flex-col items-center justify-center gap-0.5 px-2 py-1 transition-colors"
      aria-current={active ? "page" : undefined}
    >
      <Icon
        className={`h-5 w-5 transition-colors ${
          active ? "text-brand" : "text-ink-caption"
        }`}
        strokeWidth={active ? 2.4 : 2}
      />
      <span
        className={`text-[10px] transition-colors ${
          active
            ? "font-bold text-brand"
            : "font-semibold text-ink-caption"
        }`}
      >
        {label}
      </span>
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

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center">
      <div className="pointer-events-auto w-full max-w-mobile border-t border-line-soft/70 bg-surface-white/95 pb-[env(safe-area-inset-bottom)] shadow-nav backdrop-blur-md">
        <ul className="grid h-[68px] grid-cols-5 items-end px-1">
          {LEFT_ITEMS.map((item) => (
            <li key={item.href} className="h-14">
              <SideNavItem {...item} active={isActive(pathname, item.href)} />
            </li>
          ))}

          <li className="relative flex h-14 flex-col items-center justify-end">
            <Link
              href={HOME_ITEM.href}
              aria-current={homeActive ? "page" : undefined}
              aria-label="홈"
              className={[
                "absolute -top-4 flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-surface-white shadow-soft transition-all active:scale-95",
                homeActive
                  ? "bg-brand-strong ring-4 ring-brand/20"
                  : "bg-brand hover:brightness-105",
              ].join(" ")}
            >
              <Home
                className="h-6 w-6 text-surface-white"
                strokeWidth={2.6}
                fill={homeActive ? "currentColor" : "none"}
              />
            </Link>
            <span
              className={`pb-1 text-[10px] font-bold transition-colors ${
                homeActive ? "text-brand-strong" : "text-brand"
              }`}
            >
              {HOME_ITEM.label}
            </span>
          </li>

          {RIGHT_ITEMS.map((item) => (
            <li key={item.href} className="h-14">
              <SideNavItem {...item} active={isActive(pathname, item.href)} />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
