import { SYNTHETIC_SMS } from "@/lib/ledger/sms/__fixtures__/sms";
import { seoulDateIso } from "@/lib/onboarding/trip-window";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Memo tag used to find/reuse the demo trip without touching real trips. */
export const DEMO_TRIP_MEMO_TAG = "[metu-demo:osaka]";
export const DEMO_TRIP_DESTINATION = "데모 여행 (오사카)";
export const DEMO_TRIP_COUNTRY = "일본";
export const DEMO_COMPANION_NAMES = ["민아", "준호"] as const;

export type DemoScenarioStep = {
  step: number;
  label: string;
  /** Synthetic SMS body with dates stamped for `now`. */
  text: string;
  /** ISO instant for received_at (Asia/Seoul local wall time). */
  receivedAt: string;
  fixtureKey: keyof typeof SYNTHETIC_SMS;
};

export type DemoTripDates = {
  startDate: string;
  endDate: string;
  today: string;
};

function addSeoulDays(isoDate: string, days: number): string {
  const ms = Date.parse(`${isoDate}T12:00:00+09:00`);
  if (Number.isNaN(ms)) return isoDate;
  return seoulDateIso(new Date(ms + days * DAY_MS));
}

function toMmDd(isoDate: string): string {
  const parts = isoDate.split("-");
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  return `${m}/${String(d).padStart(2, "0")}`;
}

/** Replace the first MM/DD (optional time) with stamped values. */
export function stampSmsDate(
  text: string,
  isoDate: string,
  hhmm: string
): string {
  const mmdd = toMmDd(isoDate);
  if (/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}/.test(text)) {
    return text.replace(/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}/, `${mmdd} ${hhmm}`);
  }
  if (/\d{1,2}\/\d{1,2}/.test(text)) {
    return text.replace(/\d{1,2}\/\d{1,2}/, mmdd);
  }
  return `${text} ${mmdd} ${hhmm}`;
}

export function demoTripDates(now: Date = new Date()): DemoTripDates {
  const today = seoulDateIso(now);
  return {
    today,
    startDate: addSeoulDays(today, -1),
    endDate: addSeoulDays(today, 3),
  };
}

export function demoDateRangeLabel(dates: DemoTripDates): string {
  return `${dates.startDate} · 3박 4일`;
}

/**
 * Pure demo scenario: 3–4 synthetic SMS strings dated inside the trip window.
 * Amounts/FX are not computed here — the server pipeline owns that.
 */
export function buildDemoScenario(now: Date = new Date()): DemoScenarioStep[] {
  const dates = demoTripDates(now);
  const day0 = dates.today;
  const day1 = addSeoulDays(dates.today, 1);

  const specs: Array<{
    step: number;
    label: string;
    fixtureKey: keyof typeof SYNTHETIC_SMS;
    spentOn: string;
    hhmm: string;
    receivedHHmm: string;
  }> = [
    {
      step: 1,
      label: "오사카 호텔 해외승인",
      fixtureKey: "demoHotelJpy",
      spentOn: day0,
      hhmm: "21:40",
      receivedHHmm: "21:41",
    },
    {
      step: 2,
      label: "편의점 소액 엔화",
      fixtureKey: "shinhanCheckOverseas",
      spentOn: day0,
      hhmm: "13:23",
      receivedHHmm: "13:24",
    },
    {
      step: 3,
      label: "국내 원화 승인",
      fixtureKey: "samsungDomestic",
      spentOn: day1,
      hhmm: "12:00",
      receivedHHmm: "12:01",
    },
    {
      step: 4,
      label: "국내 취소",
      fixtureKey: "hyundaiCancel",
      spentOn: day1,
      hhmm: "15:30",
      receivedHHmm: "15:31",
    },
  ];

  return specs.map((s) => {
    const raw = SYNTHETIC_SMS[s.fixtureKey].text;
    const text = stampSmsDate(raw, s.spentOn, s.hhmm);
    const receivedAt = `${s.spentOn}T${s.receivedHHmm}:00+09:00`;
    return {
      step: s.step,
      label: s.label,
      text,
      receivedAt,
      fixtureKey: s.fixtureKey,
    };
  });
}

export function getDemoStep(
  step: number,
  now: Date = new Date()
): DemoScenarioStep | null {
  const scenario = buildDemoScenario(now);
  return scenario.find((s) => s.step === step) ?? null;
}

export function demoScenarioStepCount(now: Date = new Date()): number {
  return buildDemoScenario(now).length;
}
