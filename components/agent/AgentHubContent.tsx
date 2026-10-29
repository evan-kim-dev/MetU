"use client";

import Link from "next/link";
import {
  Camera,
  ClipboardPaste,
  FileText,
  Mic,
  Receipt,
  Scale,
  Share2,
  Sparkles,
  UserPlus,
  Wallet,
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
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
    href: "/share-target",
    title: "공유로 받기",
    desc: "Android PWA 공유·붙여넣기·사진 업로드",
    icon: Share2,
  },
] as const;

export function AgentHubContent() {
  const { trips, isReady, activeTrips } = useTrips();
  const list = (activeTrips.length ? activeTrips : trips).slice(0, 12);

  return (
    <MobileShell title="Agent">
      <div className="flex flex-col gap-5 px-4 py-4">
        <section className="rounded-2xl bg-gradient-to-br from-brand/12 via-brand-mid/8 to-transparent p-4">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
            <div>
              <h2 className="text-base font-extrabold text-ink-heading">
                가계부·정산 모아보기
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-body">
                해커톤에서 추가한 자동 입력·환율·정산 기능을 여기서 고르면 돼요.
                여행마다 가계부가 따로 있어요.
              </p>
            </div>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-ink-muted">
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
              <p className="text-sm text-ink-body">아직 여행이 없어요.</p>
              <Link
                href="/onboarding"
                className="mt-3 inline-block text-xs font-bold text-brand"
              >
                여행 만들기
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
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    {trip.dateRange}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {FEATURES.map((f) => {
                      const Icon = f.icon;
                      return (
                        <Link
                          key={f.hrefSuffix}
                          href={`/trips/${trip.id}${f.hrefSuffix}`}
                          className="flex flex-col items-center gap-1 rounded-xl bg-surface-soft px-2 py-2.5 text-center transition hover:bg-brand/10 active:scale-[0.98]"
                        >
                          <Icon className="h-4 w-4 text-brand" />
                          <span className="text-[10px] font-bold text-ink-heading">
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
                  className="flex items-center gap-3 rounded-2xl bg-surface-soft px-3 py-3 transition hover:bg-brand/10"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-white">
                    <Icon className="h-4 w-4 text-brand" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-ink-heading">
                      {item.title}
                    </span>
                    <span className="block text-[11px] text-ink-muted">
                      {item.desc}
                    </span>
                  </span>
                </Link>
              );
            })}
            <div className="rounded-2xl bg-surface-soft px-3 py-3 text-[11px] leading-relaxed text-ink-muted">
              <p className="font-bold text-ink-heading">초대 링크</p>
              <p className="mt-1">
                가계부에서 동행자를 추가한 뒤 초대하면{" "}
                <code className="rounded bg-white px-1">/join/토큰</code> 으로
                합류해요. 공개 정산 읽기는{" "}
                <code className="rounded bg-white px-1">/s/토큰</code> 입니다.
              </p>
            </div>
            <Link
              href="/board"
              className="text-center text-[11px] font-semibold text-ink-muted underline"
            >
              게시판은 여기로 (/board)
            </Link>
          </ul>
        </section>
      </div>
    </MobileShell>
  );
}
