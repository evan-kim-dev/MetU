/** Human-readable agent_events.status labels (Korean). */

export type SmsParsePreviewLabel = {
  amount: number | null;
  currency: string | null;
  merchant: string | null;
};

export function formatSmsPreviewLabel(
  preview: SmsParsePreviewLabel
): string | null {
  const parts: string[] = [];
  if (preview.amount != null) {
    const cur =
      preview.currency === "KRW" || !preview.currency ? "원" : preview.currency;
    parts.push(
      cur === "원"
        ? `${preview.amount.toLocaleString("ko-KR")}원`
        : `${preview.amount} ${cur}`
    );
  }
  if (preview.merchant) parts.push(preview.merchant);
  if (parts.length === 0) return null;
  return `${parts.join(" · ")} (미리보기)`;
}

export const AGENT_EVENT_STATUS_LABELS: Record<string, string> = {
  received: "처리 대기",
  processing: "처리 중",
  done: "가계부 저장됨",
  needs_review: "확인 필요",
  ignored: "무시됨",
  failed: "실패",
  unassigned: "여행 없음·보관됨",
};

export function agentEventStatusLabel(status: string): string {
  return AGENT_EVENT_STATUS_LABELS[status] ?? status;
}

// ---------------------------------------------------------------------------
// 사유(reason) → 한국어 한 줄. 수신함 / 연결 확인 / 인제스트 응답이 같은 표를 쓴다.
// ---------------------------------------------------------------------------

/**
 * 사유 코드 → 한국어 문구 (해요체).
 * 코드의 출처:
 * - unassigned: result.reason (lib/onboarding/trip-match.ts) — no_trips / no_dates / outside_window
 * - needs_review: result.items[].reasonCode (lib/agent/policy.ts) — trip_match_uncertain / fx_unresolved
 * - failed: agent_events.error (lib/agent/run.ts) — no-owner-member / commit-failed
 * "여행이 없어서" 는 no_trips 에만 쓴다.
 */
export const AGENT_REASON_MESSAGES: Readonly<Record<string, string>> = {
  no_trips: "여행이 없어서 수신함에 보관했어요",
  no_dates: "여행 날짜를 넣으면 자동으로 붙어요. 수신함에 보관했어요",
  outside_window:
    "여행 날짜와 달라서 수신함에 보관했어요. 수신함에서 붙일 수 있어요",
  trip_match_uncertain: "여행 날짜가 정확히 맞지 않아 확인이 필요해요",
  "no-owner-member":
    "이 여행의 멤버로 확인되지 않아 처리하지 못했어요. 여행을 확인한 뒤 다시 처리해 주세요",
  fx_unresolved: "환율을 확실히 구하지 못해서 확인이 필요해요",
  "commit-failed": "가계부에 저장하지 못했어요. 다시 처리해 주세요",
};

/** 상태별 일반 문구 — 모르는 사유일 때만 쓴다. */
const GENERIC_REASON_BY_STATUS: Readonly<Record<string, string>> = {
  unassigned: "수신함에 보관했어요. 여행에 붙여 주세요",
  needs_review: "확인이 필요해요",
  failed: "처리하지 못했어요. 다시 처리해 주세요",
};

/** 알려진 사유 코드면 문구, 아니면 null. */
export function agentReasonMessage(
  code: string | null | undefined
): string | null {
  if (!code) return null;
  return Object.prototype.hasOwnProperty.call(AGENT_REASON_MESSAGES, code)
    ? AGENT_REASON_MESSAGES[code]!
    : null;
}

/**
 * 이벤트 한 건의 사유를 한국어 한 줄로. unassigned / needs_review / failed 만 대상이다.
 * 우선순위: reasonCode(정책 사유) → reason(매칭 사유) → error(처리 오류).
 * 아무 코드도 못 알아보면 상태별 일반 문구. 그 외 상태나 연결 테스트는 null.
 */
