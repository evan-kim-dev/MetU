import { roundHalfUp } from "@/lib/ledger/money";

export type MemberId = string;
export type SplitType = "equal" | "fixed" | "ratio";

export interface SplitInput {
  type: SplitType;
  krwAmount: number;
  participants: MemberId[];
  inputs?: Record<MemberId, number>;
  totalOriginal?: number;
  currency?: string;
}

export interface LedgerExpense {
  id: string;
  paidBy: MemberId;
  krwAmount: number;
  shares: Record<MemberId, number>;
}

export interface Transfer {
  from: MemberId;
  to: MemberId;
  krw: number;
}

function sortedIds(ids: MemberId[]): MemberId[] {
  return [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * 최대잔여법(largest remainder). floors 합과 total 차이를
 * 잔여가 큰 순(동률이면 memberId 사전순)으로 1원씩 배분.
 */
function allocateLargestRemainder(
  total: number,
  weights: Array<{ id: MemberId; weight: number }>
): Record<MemberId, number> {
  const out: Record<MemberId, number> = {};
  if (!weights.length || total <= 0) {
    for (const w of weights) out[w.id] = 0;
    return out;
  }
  const wSum = weights.reduce((s, w) => s + w.weight, 0);
  if (!(wSum > 0)) {
    for (const w of weights) out[w.id] = 0;
    return out;
  }

  const rows = weights.map((w) => {
    const exact = (total * w.weight) / wSum;
    const floor = Math.floor(exact);
    return { id: w.id, floor, rem: exact - floor };
  });

  let used = rows.reduce((s, r) => s + r.floor, 0);
  let left = total - used;
  rows.sort((a, b) => {
    if (b.rem !== a.rem) return b.rem - a.rem;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  for (const r of rows) out[r.id] = r.floor;
  for (let i = 0; i < rows.length && left > 0; i++) {
    out[rows[i]!.id] += 1;
    left -= 1;
  }
  return out;
}

export function computeShares(
  input: SplitInput
): { ok: true; shares: Record<MemberId, number> } | { ok: false; reason: string } {
  const participants = sortedIds(
    [...new Set(input.participants)].filter(Boolean)
  );
  if (!participants.length) return { ok: false, reason: "no-participants" };
  if (!Number.isInteger(input.krwAmount) || input.krwAmount < 0) {
    return { ok: false, reason: "bad-krw" };
  }

  if (input.type === "equal") {
    const n = participants.length;
    const base = Math.floor(input.krwAmount / n);
    let rem = input.krwAmount - base * n;
    const shares: Record<MemberId, number> = {};
    for (const id of participants) {
      shares[id] = base + (rem > 0 ? 1 : 0);
      if (rem > 0) rem -= 1;
    }
    return { ok: true, shares };
  }

  if (input.type === "ratio") {
    const weights: Array<{ id: MemberId; weight: number }> = [];
    for (const id of participants) {
      const w = input.inputs?.[id];
      if (w == null || !(w > 0) || !Number.isFinite(w)) {
        return { ok: false, reason: "bad-ratio" };
      }
      weights.push({ id, weight: w });
    }
    return {
      ok: true,
      shares: allocateLargestRemainder(input.krwAmount, weights),
    };
  }

  // fixed: inputs are original-currency amounts; map proportionally to krw
  if (input.totalOriginal == null || !(input.totalOriginal > 0)) {
    return { ok: false, reason: "bad-total-original" };
  }
  let sumIn = 0;
  const weights: Array<{ id: MemberId; weight: number }> = [];
  for (const id of participants) {
    const v = input.inputs?.[id];
    if (v == null || !Number.isFinite(v) || v < 0) {
      return { ok: false, reason: "bad-fixed" };
    }
    sumIn += v;
    weights.push({ id, weight: v });
  }
  // floating compare with small tolerance then exact via roundHalfUp of sum
  if (roundHalfUp(Math.abs(sumIn - input.totalOriginal) * 1e6) !== 0) {
    // allow exact float equality via epsilon on currency minor units
    if (Math.abs(sumIn - input.totalOriginal) > 1e-6) {
      return { ok: false, reason: "fixed-sum-mismatch" };
    }
  }
  return {
    ok: true,
    shares: allocateLargestRemainder(input.krwAmount, weights),
  };
}

/** 균등 분할. computeShares(equal) 래퍼 — 기존 Step 5 UI 호환. */
export function splitEqual(
  total: number,
  memberIds: MemberId[]
): Record<MemberId, number> {
  const r = computeShares({
    type: "equal",
    krwAmount: total,
    participants: memberIds,
  });
  if (!r.ok) {
    const out: Record<MemberId, number> = {};
    for (const id of memberIds) out[id] = 0;
    return out;
  }
  return r.shares;
}

export function validateShares(
  total: number,
  shares: Record<MemberId, number>
): { ok: boolean; reason?: string } {
  let sum = 0;
  for (const v of Object.values(shares)) {
    if (!Number.isFinite(v) || v < 0 || !Number.isInteger(v)) {
      return { ok: false, reason: "negative-or-non-int" };
    }
    sum += v;
  }
  if (sum !== total) return { ok: false, reason: "sum-mismatch" };
  return { ok: true };
}

/** 양수 = 받을 돈, 음수 = 줄 돈. 합 = 0 */
export function computeBalances(
  memberIds: MemberId[],
  expenses: LedgerExpense[]
): Record<MemberId, number> {
  const bal: Record<MemberId, number> = {};
  for (const id of memberIds) bal[id] = 0;

  for (const exp of expenses) {
    bal[exp.paidBy] = (bal[exp.paidBy] ?? 0) + exp.krwAmount;
    for (const [mid, share] of Object.entries(exp.shares)) {
      bal[mid] = (bal[mid] ?? 0) - share;
    }
  }
  return bal;
}

/**
 * 그리디 최소 송금. 항상 최소는 아님(NP-hard) — 송금 수 <= n-1 만 보장.
 * 정렬을 고정해 결정적 결과를 낸다.
 */
export function minimizeTransfersGreedy(
  balances: Record<MemberId, number>
): Transfer[] {
  const debtors: Array<{ id: MemberId; amt: number }> = [];
  const creditors: Array<{ id: MemberId; amt: number }> = [];
  for (const id of sortedIds(Object.keys(balances))) {
    const v = balances[id] ?? 0;
    if (v < 0) debtors.push({ id, amt: -v });
    else if (v > 0) creditors.push({ id, amt: v });
  }
  debtors.sort((a, b) => b.amt - a.amt || (a.id < b.id ? -1 : 1));
  creditors.sort((a, b) => b.amt - a.amt || (a.id < b.id ? -1 : 1));

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]!;
    const c = creditors[j]!;
    const pay = Math.min(d.amt, c.amt);
    if (pay > 0) {
      transfers.push({ from: d.id, to: c.id, krw: pay });
      d.amt -= pay;
      c.amt -= pay;
    }
    if (d.amt === 0) i += 1;
    if (c.amt === 0) j += 1;
  }
  return transfers;
}

function greedyOnSubset(
  ids: number[],
  amounts: number[],
  names: MemberId[]
): Transfer[] {
  const bal: Record<MemberId, number> = {};
  for (const i of ids) bal[names[i]!] = amounts[i]!;
  return minimizeTransfersGreedy(bal);
}

/**
 * 0이 아닌 인원 <= 12: 비트마스크 DP로 합 0 부분집합을 최대한 쪼갠 뒤
 * 각 부분집합 안에서 그리디. 초과면 그리디만.
 * 최소 송금 건수는 일반적으로 NP-hard — 해커톤 범위에서는 12명 이하 정확해.
 */
export function minimizeTransfers(
  balances: Record<MemberId, number>
): Transfer[] {
  const entries = sortedIds(Object.keys(balances))
    .map((id) => ({ id, v: balances[id] ?? 0 }))
    .filter((e) => e.v !== 0);

  if (!entries.length) return [];
  if (entries.length > 12) return minimizeTransfersGreedy(balances);

  const n = entries.length;
  const amounts = entries.map((e) => e.v);
  const names = entries.map((e) => e.id);
  const full = (1 << n) - 1;

  const sum = new Int32Array(1 << n);
  for (let mask = 1; mask <= full; mask++) {
    let s = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) s += amounts[i]!;
    }
    sum[mask] = s;
  }

  // dp[mask] = max zero-sum subsets covering exactly mask (or -1 impossible)
  const dp = new Int16Array(1 << n);
  dp.fill(-1);
  dp[0] = 0;
  for (let mask = 0; mask <= full; mask++) {
    if (dp[mask]! < 0) continue;
    // find lowest unset bit to force ordering and avoid duplicate enumeration
    let start = 0;
    while (start < n && mask & (1 << start)) start += 1;
    if (start >= n) continue;
    const remain = full ^ mask;
    // enumerate submasks of remain that include `start`
    for (let sub = remain; sub > 0; sub = (sub - 1) & remain) {
      if (!(sub & (1 << start))) continue;
      if (sum[sub] !== 0) continue;
      const next = mask | sub;
      const cand = dp[mask]! + 1;
      if (cand > dp[next]!) dp[next] = cand;
    }
  }

  // reconstruct one optimal partition of `full`
  const subsets: number[] = [];
  if (dp[full]! > 0 && sum[full] === 0) {
    let mask = full;
    while (mask) {
      let start = 0;
      while (start < n && !(mask & (1 << start))) start += 1;
      const remain = mask;
      let found = 0;
      for (let sub = remain; sub > 0; sub = (sub - 1) & remain) {
        if (!(sub & (1 << start))) continue;
        if (sum[sub] !== 0) continue;
        const prev = mask ^ sub;
        if (dp[prev]! >= 0 && dp[prev]! + 1 === dp[mask]!) {
          subsets.push(sub);
          mask = prev;
          found = 1;
          break;
        }
      }
      if (!found) {
        // fallback: treat rest as one group
        subsets.push(mask);
        break;
      }
    }
  } else {
    subsets.push(full);
  }

  const transfers: Transfer[] = [];
  for (const sub of subsets) {
    const ids: number[] = [];
    for (let i = 0; i < n; i++) if (sub & (1 << i)) ids.push(i);
    transfers.push(...greedyOnSubset(ids, amounts, names));
  }

  // deterministic order
  transfers.sort((a, b) => {
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    if (a.to !== b.to) return a.to < b.to ? -1 : 1;
    return a.krw - b.krw;
  });
  return transfers;
}

export async function basisHash(expenses: LedgerExpense[]): Promise<string> {
  const normalized = [...expenses]
    .map((e) => ({
      id: e.id,
      paidBy: e.paidBy,
      krwAmount: e.krwAmount,
      shares: Object.fromEntries(
        sortedIds(Object.keys(e.shares)).map((k) => [k, e.shares[k]!])
      ),
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const payload = JSON.stringify(normalized);
  const data = new TextEncoder().encode(payload);

  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Browser-safe FNV-1a 64-bit (no node:crypto — client bundle safe)
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < data.length; i++) {
    h ^= BigInt(data[i]!);
    h = BigInt.asUintN(64, h * prime);
  }
  return h.toString(16).padStart(16, "0");
}

export function toKrw(amount: number, fxRateToKrw: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(fxRateToKrw)) return 0;
  return roundHalfUp(amount * fxRateToKrw);
}
