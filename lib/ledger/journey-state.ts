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

type JourneyStepStatus = "done" | "current" | "todo" | "attention";

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

type JourneyStep = {
  key: JourneyStepKey;
  label: string;
  status: JourneyStepStatus;
  badge?: string | number;
};

/** 스테퍼에 보이는 묶음 단계(딥링크 step 은 기존 키 유지). */
export type HostPhaseKey = "prep" | "spend" | "close";
export type GuestPhaseKey = "share" | "pay" | "done";
export type JourneyPhaseKey = HostPhaseKey | GuestPhaseKey;

export type JourneyPhaseStep = {
  key: JourneyPhaseKey;
  label: string;
  status: JourneyStepStatus;
  badge?: string | number;
};

export type DeriveJourneyResult = {
  defaultStep: JourneyStepKey;
  /** @deprecated 세부 6/4칸 — 스테퍼는 phaseSteps 를 써요. */
  steps: JourneyStep[];
  /** 스테퍼용 묶음 단계(호스트 3 · 게스트 3). */
  phaseSteps: JourneyPhaseStep[];
};

const HOST_STEP_KEYS: HostStepKey[] = [
  "connect",
  "invite",
  "record",
  "adjust",
  "settle",
  "pay",
];

const HOST_STEP_LABELS: Record<HostStepKey, string> = {
  connect: "연결",
  invite: "초대",
  record: "기록",
  adjust: "분담",
  settle: "정산",
  pay: "송금",
};

const GUEST_STEP_KEYS: GuestStepKey[] = [
  "share",
  "adjust",
  "pay",
  "done",
];

