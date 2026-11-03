/**
 * 정산 여정 기본 단계·칸 상태 (순수 함수, LLM/네트워크 없음).
 */

export type JourneyRole = "host" | "guest";

export type HostStepKey =
  | "connect"
  | "invite"
  | "record"
  | "adjust"
  | "settle"
  | "pay";

export type GuestStepKey = "share" | "adjust" | "pay" | "done";

export type JourneyStepKey = HostStepKey | GuestStepKey;

export type JourneyStepStatus = "done" | "current" | "todo" | "attention";

export type JourneySettlement = {
  status: "open" | "stale" | "completed" | "superseded";
  transfersTotal: number;
  transfersPaid: number;
};

export type DeriveJourneyInput = {
  role: JourneyRole;
  automation: "connected" | "off" | "unknown";
  memberCount: number;
  expenseCount: number;
  pendingReviewCount: number;
  pendingProposalCount: number;
  settlement: JourneySettlement | null;
};

export type JourneyStep = {
  key: JourneyStepKey;
  label: string;
  status: JourneyStepStatus;
  badge?: string | number;
};

export type DeriveJourneyResult = {
  defaultStep: JourneyStepKey;
  steps: JourneyStep[];
};

export const HOST_STEP_KEYS: HostStepKey[] = [
  "connect",
  "invite",
  "record",
  "adjust",
  "settle",
  "pay",
];

export const HOST_STEP_LABELS: Record<HostStepKey, string> = {
  connect: "연결",
  invite: "초대",
  record: "기록",
  adjust: "분담",
  settle: "정산",
  pay: "송금",
};

export const GUEST_STEP_KEYS: GuestStepKey[] = [
  "share",
  "adjust",
  "pay",
  "done",
];

export const GUEST_STEP_LABELS: Record<GuestStepKey, string> = {
  share: "내 몫",
  adjust: "조정",
  pay: "송금",
  done: "완료",
};

function unpaidTransfers(s: JourneySettlement | null): number {
  if (!s) return 0;
  return Math.max(0, s.transfersTotal - s.transfersPaid);
}

/** 호스트 기본 단계 (위에서부터 먼저 맞는 것). */
export function deriveHostDefaultStep(
  input: Omit<DeriveJourneyInput, "role">
): HostStepKey {
  const { automation, memberCount, expenseCount, pendingReviewCount, pendingProposalCount, settlement } =
    input;

  if (
    settlement?.status === "open" &&
    unpaidTransfers(settlement) > 0
  ) {
    return "pay";
  }
  if (settlement?.status === "completed") {
    return "pay";
  }
  if (settlement?.status === "stale") {
    return "settle";
  }
  if (expenseCount === 0 && automation === "off") {
    return "connect";
  }
  // automation unknown → connect로 강제하지 않음
  if (expenseCount === 0 && memberCount <= 1) {
    return "invite";
  }
  if (expenseCount === 0) {
    return "record";
  }
  if (memberCount <= 1) {
    return "invite";
  }
  if (pendingReviewCount > 0 || pendingProposalCount > 0) {
    return "record";
  }
  return "settle";
}

function hostCompletion(
  key: HostStepKey,
  input: Omit<DeriveJourneyInput, "role">
): { done: boolean; attention: boolean; badge?: string | number } {
  const {
    automation,
    memberCount,
    expenseCount,
    pendingReviewCount,
    pendingProposalCount,
    settlement,
  } = input;

  switch (key) {
    case "connect":
      return {
        done: automation === "connected",
        attention: false,
      };
    case "invite":
      return { done: memberCount >= 2, attention: false };
    case "record": {
      const pending = pendingReviewCount + pendingProposalCount;
      return {
        done: expenseCount >= 1 && pendingReviewCount === 0,
        attention: pending > 0,
        badge: pending > 0 ? pending : undefined,
      };
    }
    case "adjust":
      return { done: false, attention: false };
    case "settle":
      return {
        done: Boolean(settlement) && settlement!.status !== "stale",
        attention: settlement?.status === "stale",
      };
    case "pay": {
      const unpaid = unpaidTransfers(settlement);
      const allPaid =
        Boolean(settlement) &&
        settlement!.transfersTotal > 0 &&
        unpaid === 0;
      return {
        done: allPaid || settlement?.status === "completed",
        attention: settlement?.status === "open" && unpaid > 0,
        badge:
          settlement && settlement.transfersTotal > 0
            ? `${settlement.transfersPaid}/${settlement.transfersTotal}`
            : undefined,
      };
    }
  }
}

