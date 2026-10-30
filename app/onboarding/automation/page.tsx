"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { MobileShell } from "@/components/layout/MobileShell";
import { NOTIF_APP_PRESETS } from "@/lib/ledger/notif/apps";
import {
  agentEventStatusLabel,
  formatRelativeKo,
  formatSmsPreviewLabel,
  type SmsParsePreviewLabel,
} from "@/lib/agent/event-status";
import type { DetectedPlatform } from "@/lib/onboarding/automation";
import { IOS_SHORTCUT_ICLOUD_URL } from "@/lib/onboarding/constants";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ProgressBar } from "@/components/ui/ProgressBar";

const TOTAL_STEPS = 4;

const SAMPLE_SMS_JSON =
  '{"text":"승인 12,000원","receivedAt":"2026-10-30T12:00:00+09:00"}';
const SAMPLE_TEST_JSON =
  '{"text":"MTU-TEST 연결 확인","receivedAt":"2026-10-30T12:00:00+09:00"}';

type RecentEventRow = {
  id: string;
  status: string;
  createdAt: string;
  source: string;
  tripId: string | null;
  textPreview: string;
  error: string | null;
  reason: string | null;
  preview?: SmsParsePreviewLabel | null;
};

type AutomationStatusResponse = {
  lastServerTestAt: string | null;
  lastDeviceTestAt: string | null;
  lastNotificationAt: string | null;
  lastDroppedApp: string | null;
  recentEvents?: RecentEventRow[];
  unassignedCount?: number;
};

function detectPlatformClient(): DetectedPlatform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  if (/windows|macintosh|linux|cros/i.test(ua) && !/mobile/i.test(ua)) {
    return "desktop";
  }
  return "other";
}

