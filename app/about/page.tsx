import type { Metadata } from "next";
import { MobileShell } from "@/components/layout/MobileShell";

export const metadata: Metadata = {
  title: "MetU 소개",
  description:
    "여행 중 카드 알림이 오면 입력 없이 장부가 쌓이고, 환율이 적용되고, 동행자와 정산까지 이어지는 MetU를 소개해요.",
};

interface Step {
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    title: "카드 알림이 와요",
    body: "결제 알림을 MetU 수집 주소로 한 번만 연결해 두면 돼요. iOS는 단축어 설정이 필요해요.",
  },
  {
    title: "몇 초 안에 자동 기록",
    body: "알림 문구에서 가게와 금액을 읽어 장부에 적어요.",
  },
  {
    title: "환율을 적용해 원화로",
    body: "해외 결제는 서버가 가져온 환율로 환산해요. 못 가져오면 임의 값 없이 확인 대기로 남겨요.",
  },
  {
    title: "동행자와 정산",
    body: "누가 얼마를 냈는지 모아 서로 주고받을 금액을 계산해요. 송금은 앱 안내 링크만 드려요.",
  },
];

const READY: { label: string; note: string }[] = [
  {
    label: "카드 알림 자동 수집",
    note: "문자·알림을 수집 주소로 보내면 장부 후보가 생겨요.",
  },
  {
    label: "환율 실시간 적용",
    note: "조회 실패 시 자동 저장하지 않고 확인을 요청해요.",
  },
  {
    label: "동행자 정산 계산",
    note: "금액은 서버 순수 함수만 계산해요. AI는 계산하지 않아요.",
  },
  {
    label: "영수증 사진 입력",
    note: "자동 수집이 못 잡은 결제를 채우는 보조 수단이에요.",
  },
];

const NOT_YET: { label: string; note: string }[] = [
  {
    label: "iOS 완전 자동 수집",
    note: "단축어를 직접 설정해야 해요. 웹앱만으로는 알림을 읽을 수 없어요.",
  },
  {
    label: "네이티브 앱",
    note: "지금은 설치형 웹앱(PWA)이에요.",
  },
  {
    label: "Gmail 서버 연동",
    note: "메일함을 서버에서 읽는 기능은 없어요.",
  },
  {
    label: "앱 안 송금",
    note: "송금 앱을 여는 딥링크 안내만 있어요.",
  },
];

const REVENUE_IDEAS: { title: string; note: string }[] = [
  {
    title: "해외결제·트래블카드 수수료 비교 제휴",
    note: "카드사 제휴가 필요해요. 수수료율은 사용자가 설정한 값만 써요.",
  },
  {
    title: "정산 송금 연계",
    note: "지금은 딥링크 안내까지예요.",
  },
  {
    title: "단체·출장 팀 플랜",
    note: "아직 만들지 않았고 수요도 확인하지 못했어요.",
  },
  {
    title: "항공·호텔 제휴 링크",
    note: "호텔은 Agoda 링크가 있어요. 항공은 검색 링크까지예요. 수익은 검증 전이에요.",
  },
];

const PRIVACY_POINTS: string[] = [
  "알림 본문은 AI에 보내기 전에 카드번호 등 민감한 부분을 가려요.",
  "카드 전체 번호는 저장하지 않아요.",
  "자동 저장은 기본 한도 300,000원 이하일 때만 해요. 그 이상이거나 애매하면 확인 대기로 남겨요.",
  "자동으로 저장된 항목은 언제든 되돌릴 수 있어요.",
];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[15px] font-extrabold tracking-tight text-ink-heading">
      {children}
    </h2>
  );
}

function FeatureList({
  items,
}: {
  items: { label: string; note: string }[];
}) {
  return (
    <ul className="divide-y divide-line-soft/80">
      {items.map((row) => (
        <li key={row.label} className="flex flex-col gap-0.5 py-3.5 first:pt-1 last:pb-0">
          <p className="text-sm font-bold text-ink-heading">{row.label}</p>
          <p className="text-[13px] leading-5 text-ink-caption">{row.note}</p>
        </li>
      ))}
    </ul>
  );
}

/** 공개 소개 페이지. 지표·후기 없이 현재 코드에 있는 기능만 말한다. */
export default function AboutPage() {
  return (
    <MobileShell
      title="MetU 소개"
      showBack
      backHref="/"
      showBottomNav={false}
    >
      <article className="flex flex-col px-5 pb-14 pt-6">
        <header className="flex flex-col gap-3 pb-10">
          <p className="text-xs font-bold tracking-wide text-brand">MetU</p>
          <h1 className="text-[1.65rem] font-extrabold leading-[1.25] tracking-tight text-ink-heading">
            여행 중 카드 알림이 오면
            <br />
            <span className="ai-gradient-text">입력 없이 장부가 쌓여요</span>
          </h1>
          <p className="max-w-[22rem] text-[15px] leading-6 text-ink-body">
            환율 적용부터 동행자 정산까지, 결제 알림 한 줄에서 이어져요.
          </p>
        </header>

        <section className="flex flex-col gap-5 border-t border-line-soft/90 pt-8">
          <SectionHeading>어떻게 동작하나요</SectionHeading>
          <ol className="flex flex-col">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="relative grid grid-cols-[2rem_1fr] gap-x-3 pb-7 last:pb-0"
              >
                {index < STEPS.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-[0.95rem] top-8 w-px bg-line-soft"
                  />
                ) : null}
                <span
                  aria-hidden
                  className="relative z-[1] flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-extrabold text-surface-white"
                >
                  {index + 1}
                </span>
                <div className="flex flex-col gap-1 pt-0.5">
                  <p className="text-sm font-extrabold text-ink-heading">
                    {step.title}
                  </p>
                  <p className="text-[13px] leading-5 text-ink-body">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-2 flex flex-col gap-6 border-t border-line-soft/90 pt-8">
          <div className="flex flex-col gap-3">
            <SectionHeading>지금 돼요</SectionHeading>
            <FeatureList items={READY} />
          </div>
          <div className="flex flex-col gap-3">
            <SectionHeading>아직이에요</SectionHeading>
            <FeatureList items={NOT_YET} />
          </div>
        </section>

        <section className="mt-2 flex flex-col gap-3 border-t border-line-soft/90 pt-8">
          <SectionHeading>수익 아이디어 · 검증 전</SectionHeading>
          <p className="text-[13px] leading-5 text-ink-caption">
            매출·계약이 있는 내용이 아니에요. 제휴가 필요한 항목은 아직 협의하지
            않았어요.
          </p>
          <ul className="flex flex-col gap-4 pt-1">
            {REVENUE_IDEAS.map((idea) => (
              <li key={idea.title} className="flex flex-col gap-0.5">
                <p className="text-sm font-bold text-ink-heading">{idea.title}</p>
                <p className="text-[13px] leading-5 text-ink-caption">
                  {idea.note}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-2 flex flex-col gap-3 border-t border-line-soft/90 pt-8">
          <SectionHeading>개인정보는 이렇게 다뤄요</SectionHeading>
          <ul className="flex flex-col gap-2.5">
            {PRIVACY_POINTS.map((point) => (
              <li
                key={point}
                className="flex gap-2.5 text-[13px] leading-5 text-ink-body"
              >
                <span
                  aria-hidden
                  className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-caption"
                />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </MobileShell>
  );
}
