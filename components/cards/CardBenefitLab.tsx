"use client";

import { useMemo, useState } from "react";
import { CreditCard, FlaskConical, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ds";
import { normalizeCodefCard } from "@/lib/cards/benefits";
import { toCardList } from "@/lib/cards/codef-schema";
import { DEMO_CODEF_DATA } from "@/lib/cards/mock";
import { planCardSpend } from "@/lib/cards/plan";
import {
  SPEND_CATEGORIES,
  SPEND_CATEGORY_LABEL,
  type BenefitScope,
  type CardSnapshot,
  type ParsedBenefit,
  type SpendBudget,
} from "@/lib/cards/types";
import { cn } from "@/lib/design/tokens";
import { formatKRW } from "@/lib/shared/format";

/** VERIFY: CODEF 카드사 기관코드 — 정식 연동 전 CODEF 기관코드표로 재확인 */
const ORGANIZATIONS = [
  { code: "0301", label: "KB국민카드" },
  { code: "0302", label: "현대카드" },
  { code: "0303", label: "삼성카드" },
  { code: "0304", label: "NH농협카드" },
  { code: "0305", label: "BC카드" },
  { code: "0306", label: "신한카드" },
  { code: "0307", label: "씨티카드" },
  { code: "0309", label: "우리카드" },
  { code: "0311", label: "롯데카드" },
  { code: "0313", label: "하나카드" },
];

const DEFAULT_BUDGET: Required<SpendBudget> = {
  flight: 350_000,
  lodging: 300_000,
  food: 200_000,
  transport: 60_000,
  shopping: 90_000,
};

const SCOPE_LABEL: Record<BenefitScope, string> = {
  ...SPEND_CATEGORY_LABEL,
  overseas: "해외결제",
};

function demoCards(): CardSnapshot[] {
  return toCardList(DEMO_CODEF_DATA).map((c, i) => normalizeCodefCard(c, i));
}

function benefitAmountText(b: ParsedBenefit): string {
  const parts: string[] = [];
  if (b.rate != null) parts.push(`${+(b.rate * 100).toFixed(2)}% ${b.kind === "reward" ? "적립" : "할인"}`);
  if (b.flatKrw != null) parts.push(`건당 ${formatKRW(b.flatKrw)}`);
  parts.push(b.monthlyCapKrw != null ? `월 한도 ${formatKRW(b.monthlyCapKrw)}` : "한도 미상");
  return parts.join(" · ");
}

function PerformanceBar({ card }: { card: CardSnapshot }) {
  const { currentKrw, standardKrw, requiredKrw, met } = card.performance;
  if (standardKrw == null || currentKrw == null) {
    return <p className="text-mu-caption text-mu-fg-3">실적 정보가 없어요</p>;
  }
  const pct = Math.min(100, Math.round((currentKrw / Math.max(1, standardKrw)) * 100));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-mu-caption">
        <span className="text-mu-fg-2">
          이번 달 실적 <b className="mu-num text-mu-fg">{formatKRW(currentKrw)}</b> / {formatKRW(standardKrw)}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-bold",
            met ? "bg-mu-ok-soft text-mu-ok" : "bg-mu-warn-soft text-mu-warn"
          )}
        >
          {met ? "충족" : `${formatKRW(requiredKrw ?? 0)} 부족`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-mu-sunken" aria-hidden>
        <div
          className={cn("h-full rounded-full", met ? "bg-mu-ok" : "bg-mu-warn")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CardItem({ card }: { card: CardSnapshot }) {
  return (
    <li className="flex flex-col gap-3 rounded-mu-xl border border-mu-line bg-mu-card p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-mu-md bg-mu-accent-soft text-mu-accent">
          <CreditCard className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-mu-body font-bold text-mu-fg">{card.name}</p>
          <p className="text-mu-caption text-mu-fg-3">
            {card.company ?? "카드사 미상"} · ****{card.last4 ?? "----"}
          </p>
        </div>
      </div>
      <PerformanceBar card={card} />
      <ul className="flex flex-col gap-2">
        {card.benefits.map((b, i) => (
          <li key={i} className="rounded-mu-md bg-mu-sunken px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-mu-label text-mu-fg">{b.name}</p>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-mu-caption font-bold",
                  b.status === "parsed" ? "bg-mu-accent-soft text-mu-accent" : "bg-mu-warn-soft text-mu-warn"
                )}
              >
                {b.status === "parsed" ? "해석 완료" : "확인 필요"}
              </span>
            </div>
            <p className="mt-1 text-mu-caption text-mu-fg-2">{benefitAmountText(b)}</p>
            {b.scopes.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {b.scopes.map((s) => (
                  <span key={s} className="rounded-full border border-mu-line px-2 py-0.5 text-mu-caption text-mu-fg-2">
                    {SCOPE_LABEL[s]}
                  </span>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </li>
  );
}

export function CardBenefitLab() {
  const [source, setSource] = useState<"demo" | "codef">("demo");
  const [cards, setCards] = useState<CardSnapshot[]>(demoCards);
  const [budget, setBudget] = useState<Required<SpendBudget>>(DEFAULT_BUDGET);
  const [org, setOrg] = useState("0309");
  const [connectedId, setConnectedId] = useState("");
  const [month, setMonth] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectMsg, setConnectMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function connectAccount() {
    setConnecting(true);
    setConnectMsg(null);
    try {
      const res = await fetch("/api/cards/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization: org, loginId: loginId.trim(), password }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        connectedId?: string;
        error?: string;
        code?: string;
        message?: string;
      };
      if (!res.ok || !json.connectedId) {
        setConnectMsg({
          ok: false,
          text:
            json.error === "unauthorized"
              ? "로그인한 뒤에 연결할 수 있어요."
              : json.error === "codef-not-configured"
                ? "서버에 CODEF 키가 없어요 (.env.local 의 CODEF_CLIENT_ID·SECRET)."
                : json.error === "codef-public-key-missing"
                  ? "서버에 CODEF 공개키가 없어요 (.env.local 의 CODEF_PUBLIC_KEY)."
                  : `${json.message ?? "연결에 실패했어요"}${json.code ? ` (${json.code})` : ""}`,
        });
        return;
      }
      setConnectedId(json.connectedId);
      setConnectMsg({
        ok: true,
        text: "연결됐어요. connectedId 를 아래 칸에 넣었어요. 저장되지 않으니 필요하면 따로 적어 두세요.",
      });
    } finally {
      // 성공·실패와 상관없이 비밀번호는 화면 상태에서 바로 지워요.
      setPassword("");
      setConnecting(false);
    }
  }

  const plan = useMemo(() => planCardSpend(cards, budget), [cards, budget]);
  const total = SPEND_CATEGORIES.reduce((s, c) => s + budget[c], 0);
  const cardName = (id: string | null) => cards.find((c) => c.id === id)?.name ?? "—";

  async function fetchCodef() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/cards/benefits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization: org,
          connectedId: connectedId.trim(),
          ...(month.trim() ? { startDate: month.trim() } : {}),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        cards?: CardSnapshot[];
        error?: string;
        message?: string;
      };
      if (!res.ok || !json.cards) {
        setError(
          json.error === "codef-not-configured"
            ? "서버에 CODEF 키가 없어요. 예시 데이터로 시험해 주세요."
            : json.error === "unauthorized"
              ? "로그인한 뒤에 조회할 수 있어요."
              : json.message ?? `조회에 실패했어요 (${json.error ?? res.status})`
        );
        return;
      }
      setCards(json.cards);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mu-root flex min-h-0 flex-1 flex-col overflow-y-auto pb-10">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-mu-line bg-mu-card px-4">
        <FlaskConical className="h-5 w-5 text-mu-accent" strokeWidth={1.75} aria-hidden />
        <h1 className="text-mu-heading text-mu-fg">카드 혜택 계획 · 테스트</h1>
      </header>

      <div className="flex flex-col gap-6 px-4 pt-4">
        <p className="rounded-mu-md bg-mu-warn-soft px-3 py-2 text-mu-caption text-mu-warn">
          임시 테스트 화면이에요. 예시 데이터는 가상의 카드예요. CODEF 조회는 로그인과 서버 키가 필요해요.
        </p>

        {/* 1. 데이터 */}
        <section className="flex flex-col gap-3" aria-labelledby="lab-source">
          <h2 id="lab-source" className="text-mu-heading text-mu-fg">1. 카드 데이터</h2>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="데이터 출처">
            {(["demo", "codef"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={source === s}
                onClick={() => {
                  setSource(s);
                  setError(null);
                  if (s === "demo") setCards(demoCards());
                }}
                className={cn(
                  "mu-focus min-h-tap rounded-mu-md border px-3 text-mu-label font-bold",
                  source === s ? "border-mu-accent bg-mu-accent-soft text-mu-accent" : "border-mu-line bg-mu-card text-mu-fg-2"
                )}
              >
                {s === "demo" ? "예시 데이터" : "CODEF 실제 조회"}
              </button>
            ))}
          </div>

          {source === "codef" ? (
            <div className="flex flex-col gap-2 rounded-mu-xl border border-mu-line bg-mu-card p-4">
              <label className="flex flex-col gap-1 text-mu-label text-mu-fg-2">
                카드사
                <select
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                  className="mu-focus min-h-tap rounded-mu-md border border-mu-line bg-mu-card px-3 text-mu-body text-mu-fg"
                >
                  {ORGANIZATIONS.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label} ({o.code})
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-col gap-2 rounded-mu-md bg-mu-sunken p-3">
                <p className="text-mu-label font-bold text-mu-fg">카드사 계정 연결 (처음 한 번)</p>
                <p className="text-mu-caption text-mu-fg-3">
                  카드사 홈페이지 아이디·비밀번호를 직접 입력해요. 비밀번호는 서버에서 CODEF 공개키로 바로 암호화해 보내고, 저장하거나 기록하지 않아요.
                </p>
                <input
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="카드사 아이디"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-label="카드사 아이디"
                  className="mu-focus min-h-tap rounded-mu-md border border-mu-line bg-mu-card px-3 text-mu-body text-mu-fg"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="카드사 비밀번호"
                  autoComplete="new-password"
                  aria-label="카드사 비밀번호"
                  className="mu-focus min-h-tap rounded-mu-md border border-mu-line bg-mu-card px-3 text-mu-body text-mu-fg"
                />
                <Button
                  variant="secondary"
                  onClick={connectAccount}
                  loading={connecting}
                  disabled={!loginId.trim() || !password}
                >
                  connectedId 만들기
                </Button>
                {connectMsg ? (
                  <p
                    role={connectMsg.ok ? "status" : "alert"}
                    className={cn("text-mu-caption", connectMsg.ok ? "text-mu-ok" : "text-mu-err")}
                  >
                    {connectMsg.text}
                  </p>
                ) : null}
              </div>

              <label className="flex flex-col gap-1 text-mu-label text-mu-fg-2">
                connectedId
                <input
                  value={connectedId}
                  onChange={(e) => setConnectedId(e.target.value)}
                  placeholder="CODEF 계정등록으로 받은 값"
                  className="mu-focus min-h-tap rounded-mu-md border border-mu-line bg-mu-card px-3 text-mu-body text-mu-fg"
                />
              </label>
              <label className="flex flex-col gap-1 text-mu-label text-mu-fg-2">
                조회 월 (선택, YYYYMM)
                <input
                  value={month}
                  onChange={(e) => setMonth(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                  inputMode="numeric"
                  placeholder="비우면 이번 달"
                  className="mu-focus min-h-tap rounded-mu-md border border-mu-line bg-mu-card px-3 text-mu-body text-mu-fg"
                />
              </label>
              <p className="text-mu-caption text-mu-fg-3">
                이미 받은 connectedId 가 있으면 위 연결 없이 바로 넣어도 돼요.
              </p>
              <Button onClick={fetchCodef} loading={busy} disabled={!connectedId.trim()}>
                <RefreshCw className="h-4 w-4" aria-hidden />
                실적·혜택 조회
              </Button>
              {error ? (
                <p role="alert" className="text-mu-caption text-mu-err">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}

          <ul className="flex flex-col gap-3">
            {cards.map((c) => (
              <CardItem key={c.id} card={c} />
            ))}
          </ul>
        </section>

        {/* 2. 예산 */}
        <section className="flex flex-col gap-3" aria-labelledby="lab-budget">
          <div className="flex items-baseline justify-between">
            <h2 id="lab-budget" className="text-mu-heading text-mu-fg">2. 여행 예산</h2>
            <span className="mu-num text-mu-label text-mu-fg-2">합계 {formatKRW(total)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SPEND_CATEGORIES.map((c) => (
              <label key={c} className="flex flex-col gap-1 rounded-mu-md border border-mu-line bg-mu-card px-3 py-2">
                <span className="text-mu-caption text-mu-fg-3">{SPEND_CATEGORY_LABEL[c]}</span>
                <input
                  value={budget[c].toLocaleString("ko-KR")}
                  inputMode="numeric"
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(/[^0-9]/g, "")) || 0;
                    setBudget((b) => ({ ...b, [c]: Math.min(n, 100_000_000) }));
                  }}
                  className="mu-num w-full bg-transparent text-mu-body font-bold text-mu-fg outline-none"
                  aria-label={`${SPEND_CATEGORY_LABEL[c]} 예산(원)`}
                />
              </label>
            ))}
          </div>
        </section>

        {/* 3. 결과 */}
        <section className="flex flex-col gap-3" aria-labelledby="lab-result">
          <h2 id="lab-result" className="text-mu-heading text-mu-fg">3. 카드별 결제 계획</h2>
          <div className="rounded-mu-xl border border-mu-line bg-mu-card p-4">
            <p className="flex items-center gap-1.5 text-mu-label text-mu-fg-3">
              <Sparkles className="h-4 w-4 text-mu-accent" aria-hidden />
              예상 할인
            </p>
            <p className="mu-num mt-1 text-mu-amount-xl text-mu-accent">
              {formatKRW(plan.confirmedDiscountKrw)}
            </p>
            {plan.conditionalDiscountKrw > 0 ? (
              <p className="mt-1 text-mu-caption text-mu-fg-2">
                + 실적을 채우면 {formatKRW(plan.conditionalDiscountKrw)} 더 (조건부)
              </p>
            ) : null}
          </div>

          <ul className="flex flex-col divide-y divide-mu-line rounded-mu-xl border border-mu-line bg-mu-card">
            {plan.categories.map((p) => (
              <li key={p.category} className="flex flex-col gap-0.5 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-mu-label font-bold text-mu-fg">
                    {SPEND_CATEGORY_LABEL[p.category]}
                    <span className="mu-num ml-1.5 font-medium text-mu-fg-3">{formatKRW(p.budgetKrw)}</span>
                  </span>
                  <span
                    className={cn(
                      "mu-num text-mu-label font-bold",
                      p.discountKrw > 0 ? (p.conditional ? "text-mu-warn" : "text-mu-ok") : "text-mu-fg-3"
                    )}
                  >
                    {p.discountKrw > 0 ? `−${formatKRW(p.discountKrw)}` : "0원"}
                  </span>
                </div>
                <p className="text-mu-caption text-mu-fg-2">
                  {p.cardId ? (
                    <>
                      <b className="text-mu-fg">{cardName(p.cardId)}</b> · {p.benefitName}
                      {p.conditional ? " · 실적 충족 시" : ""}
                    </>
                  ) : (
                    "아무 카드나 괜찮아요"
                  )}
                </p>
                <p className="text-mu-caption text-mu-fg-3">{p.note}</p>
              </li>
            ))}
          </ul>

          <ul className="flex flex-col gap-2">
            {plan.cards
              .filter((s) => s.shortfallKrw > 0)
              .map((s) => (
                <li key={s.cardId} className="rounded-mu-md bg-mu-accent-soft px-3 py-2 text-mu-caption text-mu-fg">
                  <b>{cardName(s.cardId)}</b>: 실적 {formatKRW(s.shortfallKrw)} 부족 —{" "}
                  {s.fillsShortfall
                    ? `이번 여행 결제 ${formatKRW(s.assignedSpendKrw)}로 채울 수 있어요`
                    : `이번 여행 결제 ${formatKRW(s.assignedSpendKrw)}로는 부족해요`}
                </li>
              ))}
          </ul>
          <p className="text-mu-caption text-mu-fg-3">
            할인은 혜택 문구를 규칙으로 읽어 계산한 추정치예요. 정액 혜택은 1회 기준, 해외결제 혜택은 현지 결제(식비·교통·쇼핑)에만 적용했어요. 실제 청구 금액은 카드사 약관을 따라요.
          </p>
        </section>
      </div>
    </div>
  );
}
