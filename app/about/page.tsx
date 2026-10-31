import type { Metadata } from "next";
import { MobileShell } from "@/components/layout/MobileShell";

export const metadata: Metadata = {
  title: "MetU 소개",
  description:
    "여행 중 카드 알림이 오면 입력 없이 장부가 쌓이고, 환율이 적용되고, 동행자와 정산까지 이어지는 MetU를 소개해요.",
};

type Status = "구현됨" | "일부 구현" | "아이디어" | "아직 안 돼요";

interface Step {
  title: string;
  body: string;
}

interface CapabilityRow {
  label: string;
  status: Status;
  note: string;
}

interface RevenueIdea {
  title: string;
  status: Status;
  note: string;
}

const STEPS: Step[] = [
  {
    title: "카드 알림이 와요",
    body: "카드사 결제 알림 내용을 MetU 수집 주소로 전달하도록 한 번 설정해 두면 돼요. iOS는 단축어 자동화가 필요해요.",
  },
  {
    title: "몇 초 안에 자동 기록",
    body: "알림 문구를 읽어 가게와 금액을 장부에 적어요. 걸리는 시간은 직접 측정한 값이 있을 때만 숫자로 말하고, 지금은 “몇 초 안에”라고만 말해요.",
  },
  {
    title: "환율 적용해 원화로",
    body: "해외 결제는 실시간으로 가져온 환율로 원화 금액을 서버가 계산해요. 환율을 못 가져오면 임의 값을 쓰지 않고 확인 대기로 남겨요.",
  },
  {
    title: "동행자와 정산",
    body: "누가 얼마를 냈는지 모아 서로 주고받을 금액을 계산해요. 송금은 앱에서 직접 하지 않고, 송금 앱을 여는 안내 링크만 드려요.",
  },
];

const CAPABILITIES: CapabilityRow[] = [
  {
    label: "카드 알림 자동 수집 (문자/알림 전달)",
    status: "구현됨",
    note: "수집 주소로 알림 본문을 보내면 장부 후보가 만들어져요.",
  },
  {
    label: "환율 실시간 적용",
    status: "구현됨",
    note: "환율 조회에 실패하면 자동으로 저장하지 않고 확인을 요청해요.",
  },
  {
    label: "동행자 정산 계산",
    status: "구현됨",
    note: "금액 계산은 서버의 순수 함수만 해요. AI는 금액을 계산하지 않아요.",
  },
  {
    label: "영수증 사진 입력",
    status: "일부 구현",
    note: "자동 수집이 못 잡은 결제를 채우는 보조 수단이에요.",
  },
  {
    label: "iOS 완전 자동 수집",
    status: "아직 안 돼요",
    note: "iOS는 단축어 자동화를 직접 설정해야 해요. 웹앱 단독으로는 알림을 읽을 수 없어요.",
  },
  {
    label: "네이티브 앱",
    status: "아직 안 돼요",
    note: "지금은 설치형 웹앱(PWA)이에요. 네이티브 앱은 이후 과제예요.",
  },
  {
    label: "Gmail 서버 연동",
    status: "아직 안 돼요",
    note: "메일함을 서버에서 읽는 기능은 없어요.",
  },
  {
    label: "앱 안 송금",
    status: "아직 안 돼요",
    note: "송금 앱을 여는 딥링크 안내만 있어요.",
  },
];

const REVENUE_IDEAS: RevenueIdea[] = [
  {
    title: "해외결제·트래블카드 수수료 비교 제휴",
    status: "아이디어",
    note: "카드사와 제휴가 필요해요. 수수료율은 약관마다 달라서 사용자가 직접 설정한 값만 써요. 검증이 필요해요.",
  },
  {
    title: "정산 송금 연계",
    status: "아이디어",
    note: "송금 서비스와 제휴가 필요해요. 지금은 딥링크 안내까지만 있어요. 검증이 필요해요.",
  },
  {
    title: "단체·출장 팀 플랜 (B2B)",
    status: "아이디어",
    note: "영수증·경비 내보내기를 묶은 팀용 상품이에요. 아직 만들지 않았고 수요도 확인하지 못했어요.",
  },
  {
    title: "항공·호텔 제휴 링크",
    status: "일부 구현",
    note: "호텔은 Agoda 제휴 링크가 연결돼 있어요. 항공은 검색 링크 연결까지예요. 실제 수익은 아직 검증하지 못했어요.",
  },
];

