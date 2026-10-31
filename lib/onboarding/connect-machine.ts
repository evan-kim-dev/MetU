import type { DetectedPlatform } from "@/lib/onboarding/automation";

export type ConnectPhase =
  | "hub"
  | "device"
  | "code"
  | "shortcut"
  | "automation"
  | "verify"
  | "done"
  | "skipped"
  | "unsupported";

export type ConnectIssueMode = "wizard" | "add" | "reissue";

export type ConnectBusy =
  | null
  | "issue"
  | "server-test"
  | "finish"
  | "skip";

export type ConnectErrorState = {
  code: string;
  message: string;
  retryable: boolean;
  retryAfterSec?: number;
  action?: string;
  operatorHint?: string;
};

export type ConnectToken = {
  plain?: string;
  hint?: string;
  issuedAt?: string;
  copied: boolean;
};

export type ConnectState = {
  phase: ConnectPhase;
  platform: DetectedPlatform;
  ios27: boolean | null;
  selectedApps: string[];
  token: ConnectToken;
  /** MetU 서버 자체 테스트 통과. 폰 연결과는 무관해서 "연결됨" 표시에 쓰지 않아요. */
  serverOk: boolean;
  /** 연결 확인 단계에 들어간 뒤 도착한 알림(연결 테스트 MTU-TEST 또는 실제 알림)이 있어요. */
  deviceOk: boolean;
  /** 연결 확인 단계에 들어간 뒤 실제 카드 알림(MTU-TEST 아님, sim 아님)이 도착했어요. */
  realOk: boolean;
  /**
   * 연결 확인 단계에 들어온 시각(ISO, 서버 시계 기준 보정). 이보다 이전 기록은
   * 성공으로 치지 않아요. 예전에 연결에 성공한 계정도 항상 "기다리는 중"에서 시작해요.
   */
  verifyStartedAt?: string;
  firstEventAt?: string;
  shortcutOpened: boolean;
  reissueOpen: boolean;
  busy: ConnectBusy;
  error?: ConnectErrorState;
  needsToken: boolean;
  finishStatus?: "done" | "partial";
  /** How the user entered the code step (hub add/reissue vs first-time wizard). */
  issueMode: ConnectIssueMode;
};

export type ConnectSnapshot = {
  phase: ConnectPhase;
  platform: DetectedPlatform;
  ios27: boolean | null;
  selectedApps: string[];
  serverOk: boolean;
  deviceOk: boolean;
  realOk?: boolean;
  verifyStartedAt?: string;
};

export type ConnectAction =
  | { type: "PLATFORM_DETECTED"; platform: DetectedPlatform }
  | { type: "SET_IOS27"; value: boolean }
  | { type: "ISSUE_START" }
  | {
      type: "ISSUE_OK";
      token: string;
      hint?: string;
      issuedAt?: string;
    }
  | { type: "ISSUE_FAIL"; error: ConnectErrorState }
  | { type: "COPY_RESULT"; ok: boolean }
  | { type: "OPEN_SHORTCUT" }
  | { type: "CONFIRM_ADDED" }
  | { type: "CONFIRM_AUTOMATION"; at?: string }
  | { type: "SERVER_TEST_START" }
  | { type: "SERVER_TEST_OK"; duplicate?: boolean }
  | { type: "SERVER_TEST_FAIL"; error: ConnectErrorState }
  | {
      type: "EVENT_RECEIVED";
      kind: "device-test" | "real";
      /** 이벤트 도착 시각(ISO, 서버 created_at). verifyStartedAt 이후여야 인정돼요. */
      at: string;
      /** "sim"(서버 테스트)은 무시해요. */
      source?: string;
    }
  | { type: "FINISH_START" }
  | { type: "FINISH_OK"; status: "done" | "partial" }
  | { type: "FINISH_FAIL"; error: ConnectErrorState }
  | { type: "SKIP_START" }
  | { type: "SKIP_OK" }
  | { type: "SKIP_FAIL"; error: ConnectErrorState }
  | { type: "REISSUE_REQUEST" }
  | { type: "REISSUE_CANCEL" }
  | { type: "RESTORE"; snapshot: ConnectSnapshot }
  | { type: "DISMISS_ERROR" }
  | { type: "SET_SELECTED_APPS"; apps: string[] }
  | { type: "BACK_TO_DEVICE" }
  | { type: "CODE_NEXT" }
  | {
      type: "ENTER_HUB";
      platform: DetectedPlatform;
      ios27?: boolean | null;
    }
  | { type: "START_ADD_DEVICE" }
  | { type: "START_REISSUE" }
  | { type: "RESUME_VERIFY"; at?: string }
  | { type: "GO_TO_STEP"; phase: ConnectStepPhase }
  | { type: "BACK_TO_HUB" };

