"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatKRW } from "@/lib/shared/format";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Shared = {
  destination: string;
  dateRange: string;
  version: number;
  status: string;
  completedAt: string | null;
  members: Array<{ id: string; displayName: string }>;
  transfers: Array<{ from: string; to: string; krw: number; status: string }>;
  totals: { totalKrw: number };
};

export default function SharedSettlementPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<Shared | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    void (async () => {
      const { data: row, error: err } = await supabase.rpc(
        "get_shared_settlement",
        { p_token: token }
      );
      if (err || !row) {
        setError("정산을 찾을 수 없어요.");
        return;
      }
      setData(row as Shared);
    })();
  }, [token]);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  if (error) {
    return <p className="p-8 text-center text-sm text-danger">{error}</p>;
  }
  if (!data) {
    return <p className="p-8 text-center text-sm text-ink-muted">불러오는 중…</p>;
  }

  const name = (id: string) =>
    data.members.find((m) => m.id === id)?.displayName ?? "?";

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="text-xl font-extrabold text-ink-heading">정산 공유</h1>
      <p className="mt-1 text-sm text-ink-body">
        {data.destination} · {data.dateRange}
      </p>
      <p className="text-xs text-ink-muted">
        v{data.version} · {data.status}
        {data.completedAt ? ` · 완료 ${data.completedAt}` : ""}
      </p>
      <p className="mt-3 text-sm font-bold">
        총 {formatKRW(data.totals?.totalKrw ?? 0)}
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {data.transfers.map((t, i) => (
          <li
            key={i}
            className="rounded-xl bg-surface-soft px-3 py-2 text-sm"
          >
            {name(t.from)} → {name(t.to)}{" "}
            <strong>{formatKRW(t.krw)}</strong>{" "}
            <span className="text-xs text-ink-muted">({t.status})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
