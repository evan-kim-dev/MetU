import { formatKRW } from "@/lib/shared/format";

/**
 * 정산 설명. 순수 함수만 둔다(LLM 없음, 템플릿 문구).
 * 입력으로 받은 정수 KRW 를 더하고 빼서 "낸 돈 − 쓴 몫 = 잔액" 을 풀어 보여줄 뿐,
 * 저장된 정산/지출 금액을 바꾸거나 다시 계산해서 덮어쓰지 않는다.
 */

export interface ExplainMember {
  id: string;
  name: string;
}

export interface ExplainExpense {
  id: string;
  /** 화면에 보여줄 이름(가게/메모). 없으면 "이름 없는 지출" */
  label: string;
  paidBy: string;
  krwAmount: number;
  shares: Readonly<Record<string, number>>;
}

interface ExplainTransfer {
  from: string;
  to: string;
  krw: number;
}

export interface ExplainInput {
  members: readonly ExplainMember[];
  expenses: readonly ExplainExpense[];
  /** 저장된 정산의 송금 목록. 비어 있어도 잔액 설명은 만든다. */
  transfers: readonly ExplainTransfer[];
}

interface MemberExpenseLine {
  expenseId: string;
  label: string;
  /** 이 지출을 이 멤버가 낸 금액(결제자일 때만 krwAmount) */
  paid: number;
  /** 이 지출에서 이 멤버의 몫 */
  owed: number;
  /** paid − owed */
  net: number;
}

export interface MemberRow {
  memberId: string;
  name: string;
  /** 낸 돈 합계 */
  paid: number;
  /** 쓴 몫 합계 */
  owed: number;
  /** paid − owed. 양수 = 받을 돈, 음수 = 보낼 돈 */
  balance: number;
  /** 낸 돈/몫이 있는 지출만, 입력 순서대로 */
  lines: MemberExpenseLine[];
  /** 예: "낸 돈 ₩30,000 − 쓴 몫 ₩10,000 = +₩20,000 (받을 돈)" */
  summary: string;
}

interface TransferNote {
  from: string;
  to: string;
  krw: number;
  text: string;
}

export interface Reduction {
  /** 두 사람씩 서로 주고받을 돈을 합쳤을 때 필요한 송금 수 */
  pairwiseCount: number;
  /** 저장된 정산의 송금 수 */
  minimizedCount: number;
}

export type ExplainFailReason =
  | "unknown-member"
  | "non-integer-or-negative"
  | "share-mismatch"
  | "balances-not-zero"
  | "transfer-mismatch";

export type ExplainResult =
  | {
      ok: true;
      memberRows: MemberRow[];
      transferNotes: TransferNote[];
      reduction: Reduction;
      /** 송금 수가 왜 그렇게 되는지 한 줄 */
      reductionNote: string;
      /** 송금 합계 = 받을 돈 합계 */
      totalKrw: number;
    }
  | { ok: false; reason: ExplainFailReason };

export function explainReasonMessage(reason: ExplainFailReason): string {
  switch (reason) {
    case "unknown-member":
      return "멤버 정보를 찾지 못했어요. 새로고침한 뒤 다시 시도해 주세요.";
    case "transfer-mismatch":
      return "정산표와 지출 합계가 맞지 않아요. 정산을 다시 계산해 주세요.";
    default:
      return "지출 금액이 맞지 않아 설명을 만들 수 없어요. 지출 내역을 확인해 주세요.";
  }
}

function signedKrw(v: number): string {
  if (v > 0) return `+${formatKRW(v)}`;
  if (v < 0) return `-${formatKRW(-v)}`;
  return formatKRW(0);
}

function balanceWord(v: number): string {
  if (v > 0) return "받을 돈";
  if (v < 0) return "보낼 돈";
  return "정산 없음";
}

function isNonNegInt(v: number): boolean {
  return Number.isInteger(v) && v >= 0;
}

/**
 * 두 사람 사이에서 서로 줄 돈을 합친 뒤 남는 쌍의 수.
 * 지출마다 "몫을 가진 사람 → 결제자" 로 갚을 돈이 생긴다고 보고, 쌍별로 순액을 낸다.
 */
function pairwiseCount(expenses: readonly ExplainExpense[]): number {
  const net = new Map<string, number>();
  for (const e of expenses) {
    for (const [mid, share] of Object.entries(e.shares)) {
      if (mid === e.paidBy || share === 0) continue;
      // mid 가 paidBy 에게 share 만큼 갚아야 한다. 키는 사전순 (작은 id, 큰 id).
      const mFirst = mid < e.paidBy;
      const key = mFirst ? `${mid}\u0000${e.paidBy}` : `${e.paidBy}\u0000${mid}`;
      // 값 > 0: 앞 id 가 뒤 id 에게 줄 돈
      net.set(key, (net.get(key) ?? 0) + (mFirst ? share : -share));
    }
  }
  let count = 0;
  for (const v of net.values()) if (v !== 0) count += 1;
  return count;
}