/** 단계 카드로 되돌아갈 수 있는 단계. */
export type ConnectStepPhase =
  | "device"
  | "code"
  | "shortcut"
  | "automation"
  | "verify";

const IOS_STEP_ORDER: ConnectStepPhase[] = [
  "device",
  "code",
  "shortcut",
  "automation",
  "verify",
];
const ANDROID_STEP_ORDER: ConnectStepPhase[] = [
  "device",
  "code",
  "automation",
  "verify",
];

function stepOrder(platform: DetectedPlatform): ConnectStepPhase[] {
  return platform === "android" ? ANDROID_STEP_ORDER : IOS_STEP_ORDER;
}

export function initialConnectState(): ConnectState {
  return {
    phase: "device",
    platform: "other",
    ios27: null,
    selectedApps: [],
    token: { copied: false },
    serverOk: false,
    deviceOk: false,
    realOk: false,
    shortcutOpened: false,
    reissueOpen: false,
    busy: null,
    needsToken: false,
    issueMode: "wizard",
  };
}

export function showConnectStepper(state: ConnectState): boolean {
  return (
    state.phase !== "hub" &&
    state.phase !== "unsupported" &&
    state.phase !== "done" &&
    state.phase !== "skipped"
  );
}

/** 확인 단계 진입 뒤 연결 테스트 또는 실제 알림을 받았을 때만 "완료"(done)예요. */
export function canFinish(state: ConnectState): boolean {
  return state.phase === "verify" && state.deviceOk;
}

/** 아직 받지 못했다면 "일단 완료"(partial)로 마칠 수 있어요. 홈 배너가 계속 알려 줘요. */
export function canFinishAnyway(state: ConnectState): boolean {
  return state.phase === "verify" && !state.deviceOk;
}

function isAfter(atIso: string, baseIso: string | undefined): boolean {
  if (!baseIso) return false;
  const at = Date.parse(atIso);
  const base = Date.parse(baseIso);
  if (!Number.isFinite(at) || !Number.isFinite(base)) return false;
  return at > base;
}

export type VerifyArrival = { kind: "device-test" | "real"; at: string };

/**
 * 상태 응답에서 확인 단계 진입 이후 도착한 알림을 고른다.
 * 서버가 sim/테스트를 이미 걸러 준 lastRealEventAt 과 lastDeviceTestAt 만 쓰고,
 * 진입 이전 타임스탬프는 무시한다. 실제 알림이 있으면 그쪽이 우선.
 */
export function pickVerifyArrival(
  verifyStartedAt: string | undefined,
  data: {
    lastRealEventAt?: string | null;
    lastDeviceTestAt?: string | null;
  }
): VerifyArrival | null {
  if (data.lastRealEventAt && isAfter(data.lastRealEventAt, verifyStartedAt)) {
    return { kind: "real", at: data.lastRealEventAt };
  }
  if (
    data.lastDeviceTestAt &&
    isAfter(data.lastDeviceTestAt, verifyStartedAt)
  ) {
    return { kind: "device-test", at: data.lastDeviceTestAt };
  }
  return null;
}

export type ConnectStepStatus = "done" | "current" | "upcoming";

export type ConnectStepCard = {
  phase: ConnectStepPhase;
  label: string;
  status: ConnectStepStatus;
};

/** 단계 카드 목록(기기 확인 · 연결 코드 · 단축어/매크로 · 자동화 · 연결 확인). */
export function connectStepCards(state: ConnectState): ConnectStepCard[] {
  const order = stepOrder(state.platform);
  const labels =
    state.platform === "android" ? STEP_LABELS_ANDROID : STEP_LABELS_IOS;
  const finished = state.phase === "done" || state.phase === "skipped";
  const currentIdx = finished
    ? order.length
    : order.indexOf(state.phase as ConnectStepPhase);
  return order.map((phase, i) => ({
    phase,
    label: labels[i] ?? "",
    status: finished || i < currentIdx
      ? "done"
      : i === currentIdx
        ? "current"
        : "upcoming",
  }));
}