export default function AutomationOnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [platform, setPlatform] = useState<DetectedPlatform>("other");
  const [ios27, setIos27] = useState<boolean | null>(null);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [customApp, setCustomApp] = useState("");
  const [serverOk, setServerOk] = useState(false);
  const [deviceOk, setDeviceOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenHint, setTokenHint] = useState<string | null>(null);
  /** Plaintext shown once after issue — never re-fetched from server. */
  const [plainToken, setPlainToken] = useState<string | null>(null);
  const [recentEvents, setRecentEvents] = useState<RecentEventRow[]>([]);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [lastNotificationAt, setLastNotificationAt] = useState<string | null>(
    null
  );
  const [lastDroppedApp, setLastDroppedApp] = useState<string | null>(null);

  useEffect(() => {
    setPlatform(detectPlatformClient());
  }, []);

  const unsupportedEnv = useMemo(() => {
    if (platform === "desktop" || platform === "other") return true;
    if (platform === "ios" && ios27 === false) return true;
    return false;
  }, [platform, ios27]);

  const progressStep = step + 1;

  const saveOnboarding = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch("/api/agent/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? "저장에 실패했어요");
      }
    },
    []
  );

  const skip = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await saveOnboarding({ status: "skipped", platform });
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "건너뛰기에 실패했어요");
    } finally {
      setBusy(false);
    }
  }, [platform, router, saveOnboarding]);

  const refreshChecks = useCallback(async () => {
    const res = await fetch("/api/agent/automation-status");
    if (!res.ok) return;
    const json = (await res.json()) as AutomationStatusResponse;
    if (json.lastServerTestAt) setServerOk(true);
    // Device path OK when MTU-TEST recorded OR any notification arrived (Prompt 1/2).
    if (json.lastDeviceTestAt || json.lastNotificationAt) setDeviceOk(true);
    setLastNotificationAt(json.lastNotificationAt ?? null);
    setLastDroppedApp(json.lastDroppedApp ?? null);
    setRecentEvents(Array.isArray(json.recentEvents) ? json.recentEvents : []);
    setUnassignedCount(
      typeof json.unassignedCount === "number" ? json.unassignedCount : 0
    );
  }, []);

  useEffect(() => {
    if (step !== 3) return;
    void refreshChecks();
    const id = window.setInterval(() => void refreshChecks(), 3000);
    return () => window.clearInterval(id);
  }, [step, refreshChecks]);

  async function issueConnectToken() {
    setBusy(true);
    setError(null);
    setTokenHint(null);
    try {
      const res = await fetch("/api/agent/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "iPhone 단축어" }),
      });
      const json = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !json.token) {
        throw new Error(json.error ?? "연결 코드를 만들지 못했어요");
      }
      setPlainToken(json.token);
      try {
        await navigator.clipboard.writeText(json.token);
        setTokenHint(
          "연결 코드를 만들었고 클립보드에도 복사했어요. 확인한 뒤 아래 자동화 추가를 눌러 주세요."
        );
      } catch {
        setTokenHint(
          "연결 코드를 만들었어요. 아래 코드를 복사한 뒤 자동화 추가를 눌러 주세요."
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "연결 코드 발급에 실패했어요");
    } finally {
      setBusy(false);
    }
  }

  async function copyPlainToken() {
    if (!plainToken) return;
    try {
      await navigator.clipboard.writeText(plainToken);
      setTokenHint("연결 코드를 복사했어요.");
    } catch {
      setError("클립보드 복사에 실패했어요. 코드를 길게 눌러 직접 복사해 주세요.");
    }
  }

  async function openIphoneShortcut() {
    if (!plainToken) {
      setError("먼저 연결 코드를 만들어 주세요.");
      return;
    }
    setError(null);
    try {
      await navigator.clipboard.writeText(plainToken);
      setTokenHint("연결 코드를 다시 복사했어요. 단축어 추가 화면으로 이동해요.");
    } catch {
      setTokenHint(
        "클립보드 복사에 실패했어요. 위에 보이는 코드를 복사한 뒤 단축어에서 붙여 넣으세요."
      );
    }
    window.location.href = IOS_SHORTCUT_ICLOUD_URL;
  }

  async function runServerTest() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/onboarding/test", { method: "POST" });
      const json = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(json.message ?? json.error ?? "서버 테스트 실패");
      }
      setServerOk(true);
      await refreshChecks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "서버 테스트 실패");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      const status = serverOk && deviceOk ? "done" : serverOk ? "partial" : "partial";
      await saveOnboarding({
        status,
        platform,
        selectedApps,
      });
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "완료 처리 실패");
    } finally {
      setBusy(false);
    }
  }

  async function goNextFromStep0() {
    await saveOnboarding({ platform, status: "pending" }).catch(() => undefined);
    if (unsupportedEnv) {
      await skip();
      return;
    }
    setStep(1);
  }

  async function goNextFromStep2() {
    if (selectedApps.length === 0) {
      setError("카드 앱을 하나 이상 선택해 주세요.");
      return;
    }
    setError(null);
    try {
      await saveOnboarding({ platform, selectedApps, status: "pending" });
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    }
  }

  function toggleApp(name: string) {
    setSelectedApps((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
  }

  function addCustomApp() {
    const name = customApp.trim().slice(0, 40);
    if (!name) return;
    setSelectedApps((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setCustomApp("");
  }

  return (
    <MobileShell title="알림 자동 기록" showBack={false} showBottomNav={false}>
      <div className="flex flex-1 flex-col gap-4 px-4 pb-8 pt-2">
        <ProgressBar current={progressStep} total={TOTAL_STEPS} />

        <button
          type="button"
          className="self-end text-xs font-semibold text-ink-muted underline"
          disabled={busy}
          onClick={() => void skip()}
        >
          건너뛰고 들어가기
        </button>

        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        {step === 0 ? (
          <section className="space-y-4">
            <h2 className="text-lg font-extrabold text-ink-heading">어떤 기기인가요?</h2>
            <p className="text-sm text-ink-body">
              카드 알림을 자동으로 기록하려면 iPhone(iOS 27+) 또는 안드로이드가 필요해요.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["ios", "iPhone"],
                  ["android", "Android"],
                  ["desktop", "PC"],
                  ["other", "기타"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-bold ${
                    platform === value
                      ? "border-brand bg-brand/10 text-brand-strong"
                      : "border-line-soft bg-surface-white"
                  }`}
                  onClick={() => setPlatform(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {platform === "ios" ? (
              <div className="space-y-2 rounded-2xl bg-surface-soft p-3">
                <p className="text-sm font-bold text-ink-heading">iOS 27 이상이에요?</p>
                <div className="flex gap-2">
                  <PrimaryButton
                    variant={ios27 === true ? "primary" : "secondary"}
                    className="flex-1"
                    onClick={() => setIos27(true)}
                  >
                    예
                  </PrimaryButton>
                  <PrimaryButton
                    variant={ios27 === false ? "primary" : "secondary"}
                    className="flex-1"
                    onClick={() => setIos27(false)}
                  >
                    아니오
                  </PrimaryButton>
                </div>
                <p className="text-xs text-ink-muted">
                  설정 &gt; 일반 &gt; 정보에서 소프트웨어 버전을 확인할 수 있어요.
                </p>
              </div>
            ) : null}
            {unsupportedEnv ? (
              <div className="space-y-3 rounded-2xl bg-surface-soft p-3 text-sm text-ink-body">
                <p>
                  이 기기는 데스크톱(또는 미지원)이에요. 아래에서 골라 주세요.
                </p>
                <div className="flex flex-col gap-2">
                  <PrimaryButton
                    fullWidth
                    variant="secondary"
                    onClick={() => setStep(1)}
                  >
                    휴대폰 설정 안내 보기
                  </PrimaryButton>
                  <PrimaryButton
                    fullWidth
                    variant="secondary"
                    onClick={() => setStep(1)}
                  >
                    curl 로 테스트하기 (연결 코드 발급)
                  </PrimaryButton>
                  <PrimaryButton
                    fullWidth
                    disabled={busy}
                    onClick={() => void skip()}
                  >
                    건너뛰기
                  </PrimaryButton>
                </div>
                {platform === "desktop" ? (
                  <button
                    type="button"
                    className="min-h-11 text-xs font-bold text-brand underline"
                    onClick={() =>
                      void navigator.clipboard.writeText(window.location.href)
                    }
                  >
                    이 페이지 링크 복사 (폰에서 열기)
                  </button>
                ) : null}
              </div>
            ) : (
              <PrimaryButton fullWidth disabled={busy} onClick={() => void goNextFromStep0()}>
                다음
              </PrimaryButton>
            )}
          </section>
        ) : null}

        {step === 1 ? (
          <section className="space-y-4">
            <h2 className="text-lg font-extrabold text-ink-heading">연결 코드 &amp; 단축어</h2>
            <p className="text-sm text-ink-body">
              여행은 나중에 만들어도 돼요. 먼저 연결 코드를 만들고 복사한 뒤, 단축어를
              추가해요.
            </p>
            <PrimaryButton
              fullWidth
              disabled={busy}
              onClick={() => void issueConnectToken()}
            >
              {plainToken ? "연결 코드 다시 만들기" : "연결 코드 만들기"}
            </PrimaryButton>
            {tokenHint ? (
              <p className="text-xs font-semibold text-brand">{tokenHint}</p>
            ) : null}
            {plainToken ? (
              <div className="space-y-2 rounded-2xl bg-amber-50 p-3 text-amber-950">
                <p className="text-xs font-bold">
                  내 연결 코드 (이 화면을 벗어나면 다시 볼 수 없어요)
                </p>
                <code className="block break-all select-all text-xs font-semibold">
                  {plainToken}
                </code>
                <PrimaryButton
                  fullWidth
                  variant="secondary"
                  onClick={() => void copyPlainToken()}
                >
                  연결 코드 복사
                </PrimaryButton>
              </div>
            ) : (
              <p className="text-xs text-ink-muted">
                코드를 만든 뒤에야 자동화 추가 버튼이 활성화돼요.
              </p>
            )}
            <PrimaryButton
              fullWidth
              disabled={busy || !plainToken}
              onClick={() => void openIphoneShortcut()}
            >
              iPhone 자동화 추가
            </PrimaryButton>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-body">
              <li>연결 코드를 만들고 복사하기</li>
              <li>
                &quot;iPhone 자동화 추가&quot; → 단축어에서 연결 코드 칸에 붙여넣기
              </li>
              <li>자동화의 앱을 내 카드앱으로 바꾸기 · &quot;실행 전에 확인&quot; 끄기</li>
            </ol>
            <pre className="overflow-x-auto rounded-xl bg-surface-soft p-3 text-[11px] leading-5 text-ink-heading">
              {`POST ${typeof window !== "undefined" ? window.location.origin : ""}/api/ingest/sms
Authorization: Bearer <연결코드>
${SAMPLE_SMS_JSON}

테스트: ${SAMPLE_TEST_JSON}`}
            </pre>
            {platform === "android" ? (
              <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-body">
                <li>MacroDroid 설치 후 알림 접근 허용</li>
                <li>트리거: 알림 수신 → 카드 앱 선택</li>
                <li>
                  HTTP POST{" "}
                  <code className="rounded bg-surface-soft px-1 text-xs">
                    /api/ingest/sms
                  </code>
                  , Authorization: Bearer 연결 코드
                </li>
                <li>
                  본문{" "}
                  <code className="rounded bg-surface-soft px-1 text-[10px]">
                    {SAMPLE_SMS_JSON}
                  </code>
                </li>
              </ol>
            ) : null}
            <Link
              href="/onboarding/shortcut-guide"
              className="block text-center text-xs font-bold text-brand underline"
            >
              직접 만들기 안내
            </Link>
            <PrimaryButton
              fullWidth
              variant="secondary"
              disabled={busy}
              onClick={() => setStep(2)}
            >
              다음
            </PrimaryButton>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-4">
            <h2 className="text-lg font-extrabold text-ink-heading">카드 앱 선택</h2>
            <p className="text-sm text-ink-body">
              자동화에 추가한 앱의 알림만, 켠 이후에 온 알림만 기록돼요.
            </p>
            <ul className="flex flex-wrap gap-2">
              {NOTIF_APP_PRESETS.map((name) => {
                const on = selectedApps.includes(name);
                return (
                  <li key={name}>
                    <button
                      type="button"
                      className={`min-h-10 rounded-full px-3 text-xs font-bold ${
                        on ? "bg-brand text-white" : "bg-surface-soft text-ink-heading"
                      }`}
                      onClick={() => toggleApp(name)}
                    >
                      {name}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex gap-2">
              <input
                className="min-h-11 flex-1 rounded-xl border border-line-soft px-3 text-sm"
                placeholder="기타 앱 이름"
                value={customApp}
                onChange={(e) => setCustomApp(e.target.value)}
                maxLength={40}
              />
              <PrimaryButton type="button" variant="secondary" onClick={addCustomApp}>
                추가
              </PrimaryButton>
            </div>
            {platform === "ios" ? (
              <p className="text-xs leading-relaxed text-ink-muted">
                단축어 &gt; 자동화 &gt; 새 자동화 &gt; 알림 &gt; 위 앱을 선택 &gt; &apos;MetU
                알림 전송&apos; 실행 &gt; 실행 전에 묻지 않음.
              </p>
            ) : null}
            <PrimaryButton fullWidth disabled={busy} onClick={() => void goNextFromStep2()}>
              다음
            </PrimaryButton>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-4">
            <h2 className="text-lg font-extrabold text-ink-heading">연결 테스트</h2>
            <div className="space-y-3 rounded-2xl bg-surface-soft p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-ink-heading">1. 서버 연결</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    서버까지 이벤트가 도달하는지만 확인해요. 폰 자동화와는 별개예요.
                  </p>
                </div>
                <span className="text-lg">{serverOk ? "✅" : "⬜"}</span>
              </div>
              <PrimaryButton
                fullWidth
                variant="secondary"
                disabled={busy || serverOk}
                onClick={() => void runServerTest()}
              >
                연결 테스트
              </PrimaryButton>
            </div>
            <div className="space-y-3 rounded-2xl bg-surface-soft p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-ink-heading">2. 폰 자동화</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    단축어 앱에서 &apos;MetU 알림 전송&apos;을 직접 한 번 실행해 주세요(입력이
                    없으면 MTU-TEST).
                  </p>
                </div>
                <span className="text-lg">{deviceOk ? "✅" : "⬜"}</span>
              </div>
              <p className="text-xs text-ink-caption">
                테스트 알림 보내기(웹 푸시) — 푸시 설정 후 사용 가능
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-line-soft bg-surface-white p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-ink-heading">
                  최근 수신
                </h3>
                {lastNotificationAt ? (
                  <span className="text-[11px] text-ink-muted">
                    마지막 {formatRelativeKo(lastNotificationAt)}
                  </span>
                ) : null}
              </div>
              {lastDroppedApp ? (
                <p className="text-xs text-ink-muted">
                  최근 앱: {lastDroppedApp}
                </p>
              ) : null}
              {recentEvents.length === 0 ? (
                <p className="text-xs leading-relaxed text-ink-muted">
                  아직 수신된 알림이 없어요 — 단축어 응답에서 에러를 확인하세요.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {recentEvents.map((ev) => (
                    <li
                      key={ev.id}
                      className="rounded-xl bg-surface-soft px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-ink-heading">
                          {agentEventStatusLabel(ev.status)}
                        </span>
                        <span className="text-[10px] text-ink-muted">
                          {formatRelativeKo(ev.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-ink-body">
                        {ev.textPreview || "(내용 없음)"}
                      </p>
                      {ev.preview
                        ? (() => {
                            const label = formatSmsPreviewLabel(ev.preview!);
                            return label ? (
                              <p className="mt-0.5 text-[11px] font-semibold text-brand">
                                {label}
                              </p>
                            ) : null;
                          })()
                        : null}
                      {ev.error || ev.reason ? (
                        <p className="mt-0.5 text-[10px] text-danger">
                          {[ev.error, ev.reason].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {unassignedCount > 0 ? (
                <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                  <Link
                    href="/agent/inbox"
                    className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-amber-50 text-sm font-bold text-amber-950 ring-1 ring-amber-200"
                  >
                    수신함 보기
                  </Link>
                  <Link
                    href="/onboarding"
                    className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-line text-sm font-bold text-ink-heading"
                  >
                    여행 만들기
                  </Link>
                </div>
              ) : null}
            </div>

            <PrimaryButton fullWidth disabled={busy || !serverOk} onClick={() => void finish()}>
              시작하기
            </PrimaryButton>
            {!serverOk ? (
              <p className="text-center text-xs text-ink-muted">
                서버 연결 테스트를 먼저 완료해 주세요.
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
    </MobileShell>
  );
}
