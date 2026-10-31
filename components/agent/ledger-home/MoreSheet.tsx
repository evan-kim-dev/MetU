"use client";

import Link from "next/link";
import {
  Inbox,
  FileText,
  Link2,
  MessagesSquare,
  Mic,
  Receipt,
  Share2,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";

type Props = {
  open: boolean;
  onClose: () => void;
  /** 선택된 여행이 없으면 여행 관련 항목은 숨겨요 */
  tripId: string | null;
  unassignedCount: number;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
};

type Item = {
  key: string;
  href: string;
  title: string;
  desc: string;
  icon: LucideIcon;
};

function buildItems(tripId: string | null): { global: Item[]; trip: Item[] } {
  const t = tripId ? `/trips/${tripId}/ledger` : "";
  return {
    global: [
      {
        key: "share",
        href: "/share-target",
        title: "공유로 받기",
        desc: "사진·문자를 공유해서 가계부에 넣어요",
        icon: Share2,
      },
      {
        key: "inbox",
        href: "/agent/inbox",
        title: "내 수신함",
        desc: "여행에 붙이지 못한 알림을 정리해요",
        icon: Inbox,
      },
      {
        key: "automation",
        href: "/onboarding/automation",
        title: "자동 수집 연결 관리",
        desc: "카드 알림 연결 상태를 확인해요",
        icon: Link2,
      },
      {
        key: "board",
        href: "/board",
        title: "게시판",
        desc: "다른 여행자의 이야기를 봐요",
        icon: MessagesSquare,
      },
    ],
    trip: [
      {
        key: "invite",
        href: t,
        title: "동행자 초대",
        desc: "동행자를 추가하고 초대 링크를 보내요",
        icon: UserPlus,
      },
      {
        key: "fx",
        href: `${t}?settings=fx`,
        title: "환율·수수료 설정",
        desc: "카드 수수료와 현금 환율을 정해요",
        icon: Receipt,
      },
      {
        key: "voice",
        href: `${t}?add=voice`,
        title: "음성으로 추가",
        desc: "말로 지출을 적어요",
        icon: Mic,
      },
      {
        key: "report",
        href: `${t}/report`,
        title: "리포트",
        desc: "날짜·카테고리·사람별로 모아 봐요",
        icon: FileText,
      },
    ],
  };
}

export function MoreSheet({
  open,
  onClose,
  tripId,
  unassignedCount,
  returnFocusRef,
}: Props) {
  const { global, trip } = buildItems(tripId);
  // 화면에 보이는 순서: 여행 항목 → 공통 항목
  const items = tripId ? [...trip, ...global] : global;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="더보기"
      returnFocusRef={returnFocusRef}
    >
      <ul className="flex flex-col">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                onClick={onClose}
                className="flex min-h-tap items-center gap-3 rounded-xl px-1 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-soft">
                  <Icon className="h-4 w-4 text-brand" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink-heading">
                    {item.title}
                  </span>
                  <span className="block truncate text-xs text-ink-body">
                    {item.desc}
                  </span>
                </span>
                {item.key === "inbox" && unassignedCount > 0 ? (
                  <span
                    aria-label={`미배정 ${unassignedCount}건`}
                    className="rounded-full bg-danger px-2 py-0.5 text-xs font-extrabold tabular-nums text-white"
                  >
                    {unassignedCount > 99 ? "99+" : unassignedCount}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
      {tripId ? null : (
        <p className="px-1 text-xs text-ink-caption">
          여행을 만들면 초대·환율·음성·리포트 메뉴도 열려요
        </p>
      )}
    </BottomSheet>
  );
}