export function stepTotal(state: ConnectState): number {
  if (state.platform === "android") return 4;
  return 5;
}

export function stepIndex(state: ConnectState): number {
  if (state.phase === "hub") return 0;
  const iosOrder: ConnectPhase[] = [
    "device",
    "code",
    "shortcut",
    "automation",
    "verify",
  ];
  const androidOrder: ConnectPhase[] = [
    "device",
    "code",
    "automation",
    "verify",
  ];
  const order =
    state.platform === "android" ? androidOrder : iosOrder;
  const idx = order.indexOf(state.phase);
  if (idx >= 0) return idx + 1;
  if (state.phase === "done" || state.phase === "skipped") {
    return order.length;
  }
  return 1;
}

function clearBusy(state: ConnectState): ConnectState {
  return { ...state, busy: null };
}

function afterIssueOk(
  state: ConnectState,
  action: Extract<ConnectAction, { type: "ISSUE_OK" }>
): ConnectState {
  // Stay on code so the plaintext + "다음" CTA are visible (C3).
  return {
    ...state,
    busy: null,
    error: undefined,
    reissueOpen: false,
    needsToken: false,
    phase: "code",
    token: {
      plain: action.token,
      hint: action.hint,
      issuedAt: action.issuedAt,
      copied: false,
    },
  };
}