const GUEST_STEP_LABELS: Record<GuestStepKey, string> = {
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

const HOST_PHASE_DEFS: {
  key: HostPhaseKey;
  label: string;
  members: HostStepKey[];
}[] = [
  { key: "prep", label: "준비", members: ["connect", "invite"] },
  { key: "spend", label: "기록", members: ["record", "adjust"] },
  { key: "close", label: "정산", members: ["settle", "pay"] },
];

export function hostPhaseOf(step: HostStepKey): HostPhaseKey {
  if (step === "connect" || step === "invite") return "prep";
  if (step === "record" || step === "adjust") return "spend";
  return "close";
}

export function guestPhaseOf(step: GuestStepKey): GuestPhaseKey {
  if (step === "adjust" || step === "share") return "share";
  if (step === "pay") return "pay";
  return "done";
}

/** 스테퍼에서 묶음 칸을 눌렀을 때 이동할 세부 step. */
export function resolveHostPhaseNav(
  phase: HostPhaseKey,
  input: Omit<DeriveJourneyInput, "role">,
  current: HostStepKey
): HostStepKey {
  if (hostPhaseOf(current) === phase) return current;
  if (phase === "prep") {
    return hostCompletion("invite", input).done ? "invite" : "connect";
  }
  if (phase === "spend") {
    return "record";
  }
  // close
  if (
    input.settlement?.status === "open" &&
    unpaidTransfers(input.settlement) > 0
  ) {
    return "pay";
  }
  if (input.settlement?.status === "completed") return "pay";
  return "settle";
}

export function resolveGuestPhaseNav(
  phase: GuestPhaseKey,
  current: GuestStepKey
): GuestStepKey {
  if (guestPhaseOf(current) === phase) {
    return current === "adjust" ? "share" : current;
  }
  return phase;
}

function buildHostPhaseSteps(
  input: Omit<DeriveJourneyInput, "role">,
  current: HostStepKey
): JourneyPhaseStep[] {
  const currentPhase = hostPhaseOf(current);
  return HOST_PHASE_DEFS.map((phase) => {
    const completions = phase.members.map((k) => hostCompletion(k, input));
    const attention = completions.some((c) => c.attention);
    const badge = completions.find((c) => c.badge != null)?.badge;
    // 준비=초대 완료, 기록=지출 기록 완료, 정산=송금 완료
    const done =
      phase.key === "prep"
        ? hostCompletion("invite", input).done
        : phase.key === "spend"
          ? hostCompletion("record", input).done
          : hostCompletion("pay", input).done;

    let status: JourneyStepStatus;
    if (phase.key === currentPhase) {
      status = attention ? "attention" : "current";
    } else if (attention) {
      status = "attention";
    } else if (done) {
      status = "done";
    } else {
      status = "todo";
    }
    return { key: phase.key, label: phase.label, status, badge };
  });
}

function buildGuestPhaseSteps(
  input: Omit<DeriveJourneyInput, "role">,
  current: GuestStepKey
): JourneyPhaseStep[] {
  const unpaid = unpaidTransfers(input.settlement);
  const currentPhase = guestPhaseOf(current);
  const defs: { key: GuestPhaseKey; label: string }[] = [
    { key: "share", label: "내 몫" },
    { key: "pay", label: "송금" },
    { key: "done", label: "완료" },
  ];
  return defs.map(({ key, label }) => {
    const done =
      key === "done"
        ? current === "done"
        : key === "share"
          ? Boolean(input.settlement)
          : Boolean(input.settlement) && unpaid === 0;
    const attention =
      key === "pay" &&
      input.settlement?.status === "open" &&
      unpaid > 0;
    const badge =
      key === "pay" && unpaid > 0 && input.settlement ? unpaid : undefined;
    let status: JourneyStepStatus;
    if (key === currentPhase) {
      status = attention ? "attention" : "current";
    } else if (attention) {
      status = "attention";
    } else if (done) {
      status = "done";
    } else {
      status = "todo";
    }
    return { key, label, status, badge };
  });
}

export function deriveJourney(input: DeriveJourneyInput): DeriveJourneyResult {
  if (input.role === "guest") {
    const defaultStep = deriveGuestDefaultStep(input);
    return {
      defaultStep,
      steps: buildGuestSteps(input, defaultStep),
      phaseSteps: buildGuestPhaseSteps(input, defaultStep),
    };
  }

  const defaultStep = deriveHostDefaultStep(input);
  return {
    defaultStep,
    steps: buildHostSteps(input, defaultStep),
    phaseSteps: buildHostPhaseSteps(input, defaultStep),
  };
}

export function isHostStepKey(value: string): value is HostStepKey {
  return (HOST_STEP_KEYS as string[]).includes(value);
}

/** adjust·pay 는 호스트 키와 이름이 같아서 역할별로 따로 판정해야 해요. */
export function isGuestStepKey(value: string): value is GuestStepKey {
  return (GUEST_STEP_KEYS as string[]).includes(value);
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

const HOST_PHASE_ORDINAL: Record<HostPhaseKey, string> = {
  prep: "①",
  spend: "②",
  close: "③",
};

const HOST_PHASE_LABEL: Record<HostPhaseKey, string> = {
  prep: "준비",
  spend: "기록",
  close: "정산",
};

const GUEST_PHASE_ORDINAL: Record<GuestPhaseKey, string> = {
  share: "①",
  pay: "②",
  done: "③",
};

/** 자동화 UI 상태 → 여정 입력. */
export function automationToJourneyInput(
  ui: "off" | "unverified" | "ok" | "silent" | null | undefined
): DeriveJourneyInput["automation"] {
  if (ui === "ok" || ui === "silent") return "connected";
  if (ui === "off" || ui === "unverified") return "off";
  return "unknown";
}

/**
 * ResumeCard 한 줄. 예: "② 기록 · 확인할 지출 2건"
 * 스테퍼와 같은 3단계 묶음 기준으로 보여 줘요.
 */
export function formatResumeHeadline(
  role: JourneyRole,
  journey: DeriveJourneyResult
): string {
  const phase =
    journey.phaseSteps.find((s) =>
      role === "host"
        ? s.key === hostPhaseOf(journey.defaultStep as HostStepKey)
        : s.key === guestPhaseOf(journey.defaultStep as GuestStepKey)
    ) ?? journey.phaseSteps[0];
  if (!phase) return "정산 여정";

  const ordinal =
    role === "host"
      ? HOST_PHASE_ORDINAL[phase.key as HostPhaseKey]
      : GUEST_PHASE_ORDINAL[phase.key as GuestPhaseKey];
  const label =
    role === "host"
      ? HOST_PHASE_LABEL[phase.key as HostPhaseKey]
      : phase.label;

  let detail: string | null = null;
  if (phase.badge != null) {
    if (typeof phase.badge === "number") {
      detail =
        phase.key === "spend" || journey.defaultStep === "record"
          ? `확인할 지출 ${phase.badge}건`
          : String(phase.badge);
    } else {
      detail = String(phase.badge);
    }
  } else if (phase.status === "attention") {
    detail = "확인이 필요해요";
  }

  return detail
    ? `${ordinal} ${label} · ${detail}`
    : `${ordinal} ${label}`;
}
