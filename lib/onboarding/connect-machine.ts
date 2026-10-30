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
  serverOk: boolean;
  deviceOk: boolean;
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
  | { type: "CONFIRM_AUTOMATION" }
  | { type: "SERVER_TEST_START" }
  | { type: "SERVER_TEST_OK"; duplicate?: boolean }
  | { type: "SERVER_TEST_FAIL"; error: ConnectErrorState }
  | {
      type: "EVENT_RECEIVED";
      kind: "device-test" | "real";
      at: string;
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
  | { type: "RESUME_VERIFY" }
  | { type: "BACK_TO_HUB" };

export function initialConnectState(): ConnectState {
  return {
    phase: "device",
    platform: "other",
    ios27: null,
    selectedApps: [],
    token: { copied: false },
    serverOk: false,
    deviceOk: false,
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

export function canFinish(state: ConnectState): boolean {
  return state.phase === "verify" && state.serverOk && state.deviceOk;
}

export function canFinishAnyway(state: ConnectState): boolean {
  return (
    state.phase === "verify" &&
    state.serverOk &&
    !state.deviceOk
  );
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
      return { ...state, phase: "verify" };
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
      return {
        ...state,
        deviceOk: true,
        firstEventAt: action.at,
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
        // Keep prior ok flags false so user reconfirms from hub.
        serverOk: false,
        deviceOk: false,
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
  };
}
