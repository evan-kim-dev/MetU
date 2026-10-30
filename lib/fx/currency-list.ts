"use client";

import { useEffect, useState } from "react";

export type CurrencyOption = { code: string; label: string };

/** 인기 통화 — SSR/하이드레이션 공통 정적 목록 (상단 고정). */
export const POPULAR_CURRENCY_CODES = [
  "KRW",
  "USD",
  "JPY",
  "EUR",
  "THB",
  "VND",
  "TWD",
  "GBP",
  "CNY",
  "HKD",
  "SGD",
  "AUD",
  "CAD",
] as const;

const displayNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["ko"], { type: "currency" })
    : null;

function labelFor(code: string): string {
  try {
    const name = displayNames?.of(code);
    return name ? `${code} · ${name}` : code;
  } catch {
    return code;
  }
}

export function getPopularCurrencyOptions(): CurrencyOption[] {
  return POPULAR_CURRENCY_CODES.map((code) => ({
    code,
    label: labelFor(code),
  }));
}

/**
 * Intl.supportedValuesOf('currency') 기반 전체 목록.
 * 인기 통화를 상단에 고정하고 나머지는 코드 순.
 */
export function getAllCurrencyOptions(): CurrencyOption[] {
  const popular = new Set<string>(POPULAR_CURRENCY_CODES);
  const pinned = getPopularCurrencyOptions();

  let rest: string[] = [];
  try {
    if (
      typeof Intl !== "undefined" &&
      "supportedValuesOf" in Intl &&
      typeof Intl.supportedValuesOf === "function"
    ) {
      rest = Intl.supportedValuesOf("currency").filter(
        (c) => !popular.has(c)
      );
    }
  } catch {
    rest = [];
  }

  rest.sort((a, b) => a.localeCompare(b));
  return [
    ...pinned,
    ...rest.map((code) => ({ code, label: labelFor(code) })),
  ];
}

/**
 * SSR/첫 페인트는 인기 목록만, useEffect 이후 전체 목록.
 * 서버·클라이언트 초기 렌더를 맞춰 하이드레이션 불일치를 막는다.
 */
export function useCurrencyOptions(): CurrencyOption[] {
  const [options, setOptions] = useState(getPopularCurrencyOptions);
  useEffect(() => {
    setOptions(getAllCurrencyOptions());
  }, []);
  return options;
}
