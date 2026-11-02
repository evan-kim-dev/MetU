"use client";

import { useEffect, useMemo, useState } from "react";
import { getFxRateToKrw } from "@/lib/ledger/fx";
import { normalizeCurrencyCode } from "@/lib/fx/currencies";
import {
  effectiveRate,
  fixedRateMessage,
  validateFixedRate,
  type EffectiveRate,
} from "@/lib/ledger/settle-currency";

export type LiveRateStatus = "idle" | "loading" | "ready" | "error";

export interface SettleReference {
  /** 입력창 값(대문자 3글자까지) */
  currencyText: string;
  setCurrencyText: (text: string) => void;
  /** 유효한 외화 코드. KRW/빈 값/잘못된 값이면 null → 원화만 보여준다. */
  currency: string | null;
  fixedText: string;
  setFixedText: (text: string) => void;
  /** 고정 환율 입력이 잘못됐을 때의 한국어 안내 */
  fixedError: string | null;
  liveRate: number | null;
  liveStatus: LiveRateStatus;
  effective: EffectiveRate | null;
  includeInShare: boolean;
  setIncludeInShare: (v: boolean) => void;
  /** 공유 문구에 넣을 환산 정보. 체크하지 않았거나 환율이 없으면 null(기본). */
  shareConversion: { currency: string; rate: number } | null;
}

/**
 * 정산 화면의 "참고용 통화 환산" 상태. 환율은 `/api/fx`(getFxRateToKrw)로만 가져오고,
 * 사용자가 고정한 환율이 있으면 그 값을 우선한다. 저장 금액(KRW)은 건드리지 않는다.
 */
export function useSettleReference(): SettleReference {
  const [currencyText, setCurrencyTextState] = useState("");
  const [fixedText, setFixedText] = useState("");
  const [includeInShare, setIncludeInShare] = useState(false);
  const [live, setLive] = useState<{
    code: string;
    rate: number | null;
    status: LiveRateStatus;
  }>({ code: "", rate: null, status: "idle" });

  const normalized = normalizeCurrencyCode(currencyText);
  const currency = normalized && normalized !== "KRW" ? normalized : null;

  useEffect(() => {
    if (!currency) return;
    let cancelled = false;
    setLive({ code: currency, rate: null, status: "loading" });
    void getFxRateToKrw(currency).then((res) => {
      if (cancelled) return;
      if (!res) {
        console.error("[settle-reference] fx rate unavailable", currency);
        setLive({ code: currency, rate: null, status: "error" });
        return;
      }
      setLive({ code: currency, rate: res.krw, status: "ready" });
    });
    return () => {
      cancelled = true;
    };
  }, [currency]);

  // 통화가 바뀌면 이전 통화의 라이브 환율/고정 환율은 쓰지 않는다.
  const liveForCurrency = currency && live.code === currency ? live : null;
  const liveRate = liveForCurrency?.rate ?? null;
  const liveStatus: LiveRateStatus = currency
    ? (liveForCurrency?.status ?? "loading")
    : "idle";

  const fixedError = useMemo(() => {
    if (!fixedText.trim()) return null;
    const v = validateFixedRate(fixedText, liveRate);
    return v.ok ? null : fixedRateMessage(v.reason);
  }, [fixedText, liveRate]);

  const effective = useMemo(
    () =>
      currency ? effectiveRate({ liveRate, fixedRate: fixedText }) : null,
    [currency, liveRate, fixedText]
  );

  const shareConversion =
    includeInShare && currency && effective
      ? { currency, rate: effective.rate }
      : null;

  function setCurrencyText(text: string) {
    setCurrencyTextState(text.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 3));
    // 다른 통화로 바꾸면 이전 고정 환율은 비운다.
    setFixedText("");
  }

  return {
    currencyText,
    setCurrencyText,
    currency,
    fixedText,
    setFixedText,
    fixedError,
    liveRate,
    liveStatus,
    effective,
    includeInShare,
    setIncludeInShare,
    shareConversion,
  };
}