export function connectReducer(
  state: ConnectState,
  action: ConnectAction
): ConnectState {
  switch (action.type) {
    case "PLATFORM_DETECTED": {
      if (state.phase !== "device") return state;
      if (action.platform === "desktop" || action.platform === "other") {
        return {
          ...state,
          platform: action.platform,
          phase: "unsupported",
        };
      }
      // Android "다음": second detect with platform already android advances.
      if (
        action.platform === "android" &&
        state.platform === "android"
      ) {
        return { ...state, platform: "android", phase: "code" };
      }
      // iOS/Android first detect: stay on device for confirmation UI (C1).
      return {
        ...state,
        platform: action.platform,
        phase: "device",
      };
    }

    case "SET_IOS27": {
      if (state.phase !== "device") return state;
      if (action.value) {
        return {
          ...state,
          ios27: true,
          platform: "ios",
          phase: "code",
        };
      }
      return {
        ...state,
        ios27: false,
        platform: "ios",
        phase: "unsupported",
      };
    }

    case "BACK_TO_DEVICE": {
      return {
        ...state,
        phase: "device",
        ios27: null,
        error: undefined,
        busy: null,
      };
    }

    case "ISSUE_START": {
      if (
        state.phase !== "code" &&
        state.phase !== "shortcut" &&
        state.phase !== "automation" &&
        state.phase !== "verify"
      ) {
        return state;
      }
      if (state.busy === "issue") return state;
      return {
        ...state,
        busy: "issue",
        error: undefined,
        phase: "code",
      };
    }

    case "ISSUE_OK": {
      if (state.busy !== "issue" && state.phase !== "code") return state;
      return afterIssueOk(state, action);
    }

    case "ISSUE_FAIL": {
      if (state.busy !== "issue") return state;
      return {
        ...clearBusy(state),
        phase: "code",
        error: action.error,
      };
    }

    case "COPY_RESULT": {
      if (!state.token.plain) return state;
      return {
        ...state,
        token: { ...state.token, copied: action.ok },
      };
    }

    case "OPEN_SHORTCUT": {
      if (state.phase !== "shortcut") return state;
      return { ...state, shortcutOpened: true };
    }

    case "CONFIRM_ADDED": {
      if (state.phase !== "shortcut") return state;
      return { ...state, phase: "automation" };
    }

    case "CONFIRM_AUTOMATION": {
      if (state.phase !== "automation") return state;
      return {
        ...state,
        phase: "verify",
        deviceOk: false,
        realOk: false,
        firstEventAt: undefined,
        // 리듀서는 순수해야 하므로 시각은 액션으로 받고, 없을 때만 현재 시각.
        verifyStartedAt: action.at ?? new Date().toISOString(),
      };
    }

    case "GO_TO_STEP": {
      if (state.phase === "hub" || state.phase === "unsupported") return state;
      if (state.phase === "done" || state.phase === "skipped") return state;
      if (state.busy) return state;
      const order = stepOrder(state.platform);
      const from = order.indexOf(state.phase as ConnectStepPhase);
      const to = order.indexOf(action.phase);
      // 끝낸 단계로만 되돌아가요.
      if (from < 0 || to < 0 || to >= from) return state;
      if (action.phase === "device") {
        return {
          ...state,
          phase: "device",
          ios27: null,
          error: undefined,
          busy: null,
          reissueOpen: false,
        };
      }
      return {
        ...state,
        phase: action.phase,
        error: undefined,
        busy: null,
        reissueOpen: false,
      };
    }

    case "SERVER_TEST_START": {
      if (state.phase !== "verify") return state;
      if (state.busy) return state;
      return { ...state, busy: "server-test", error: undefined };
    }

    case "SERVER_TEST_OK": {
      if (state.phase !== "verify") return state;
      return {
        ...clearBusy(state),
        serverOk: true,
        error: undefined,
      };
    }

    case "SERVER_TEST_FAIL": {
      if (state.phase !== "verify") return state;
      return { ...clearBusy(state), error: action.error };
    }

    case "EVENT_RECEIVED": {
      if (state.phase !== "verify") return state;
      // 서버 테스트(sim)는 폰 연결의 증거가 아니에요.
      if (action.source === "sim") return state;
      // 확인 단계 진입 뒤에 도착한 알림만 인정해요(예전 기록 금지).
      if (!isAfter(action.at, state.verifyStartedAt)) return state;
      const realOk = state.realOk || action.kind === "real";
      if (state.deviceOk && realOk === state.realOk) return state;
      return {
        ...state,
        deviceOk: true,
        realOk,
        firstEventAt: state.firstEventAt ?? action.at,
      };
    }

    case "FINISH_START": {
      if (state.phase !== "verify") return state;
      if (state.busy) return state;
      const status = canFinish(state)
        ? "done"
        : canFinishAnyway(state)
          ? "partial"
          : null;
      if (!status) return state;
      return { ...state, busy: "finish", error: undefined, finishStatus: status };
    }

    case "FINISH_OK": {
      if (state.busy !== "finish") return state;
      return {
        ...clearBusy(state),
        phase: "done",
        finishStatus: action.status,
        error: undefined,
      };
    }

    case "FINISH_FAIL": {
      if (state.busy !== "finish") return state;
      return { ...clearBusy(state), error: action.error };
    }

    case "SKIP_START": {
      if (
        state.phase === "done" ||
        state.phase === "skipped" ||
        state.busy === "skip"
      ) {
        return state;
      }
      return { ...state, busy: "skip", error: undefined };
    }

    case "SKIP_OK": {
      if (state.busy !== "skip") return state;
      return {
        ...clearBusy(state),
        phase: "skipped",
        error: undefined,
      };
    }

    case "SKIP_FAIL": {
      if (state.busy !== "skip") return state;
      return { ...clearBusy(state), error: action.error };
    }

    case "REISSUE_REQUEST": {
      if (
        state.phase !== "code" &&
        state.phase !== "shortcut" &&
        state.phase !== "automation" &&
        state.phase !== "verify"
      ) {
        return state;
      }
      return { ...state, reissueOpen: true };
    }

    case "REISSUE_CANCEL": {
      return { ...state, reissueOpen: false };
    }

    case "RESTORE": {
      const snap = action.snapshot;
      const tokenPhases: ConnectPhase[] = [
        "shortcut",
        "automation",
        "verify",
      ];
      const needsToken = tokenPhases.includes(snap.phase);
      return {
        ...initialConnectState(),
        phase: snap.phase,
        platform: snap.platform,
        ios27: snap.ios27,
        selectedApps: snap.selectedApps,
        serverOk: snap.serverOk,
        deviceOk: snap.deviceOk,
        realOk: snap.realOk ?? false,
        verifyStartedAt:
          snap.phase === "verify"
            ? (snap.verifyStartedAt ?? new Date().toISOString())
            : undefined,
        needsToken,
        token: { copied: false },
        issueMode: "wizard",
      };
    }

    case "DISMISS_ERROR": {
      if (!state.error) return state;
      return { ...state, error: undefined };
    }

    case "SET_SELECTED_APPS": {
      return { ...state, selectedApps: action.apps };
    }

    case "CODE_NEXT": {
      if (state.phase !== "code" || !state.token.plain) return state;
      return {
        ...state,
        phase: state.platform === "android" ? "automation" : "shortcut",
      };
    }

    case "ENTER_HUB": {
      const platform = action.platform;
      return {
        ...initialConnectState(),
        phase: "hub",
        platform,
        ios27:
          action.ios27 !== undefined
            ? action.ios27
            : platform === "ios"
              ? true
              : null,
        issueMode: "wizard",
      };
    }

    case "START_ADD_DEVICE": {
      if (state.phase !== "hub") return state;
      if (
        state.platform !== "ios" &&
        state.platform !== "android"
      ) {
        return state;
      }
      return {
        ...state,
        phase: "code",
        issueMode: "add",
        token: { copied: false },
        needsToken: false,
        reissueOpen: false,
        error: undefined,
        busy: null,
        serverOk: false,
        deviceOk: false,
        realOk: false,
        verifyStartedAt: undefined,
        shortcutOpened: false,
      };
    }

    case "START_REISSUE": {
      if (state.phase !== "hub") return state;
      if (
        state.platform !== "ios" &&
        state.platform !== "android"
      ) {
        return state;
      }
      return {
        ...state,
        phase: "code",
        issueMode: "reissue",
        token: { copied: false },
        needsToken: true,
        reissueOpen: true,
        error: undefined,
        busy: null,
        serverOk: false,
        deviceOk: false,
        realOk: false,
        verifyStartedAt: undefined,
        shortcutOpened: false,
      };
    }

    case "RESUME_VERIFY": {
      if (state.phase !== "hub") return state;
      if (
        state.platform !== "ios" &&
        state.platform !== "android"
      ) {
        return state;
      }
      return {
        ...state,
        phase: "verify",
        issueMode: "wizard",
        token: { copied: false },
        needsToken: false,
        reissueOpen: false,
        error: undefined,
        busy: null,
        // 허브에서 다시 들어와도 항상 새로 기다려요(예전 성공 기록은 인정하지 않아요).
        serverOk: false,
        deviceOk: false,
        realOk: false,
        verifyStartedAt: action.at ?? new Date().toISOString(),
      };
    }

    case "BACK_TO_HUB": {
      if (
        state.phase !== "code" &&
        state.phase !== "shortcut" &&
        state.phase !== "automation" &&
        state.phase !== "verify"
      ) {
        return state;
      }
      if (state.issueMode === "wizard") return state;
      return {
        ...state,
        phase: "hub",
        token: { copied: false },
        needsToken: false,
        reissueOpen: false,
        error: undefined,
        busy: null,
        issueMode: "wizard",
        shortcutOpened: false,
      };
    }

    default:
      return state;
  }
}