export function explainSettlement(input: ExplainInput): ExplainResult {
  const nameOf = new Map(input.members.map((m) => [m.id, m.name]));

  // 1) 검증: 멤버/정수/지출별 몫 합 = krwAmount
  for (const e of input.expenses) {
    if (!isNonNegInt(e.krwAmount)) {
      return { ok: false, reason: "non-integer-or-negative" };
    }
    if (!nameOf.has(e.paidBy)) return { ok: false, reason: "unknown-member" };
    let sum = 0;
    for (const [mid, share] of Object.entries(e.shares)) {
      if (!nameOf.has(mid)) return { ok: false, reason: "unknown-member" };
      if (!isNonNegInt(share)) {
        return { ok: false, reason: "non-integer-or-negative" };
      }
      sum += share;
    }
    if (sum !== e.krwAmount) return { ok: false, reason: "share-mismatch" };
  }
  for (const t of input.transfers) {
    if (!nameOf.has(t.from) || !nameOf.has(t.to)) {
      return { ok: false, reason: "unknown-member" };
    }
    if (!Number.isInteger(t.krw) || t.krw <= 0 || t.from === t.to) {
      return { ok: false, reason: "non-integer-or-negative" };
    }
  }

  // 2) 멤버별 행
  const memberRows: MemberRow[] = input.members.map((m) => {
    const lines: MemberExpenseLine[] = [];
    let paid = 0;
    let owed = 0;
    for (const e of input.expenses) {
      const p = e.paidBy === m.id ? e.krwAmount : 0;
      const o = e.shares[m.id] ?? 0;
      paid += p;
      owed += o;
      if (p !== 0 || o !== 0) {
        lines.push({
          expenseId: e.id,
          label: e.label.trim() || "이름 없는 지출",
          paid: p,
          owed: o,
          net: p - o,
        });
      }
    }
    const balance = paid - owed;
    return {
      memberId: m.id,
      name: m.name,
      paid,
      owed,
      balance,
      lines,
      summary: `낸 돈 ${formatKRW(paid)} − 쓴 몫 ${formatKRW(owed)} = ${signedKrw(balance)} (${balanceWord(balance)})`,
    };
  });

  // 3) 불변식: 잔액 합 0, 송금 합 = 받을 돈 합
  const balanceSum = memberRows.reduce((s, r) => s + r.balance, 0);
  if (balanceSum !== 0) return { ok: false, reason: "balances-not-zero" };
  const positive = memberRows.reduce(
    (s, r) => s + (r.balance > 0 ? r.balance : 0),
    0
  );
  const transferSum = input.transfers.reduce((s, t) => s + t.krw, 0);
  if (input.transfers.length > 0 && transferSum !== positive) {
    return { ok: false, reason: "transfer-mismatch" };
  }

  // 4) 송금 설명(템플릿). 송금을 순서대로 적용하며 남은 금액을 따라간다.
  const remaining = new Map(memberRows.map((r) => [r.memberId, r.balance]));
  const transferNotes: TransferNote[] = input.transfers.map((t) => {
    const from = nameOf.get(t.from) ?? "?";
    const to = nameOf.get(t.to) ?? "?";
    const fromBal = remaining.get(t.from) ?? 0;
    const toBal = remaining.get(t.to) ?? 0;
    const fromLeft = fromBal + t.krw;
    const toLeft = toBal - t.krw;
    remaining.set(t.from, fromLeft);
    remaining.set(t.to, toLeft);

    const head = `${from}님이 ${to}님에게 ${formatKRW(t.krw)} 보내요.`;
    const facts =
      fromBal < 0 && toBal > 0
        ? ` ${from}님은 ${formatKRW(-fromBal)} 보낼 돈이 있고, ${to}님은 ${formatKRW(toBal)} 받을 돈이 있어요.`
        : "";
    const tail =
      fromLeft === 0 && toLeft === 0
        ? ` 이 송금으로 두 분 모두 정산이 끝나요.`
        : fromLeft === 0
          ? ` 이 송금으로 ${from}님은 정산이 끝나요.`
          : toLeft === 0
            ? ` 이 송금으로 ${to}님은 정산이 끝나요.`
            : ` 남은 금액은 다른 송금으로 맞춰요.`;
    return { from: t.from, to: t.to, krw: t.krw, text: `${head}${facts}${tail}` };
  });

  const reduction: Reduction = {
    pairwiseCount: pairwiseCount(input.expenses),
    minimizedCount: input.transfers.length,
  };

  return {
    ok: true,
    memberRows,
    transferNotes,
    reduction,
    reductionNote: reductionNote(reduction),
    totalKrw: input.transfers.length > 0 ? transferSum : positive,
  };
}

export function reductionNote(r: Reduction): string {
  if (r.minimizedCount === 0) return "서로 보낼 돈이 없어요.";
  if (r.pairwiseCount > r.minimizedCount) {
    return `둘씩 따로 주고받으면 ${r.pairwiseCount}번 보내야 하지만, 서로 주고받을 돈을 합쳐서 ${r.minimizedCount}번으로 줄였어요.`;
  }
  return `송금은 ${r.minimizedCount}번이에요. 더 줄일 수 있는 송금은 없어요.`;
}
