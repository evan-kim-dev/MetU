"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Camera,
  ClipboardPaste,
  FileText,
  Inbox,
  Mic,
  Receipt,
  Scale,
  Share2,
  Sparkles,
  UserPlus,
  Wallet,
} from "lucide-react";
import { DemoModePanel } from "@/components/agent/DemoModePanel";
import { AutomationStatusBanner } from "@/components/home/AutomationStatusBanner";
import { MobileShell } from "@/components/layout/MobileShell";
import { QuickTripSheet } from "@/components/trips/QuickTripSheet";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useAutomationStatus } from "@/lib/hooks/useAutomationStatus";
import { useTrips } from "@/lib/trips/TripProvider";

const FEATURES = [
  {
    title: "가계부 입력",
    desc: "문자·영수증·음성·직접 입력 → 확인 시트 후 저장",
    hrefSuffix: "/ledger",
    icon: Wallet,
  },
  {
    title: "자동 수집 연결",
    desc: "문자 수집 토큰·단축어·테스트 curl",
    hrefSuffix: "/ledger/connect",
    icon: Share2,
  },
  {
    title: "정산",
    desc: "잔액·최소 송금·완료 체크·공유 링크",
    hrefSuffix: "/ledger/settle",
    icon: Scale,
  },
  {
    title: "리포트",
    desc: "일/카테고리/사람별 요약·인쇄",
    hrefSuffix: "/ledger/report",
    icon: FileText,
  },
] as const;

const GLOBAL_LINKS = [
  {
    href: "/agent/inbox",
    title: "내 수신함",
    desc: "여행 없이 모인 알림·미할당 이벤트",
    icon: Inbox,
  },
  {
    href: "/share-target",
    title: "공유로 받기",
    desc: "Android PWA 공유·붙여넣기·사진 업로드",
    icon: Share2,
  },
] as const;

export function AgentHubContent() {
  const { isReady: authReady, isLoggedIn, provider } = useAuth();
  const isGuest = provider === "guest";
  const { trips, isReady, activeTrips } = useTrips();
  const list = (activeTrips.length ? activeTrips : trips).slice(0, 12);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { uiState, loading, error } = useAutomationStatus({
    enabled: authReady && isLoggedIn && !isGuest,
    lite: true,
  });

  return (
    <MobileShell title="가계부">
      <div className="flex flex-col gap-5 px-4 py-4">
        {!isGuest &&
        !loading &&
        !error &&
        (uiState === "ok" || uiState === "silent") ? (
          <section className="rounded-2xl bg-surface-white p-4 shadow-sm ring-1 ring-line-soft">
            <p className="text-sm font-extrabold text-ink-heading">
              카드 알림 자동 기록이 켜져 있어요
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <Link
                href="/onboarding/automation"
                className="inline-flex min-h-11 items-center text-sm font-bold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                관리
              </Link>
              <Link
                href="/agent/inbox"
                className="inline-flex min-h-11 items-center text-sm font-bold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                수신함 보기
              </Link>
            </div>
          </section>
        ) : null}

        {/* 소프트 배너: 미설정·건너뛴 사용자에게 강제 이동 없이 안내만 해요. */}
        {!isGuest && (uiState === "off" || uiState === "unverified") ? (
          <AutomationStatusBanner ignoreFirstRun />
        ) : null}

        {!isGuest ? <DemoModePanel /> : null}

        <section className="rounded-2xl bg-gradient-to-br from-brand/12 via-brand-mid/8 to-transparent p-4">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
            <div>
              <h2 className="text-base font-extrabold text-ink-heading">
                가계부·정산 모아보기
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-body">
                문자·영수증·음성으로 지출을 넣고, 환율과 정산까지 한곳에서
                해요. 여행마다 가계부가 따로 있어요.
              </p>
            </div>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-ink-body">
            <li className="inline-flex items-center gap-1 rounded-full bg-surface-white/80 px-2 py-1">
              <ClipboardPaste className="h-3 w-3" /> 문자
            </li>
            <li className="inline-flex items-center gap-1 rounded-full bg-surface-white/80 px-2 py-1">
              <Camera className="h-3 w-3" /> 영수증
            </li>
            <li className="inline-flex items-center gap-1 rounded-full bg-surface-white/80 px-2 py-1">
              <Mic className="h-3 w-3" /> 음성
            </li>
            <li className="inline-flex items-center gap-1 rounded-full bg-surface-white/80 px-2 py-1">
              <Receipt className="h-3 w-3" /> 환율·수수료
            </li>
            <li className="inline-flex items-center gap-1 rounded-full bg-surface-white/80 px-2 py-1">
              <UserPlus className="h-3 w-3" /> 초대
            </li>
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-extrabold text-ink-heading">
            여행 선택
          </h3>
          {!isReady ? (
            <div className="h-24 animate-pulse rounded-2xl bg-surface-soft" />
          ) : list.length === 0 ? (
            <div className="rounded-2xl bg-surface-soft px-4 py-6 text-center">
              <p className="text-sm text-ink-body">
                아직 여행이 없어요. 여행을 만들면 가계부가 생겨요.
              </p>
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="ai-gradient-bg mt-3 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold text-surface-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                빠르게 여행 만들기
              </button>
              <Link
                href="/onboarding"
                className="mt-2 inline-flex min-h-11 items-center text-xs font-bold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                AI로 일정까지 계획하기
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {list.map((trip) => (
                <li
                  key={trip.id}
                  className="rounded-2xl border border-line-soft/80 bg-surface-white p-3 shadow-sm"
                >
                  <p className="text-sm font-extrabold text-ink-heading">
                    {trip.destination}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-body">
                    {trip.dateRange}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {FEATURES.map((f) => {
                      const Icon = f.icon;
                      return (
                        <Link
                          key={f.hrefSuffix}
                          href={`/trips/${trip.id}${f.hrefSuffix}`}
                          className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl bg-surface-soft px-2 py-2.5 text-center transition hover:bg-brand/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                        >
                          <Icon className="h-4 w-4 text-brand" />
                          <span className="text-xs font-bold text-ink-heading">
                            {f.title}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-extrabold text-ink-heading">
            공통 진입
          </h3>
          <ul className="flex flex-col gap-2">
            {GLOBAL_LINKS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex min-h-11 items-center gap-3 rounded-2xl bg-surface-soft px-3 py-3 transition hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-white">
                    <Icon className="h-4 w-4 text-brand" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-ink-heading">
                      {item.title}
                    </span>
                    <span className="block text-xs text-ink-body">
                      {item.desc}
                    </span>
                  </span>
                </Link>
              );
            })}
            <div className="rounded-2xl bg-surface-soft px-3 py-3 text-xs leading-relaxed text-ink-body">
              <p className="font-bold text-ink-heading">초대 링크</p>
              <p className="mt-1">
                동행자를 가계부에 추가하면 초대 링크를 보낼 수 있어요. 받은
                사람은 링크로 바로 합류해요.
              </p>
              <p className="mt-1">
                공개 정산 보기는 정산 화면의 공유 버튼에서 만들 수 있어요.
              </p>
            </div>
            <Link
              href="/board"
              className="inline-flex min-h-11 items-center justify-center text-center text-xs font-semibold text-ink-body underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              게시판 보기
            </Link>
          </ul>
        </section>
      </div>

      <QuickTripSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        reason="hub"
      />
    </MobileShell>
  );
}