/** iOS path: after device confirmation with ios27=true jump to code. */
export function detectIos27AndAdvance(
  state: ConnectState,
  value: boolean
): ConnectState {
  if (value) {
    return {
      ...state,
      ios27: true,
      platform: "ios",
      phase: "code",
    };
  }
  return {
    ...state,
    ios27: false,
    platform: "ios",
    phase: "unsupported",
  };
}

export const STEP_LABELS_IOS = [
  "기기 확인",
  "연결 코드",
  "단축어 추가",
  "자동화 만들기",
  "연결 확인",
] as const;

export const STEP_LABELS_ANDROID = [
  "기기 확인",
  "연결 코드",
  "매크로 만들기",
  "연결 확인",
] as const;

export function stepLabel(state: ConnectState): string {
  const labels =
    state.platform === "android" ? STEP_LABELS_ANDROID : STEP_LABELS_IOS;
  const idx = stepIndex(state) - 1;
  return labels[Math.max(0, Math.min(idx, labels.length - 1))] ?? "";
}

export function toSnapshot(state: ConnectState): ConnectSnapshot {
  return {
    phase: state.phase,
    platform: state.platform,
    ios27: state.ios27,
    selectedApps: state.selectedApps,
    serverOk: state.serverOk,
    deviceOk: state.deviceOk,
    realOk: state.realOk,
    ...(state.verifyStartedAt
      ? { verifyStartedAt: state.verifyStartedAt }
      : {}),
  };
}