const PRIVACY_POINTS: string[] = [
  "알림 본문은 AI에 보내기 전에 카드번호 등 민감한 부분을 가려요.",
  "카드 전체 번호는 저장하지 않아요.",
  "자동 저장은 기본 한도 300,000원 이하일 때만 해요. 그 이상이거나 애매하면 확인 대기로 남겨요.",
  "자동으로 저장된 항목은 언제든 되돌릴 수 있어요.",
];

const STATUS_STYLE: Record<Status, string> = {
  구현됨: "bg-emerald-50 text-emerald-700",
  "일부 구현": "bg-amber-50 text-amber-700",
  아이디어: "bg-surface-soft text-ink-body",
  "아직 안 돼요": "bg-red-50 text-red-700",
};

function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[status]}`}
    >
      {status}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-bold tracking-tight text-ink-heading">
      {children}
    </h3>
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
      <article className="flex flex-col gap-8 px-5 pb-12 pt-5">
        <header className="flex flex-col gap-2">
          <h2 className="text-2xl font-extrabold leading-snug text-ink-heading">
            여행 중 카드 알림이 오면
            <br />
            <span className="ai-gradient-text">입력 없이 장부가 쌓여요</span>
          </h2>
          <p className="text-sm leading-6 text-ink-body">
            여행 중 카드 알림이 오면 입력 없이 장부가 쌓이고, 환율이 적용되고,
            동행자와 정산까지 이어져요.
          </p>
        </header>

        <section className="flex flex-col gap-3">
          <SectionTitle>어떻게 동작하나요</SectionTitle>
          <ol className="flex flex-col gap-3">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="flex gap-3 rounded-xl2 bg-surface-white p-4 shadow-soft"
              >
                <span
                  aria-hidden
                  className="ai-gradient-bg flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-surface-white"
                >
                  {index + 1}
                </span>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-bold text-ink-heading">
                    {step.title}
                  </p>
                  <p className="text-sm leading-6 text-ink-body">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle>지금 되는 것과 아직 안 되는 것</SectionTitle>
          <ul className="flex flex-col gap-3">
            {CAPABILITIES.map((row) => (
              <li
                key={row.label}
                className="flex flex-col gap-2 rounded-xl2 bg-surface-white p-4 shadow-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold text-ink-heading">
                    {row.label}
                  </p>
                  <StatusBadge status={row.status} />
                </div>
                <p className="text-sm leading-6 text-ink-body">{row.note}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle>수익 아이디어 (검증 전이에요)</SectionTitle>
          <p className="text-sm leading-6 text-ink-body">
            아래는 검토 중인 아이디어예요. 매출이나 계약이 있는 것이 아니고,
            제휴가 필요한 항목은 아직 협의하지 않았어요.
          </p>
          <ul className="flex flex-col gap-3">
            {REVENUE_IDEAS.map((idea) => (
              <li
                key={idea.title}
                className="flex flex-col gap-2 rounded-xl2 bg-surface-white p-4 shadow-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold text-ink-heading">
                    {idea.title}
                  </p>
                  <StatusBadge status={idea.status} />
                </div>
                <p className="text-sm leading-6 text-ink-body">{idea.note}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle>개인정보는 이렇게 다뤄요</SectionTitle>
          <ul className="flex flex-col gap-2 rounded-xl2 bg-surface-white p-4 shadow-soft">
            {PRIVACY_POINTS.map((point) => (
              <li
                key={point}
                className="text-sm leading-6 text-ink-body"
              >
                {point}
              </li>
            ))}
          </ul>
        </section>
      </article>
    </MobileShell>
  );
}
