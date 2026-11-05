import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PAY_APPS,
  PAY_LAUNCH_TIMEOUT_MS,
  buildTossSendUrl,
  getPayApp,
  launchPayApp,
  openTossPay,
  payAmountText,
  payGuidance,
  type LaunchEnv,
} from "@/lib/ledger/pay-links";

function fakeEnv() {
  const listeners = new Map<string, Set<() => void>>();
  const doc = {
    visibilityState: "visible",
    addEventListener: (type: string, fn: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: (type: string, fn: () => void) => {
      listeners.get(type)?.delete(fn);
    },
  };
  const navigate = vi.fn();
  const env: LaunchEnv = { navigate, doc };
  const fire = (type: string) => {
    for (const fn of [...(listeners.get(type) ?? [])]) fn();
  };
  const count = (type: string) => listeners.get(type)?.size ?? 0;
  return { env, doc, navigate, fire, count };
}

describe("PAY_APPS / getPayApp", () => {
  it("only opens the app, no amount or recipient in the url", () => {
    for (const app of PAY_APPS) {
      expect(app.url).toMatch(/^[a-z]+:\/\/$/);
    }
    expect(getPayApp("toss").url).toBe("supertoss://");
    expect(getPayApp("kakaopay").url).toBe("kakaotalk://");
  });
});

describe("payAmountText", () => {
  it("returns plain integer digits", () => {
    expect(payAmountText(12000)).toBe("12000");
  });
  it("rejects non-integer, zero, negative", () => {
    expect(payAmountText(10.5)).toBeNull();
    expect(payAmountText(0)).toBeNull();
    expect(payAmountText(-1)).toBeNull();
  });
});

describe("buildTossSendUrl / openTossPay", () => {
  it("은행·계좌가 있으면 send 스킴에 금액·계좌를 실어요", () => {
    const url = buildTossSendUrl({
      bank: "카카오뱅크",
      accountNo: "3333-01-1234567",
      amount: 12000,
    });
    expect(url).toMatch(/^supertoss:\/\/send\?/);
    expect(url).toContain("accountNo=3333011234567");
    expect(url).toContain("amount=12000");
    expect(url).toContain(encodeURIComponent("카카오뱅크"));
  });

  it("계좌 없으면 앱 루트만", () => {
    expect(
      buildTossSendUrl({ bank: null, accountNo: null, amount: 5000 })
    ).toBe("supertoss://");
  });

  it("데스크톱이면 클립보드에 복사하고 딥링크는 안 열어요", async () => {
    const navigate = vi.fn();
    const copyText = vi.fn(async () => true);
    const res = await openTossPay({
      bank: "토스뱅크",
      accountNo: "1000-1234",
      amount: 3000,
      copyText,
      navigate,
      isMobile: false,
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(copyText).toHaveBeenCalledWith("10001234");
    expect(res.ok).toBe(true);
  });

  it("모바일이면 딥링크를 열어요", async () => {
    const navigate = vi.fn();
    const copyText = vi.fn(async () => true);
    const res = await openTossPay({
      bank: "토스뱅크",
      accountNo: "1000-1234",
      amount: 3000,
      copyText,
      navigate,
      isMobile: true,
    });
    expect(navigate).toHaveBeenCalled();
    expect(String(navigate.mock.calls[0]?.[0])).toMatch(/^supertoss:\/\/send\?/);
    expect(res.ok).toBe(true);
  });
});

describe("payGuidance", () => {
  it("mentions copied amount and app", () => {
    const s = payGuidance("토스", "₩12,000");
    expect(s).toContain("₩12,000");
    expect(s).toContain("토스");
  });
});

describe("launchPayApp", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("navigates to scheme and falls back after timeout when page stays visible", () => {
    const { env, navigate } = fakeEnv();
    const onFallback = vi.fn();
    launchPayApp("toss", { env, onFallback });
    expect(navigate).toHaveBeenCalledWith("supertoss://");
    vi.advanceTimersByTime(PAY_LAUNCH_TIMEOUT_MS - 1);
    expect(onFallback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(onFallback).toHaveBeenCalledTimes(1);
  });

  it("does not fall back when page becomes hidden (app opened)", () => {
    const { env, doc, fire, count } = fakeEnv();
    const onFallback = vi.fn();
    launchPayApp("kakaopay", { env, onFallback });
    doc.visibilityState = "hidden";
    fire("visibilitychange");
    vi.advanceTimersByTime(PAY_LAUNCH_TIMEOUT_MS * 2);
    expect(onFallback).not.toHaveBeenCalled();
    expect(count("visibilitychange")).toBe(0);
  });

  it("ignores visibilitychange while still visible", () => {
    const { env, fire } = fakeEnv();
    const onFallback = vi.fn();
    launchPayApp("toss", { env, onFallback, timeoutMs: 500 });
    fire("visibilitychange");
    vi.advanceTimersByTime(600);
    expect(onFallback).toHaveBeenCalledTimes(1);
  });

  it("cleanup cancels the fallback and removes listeners", () => {
    const { env, count } = fakeEnv();
    const onFallback = vi.fn();
    const cleanup = launchPayApp("toss", { env, onFallback });
    cleanup();
    vi.advanceTimersByTime(PAY_LAUNCH_TIMEOUT_MS * 2);
    expect(onFallback).not.toHaveBeenCalled();
    expect(count("visibilitychange")).toBe(0);
  });

  it("falls back immediately when navigate throws", () => {
    const { env, navigate } = fakeEnv();
    navigate.mockImplementation(() => {
      throw new Error("blocked");
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const onFallback = vi.fn();
    launchPayApp("toss", { env, onFallback });
    expect(onFallback).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(PAY_LAUNCH_TIMEOUT_MS * 2);
    expect(onFallback).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });
});