export function agentEventReasonLine(args: {
  status: string;
  reason?: string | null;
  reasonCode?: string | null;
  error?: string | null;
  isTest?: boolean;
}): string | null {
  if (args.isTest) return null;
  const generic = GENERIC_REASON_BY_STATUS[args.status];
  if (!generic) return null;
  for (const code of [args.reasonCode, args.reason, args.error]) {
    const known = agentReasonMessage(code);
    if (known) return known;
  }
  return generic;
}

/** UI label; test/sim events show as 연결 테스트 (F-33/F-34). */
export function agentEventStatusLabelForUi(args: {
  status: string;
  isTest?: boolean;
}): string {
  if (args.isTest) return "연결 테스트";
  return agentEventStatusLabel(args.status);
}

/** Relative time in Korean, assuming `iso` is an absolute timestamp. */
export function formatRelativeKo(
  iso: string,
  nowMs: number = Date.now()
): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diffSec = Math.round((nowMs - t) / 1000);
  if (diffSec < 45) return "방금";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}일 전`;
  return new Date(t).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// 미배정 알림 안내 문구 (수신함)
// ---------------------------------------------------------------------------

/** "2026-07-20","2026-07-23" → "7/20~23", 달이 다르면 "7/30~8/2", 하루면 "7/20" */
export function formatTripRangeShort(
  startIso: string | null | undefined,
  endIso: string | null | undefined
): string | null {
  const s = startIso?.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!s) return null;
  const sm = Number(s[1]);
  const sd = Number(s[2]);
  const e = endIso?.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!e || (Number(e[1]) === sm && Number(e[2]) === sd)) return `${sm}/${sd}`;
  const em = Number(e[1]);
  const ed = Number(e[2]);
  return em === sm ? `${sm}/${sd}~${ed}` : `${sm}/${sd}~${em}/${ed}`;
}

export type UnassignedSuggestInfo = {
  rule: "exact" | "near" | "single" | "outside_window";
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  diffDays?: number;
};

export type UnassignedNote = {
  message: string;
  /** "여행 만들기" 버튼을 보여줄지 */
  showCreateTrip: boolean;
};

/**
 * 미배정 사유별 안내 (한국어 해요체). "여행이 없어서" 는 여행이 0개일 때만 쓴다.
 * - 여행 0개           → 여행을 만들면 자동으로 붙어요
 * - 날짜가 안 맞음     → ○○ 여행(7/20~23)과 날짜가 달라요. 붙일까요?
 * - 날짜를 못 읽음     → 여행 날짜를 넣으면 자동으로 붙어요
 */
export function unassignedNote(args: {
  hasTrips: boolean;
  reason?: string | null;
  suggest?: UnassignedSuggestInfo | null;
}): UnassignedNote {
  if (!args.hasTrips || args.reason === "no_trips") {
    return { message: "여행을 만들면 자동으로 붙어요", showCreateTrip: true };
  }
  const s = args.suggest;
  if (s) {
    const name = s.destination?.trim() || "이 여행";
    const range = formatTripRangeShort(s.startDate, s.endDate);
    const label = range ? `${name} 여행(${range})` : `${name} 여행`;
    switch (s.rule) {
      case "exact":
        return {
          message: `${label} 기간에 맞아요. 붙일까요?`,
          showCreateTrip: false,
        };
      case "single":
        return {
          message: `${label}에 붙일 수 있어요. 날짜는 확인하지 못했어요. 붙일까요?`,
          showCreateTrip: false,
        };
      case "near":
      case "outside_window":
        return {
          message: `${label}과 날짜가 달라요. 붙일까요?`,
          showCreateTrip: false,
        };
    }
  }
  if (args.reason === "no_dates") {
    return {
      message: "여행 날짜를 넣으면 자동으로 붙어요",
      showCreateTrip: false,
    };
  }
  return {
    message: "알맞은 여행을 골라 붙여 주세요",
    showCreateTrip: false,
  };
}