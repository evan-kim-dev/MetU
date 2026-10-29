"use client";

import { useCallback, useEffect, useState } from "react";

type TokenRow = {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
};

export function ConnectIngestPanel({ tripId }: { tripId?: string | null }) {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [plainOnce, setPlainOnce] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openIos, setOpenIos] = useState(false);
  const [openAndroid, setOpenAndroid] = useState(false);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://met-u.vercel.app";
  const endpoint = `${origin}/api/ingest/sms`;

  const load = useCallback(async () => {
    const qs =
      tripId != null && tripId.length > 0
        ? `?tripId=${encodeURIComponent(tripId)}`
        : "";
    const res = await fetch(`/api/agent/tokens${qs}`);
    if (!res.ok) {
      setError("토큰 목록을 불러오지 못했어요");
      return;
    }
    const json = (await res.json()) as { tokens: TokenRow[] };
    setTokens(json.tokens ?? []);
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createToken() {
    setBusy(true);
    setError(null);
    setPlainOnce(null);
    try {
      const body: { label: string; tripId?: string } = { label: "자동 수집" };
      if (tripId) body.tripId = tripId;
      const res = await fetch("/api/agent/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !json.token) {
        setError(json.error ?? "토큰을 만들지 못했어요");
        return;
      }
      setPlainOnce(json.token);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/agent/tokens/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  const curl =
    plainOnce != null
      ? `curl -X POST "${endpoint}" -H "Authorization: Bearer ${plainOnce}" -H "content-type: application/json" -d "{\\"text\\":\\"테스트 승인 10,000원\\"}"`
      : `curl -X POST "${endpoint}" -H "Authorization: Bearer <토큰>" -H "content-type: application/json" -d "{\\"text\\":\\"테스트 승인 10,000원\\"}"`;

  return (
    <div className="space-y-6 px-4 py-6 text-sm text-zinc-800">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">자동 수집 연결</h1>
        <p className="text-zinc-600">
          {tripId
            ? "카드 문자를 이 여행 원장으로 보내요. 토큰은 한 번만 보여 드려요."
            : "카드 알림을 먼저 연결해요. 여행은 나중에 만들어도 이어서 기록돼요."}
        </p>
      </header>

      <section className="space-y-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void createToken()}
          className="min-h-11 w-full rounded-xl bg-zinc-900 px-4 py-3 text-white disabled:opacity-50"
        >
          수집 토큰 만들기
        </button>
        {error ? <p className="text-red-600">{error}</p> : null}
        {plainOnce ? (
          <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-amber-950">
            <p className="font-medium">다시 볼 수 없어요 — 지금 복사하세요</p>
            <code className="block break-all text-xs">{plainOnce}</code>
            <button
              type="button"
              className="min-h-11 rounded-lg bg-white px-3 py-2"
              onClick={() => void navigator.clipboard.writeText(plainOnce)}
            >
              토큰 복사
            </button>
          </div>
        ) : null}
        <div className="space-y-1 rounded-xl bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">엔드포인트</p>
          <code className="block break-all text-xs">{endpoint}</code>
          <button
            type="button"
            className="min-h-11 rounded-lg bg-white px-3 py-2"
            onClick={() => void navigator.clipboard.writeText(curl)}
          >
            테스트 curl 복사
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">안내</h2>
        <p className="text-xs text-zinc-500">
          iPhone은 카드 앱 푸시 알림은 단축어로 가져올 수 없고 SMS/iMessage만
          돼요.
        </p>
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-between rounded-xl border border-zinc-200 px-3"
          onClick={() => setOpenIos((v) => !v)}
        >
          <span>iPhone 단축어</span>
          <span>{openIos ? "접기" : "펼치기"}</span>
        </button>
        {openIos ? (
          <ol className="list-decimal space-y-1 pl-5 text-zinc-600">
            <li>단축어 → 자동화 → 새 자동화 → 메시지</li>
            <li>
              &quot;메시지에 다음이 포함&quot; 필터에 공백 한 칸, 즉시 실행
            </li>
            <li>
              URL 콘텐츠 가져오기 POST, JSON{" "}
              {`{ "text": 메시지, "sender": 보낸사람, "source": "sms_shortcut" }`}
            </li>
            <li>Authorization: Bearer 토큰</li>
          </ol>
        ) : null}
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-between rounded-xl border border-zinc-200 px-3"
          onClick={() => setOpenAndroid((v) => !v)}
        >
          <span>Android (예시)</span>
          <span>{openAndroid ? "접기" : "펼치기"}</span>
        </button>
        {openAndroid ? (
          <p className="text-zinc-600">
            MacroDroid 등 자동화 앱의 문자/알림 수신 트리거 → HTTP 요청으로 같은
            엔드포인트에 POST (실기기 검증 전 예시예요).
          </p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">토큰 목록</h2>
        {tokens.length === 0 ? (
          <p className="text-zinc-500">아직 토큰이 없어요.</p>
        ) : (
          <ul className="space-y-2">
            {tokens.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 px-3 py-2"
              >
                <div>
                  <p>{t.label || "이름 없음"}</p>
                  <p className="text-xs text-zinc-500">
                    {t.revoked
                      ? "폐기됨"
                      : t.lastUsedAt
                        ? `최근 사용 ${new Date(t.lastUsedAt).toLocaleString("ko-KR")}`
                        : "미사용"}
                  </p>
                </div>
                {!t.revoked ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="min-h-11 rounded-lg px-3 text-red-600"
                    onClick={() => void revoke(t.id)}
                  >
                    폐기
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