function buildHostSteps(
  input: Omit<DeriveJourneyInput, "role">,
  current: HostStepKey
): JourneyStep[] {
  return HOST_STEP_KEYS.map((key) => {
    const { done, attention, badge } = hostCompletion(key, input);
    let status: JourneyStepStatus;
    if (key === current) {
      status = attention ? "attention" : "current";
    } else if (key === "adjust") {
      status = "todo"; // 선택 단계 — 완료 표시 없음
    } else if (attention && key !== current) {
      status = "attention";
    } else if (done) {
      status = "done";
    } else {
      status = "todo";
    }
    const label =
      key === "adjust" ? `${HOST_STEP_LABELS[key]} (선택)` : HOST_STEP_LABELS[key];
    return {
      key,
      label,
      status,
      badge,
    };
  });
}

/** 게스트 기본 단계: 내 송금 완료·정산 completed → done, 그 외 → share. */
export function deriveGuestDefaultStep(
  input: Omit<DeriveJourneyInput, "role">
): GuestStepKey {
  const { settlement } = input;
  if (!settlement) return "share";
  if (settlement.status === "completed") return "done";
  if (
    settlement.transfersTotal > 0 &&
    settlement.transfersPaid >= settlement.transfersTotal
  ) {
    return "done";
  }
  if (settlement.status === "open" && unpaidTransfers(settlement) > 0) {
    return "pay";
  }
  return "share";
}

function buildGuestSteps(
  input: Omit<DeriveJourneyInput, "role">,
  current: GuestStepKey
): JourneyStep[] {
  const unpaid = unpaidTransfers(input.settlement);
  return GUEST_STEP_KEYS.map((key) => {
    let status: JourneyStepStatus = "todo";
    let badge: string | number | undefined;
    const done =
      key === "done"
        ? current === "done"
        : key === "share"
          ? Boolean(input.settlement)
          : key === "pay"
            ? Boolean(input.settlement) && unpaid === 0
            : false;
    const attention =
      key === "pay" &&
      input.settlement?.status === "open" &&
      unpaid > 0;
    if (key === "pay" && unpaid > 0 && input.settlement) {
      badge = unpaid;
    }
    if (key === "adjust" && input.pendingProposalCount > 0) {
      badge = input.pendingProposalCount;
    }
    if (key === current) {
      status = attention ? "attention" : "current";
    } else if (attention) {
      status = "attention";
    } else if (done) {
      status = "done";
    }
    return { key, label: GUEST_STEP_LABELS[key], status, badge };
  });
}

export function deriveJourney(input: DeriveJourneyInput): DeriveJourneyResult {
  if (input.role === "guest") {
    const defaultStep = deriveGuestDefaultStep(input);
    return {
      defaultStep,
      steps: buildGuestSteps(input, defaultStep),
    };
  }

  const defaultStep = deriveHostDefaultStep(input);
  return {
    defaultStep,
    steps: buildHostSteps(input, defaultStep),
  };
}

export function isHostStepKey(value: string): value is HostStepKey {
  return (HOST_STEP_KEYS as string[]).includes(value);
}

export function resolveStepParam(
  raw: string | null,
  defaultStep: JourneyStepKey,
  role: JourneyRole
): JourneyStepKey {
  if (!raw) return defaultStep;
  if (role === "host" && isHostStepKey(raw)) return raw;
  if (role === "guest" && (GUEST_STEP_KEYS as string[]).includes(raw)) {
    return raw as GuestStepKey;
  }
  return defaultStep;
}
