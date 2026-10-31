/**
 * Real-path smoke: POST synthetic SMS to /api/ingest/sms.
 * Env: DEMO_BASE_URL, METU_INGEST_TOKEN (never logged).
 */
import { createHash } from "node:crypto";

const BASE = process.env.DEMO_BASE_URL?.replace(/\/$/, "");
const TOKEN = process.env.METU_INGEST_TOKEN;

function usage() {
  console.log(
    [
      "Usage: node scripts/demo-ingest.mjs",
      "Env required:",
      "  DEMO_BASE_URL     e.g. https://example.vercel.app",
      "  METU_INGEST_TOKEN bearer token (never logged)",
    ].join("\n")
  );
}

if (!BASE || !TOKEN) {
  usage();
  process.exit(1);
}

/** Inline scenario (mirrors lib/demo/scenario fixtures; dates = now Seoul). */
const FIXTURES = [
  {
    step: 1,
    label: "오사카 호텔 해외승인",
    template:
      "신한(1234)해외승인 홍*동 45,000엔 (JP)HOTEL OSAKA NAMBA {{MMDD}} {{HHMM}} 누적2,345,678원",
    hhmm: "21:40",
  },
  {
    step: 2,
    label: "편의점 소액 엔화",
    template:
      "[Web발신] 신한체크해외승인 홍*동(****) {{MMDD}} {{HHMM}} 12,205 엔 (JP)LAWSON ENT",
    hhmm: "13:23",
  },
  {
    step: 3,
    label: "국내 원화 승인",
    template: "삼성1234승인 홍*동 33,900원 일시불 {{MMDD}} {{HHMM}} 편의점",
    hhmm: "12:00",
  },
  {
    step: 4,
    label: "국내 취소",
    template:
      "[현대카드] 이*름님 {{MMDD}} KCP - 쿠팡 사용 4,930원 취소처리되었습니다",
    hhmm: "15:30",
  },
];

function seoulParts(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).map((p) => [p.type, p.value])
  );
  return {
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
    mmdd: `${Number(parts.month)}/${parts.day}`,
  };
}

function formatTable(rows) {
  const header = ["step", "label", "status", "tripId", "ms", "eventId"].join(
    "\t"
  );
  const lines = rows.map((r) =>
    [
      String(r.step),
      r.label,
      r.duplicate ? `${r.status}(dup)` : r.status,
      r.tripId ?? "-",
      String(r.latencyMs),
      r.eventId ?? "-",
    ].join("\t")
  );
  return [header, ...lines].join("\n");
}

const { mmdd, ymd } = seoulParts();
const rows = [];

for (const f of FIXTURES) {
  const text = f.template
    .replaceAll("{{MMDD}}", mmdd)
    .replaceAll("{{HHMM}}", f.hhmm);
  const receivedAt = `${ymd}T${f.hhmm}:00+09:00`;
  const bucket = new Date().toISOString().slice(0, 16);
  const idempotencyKey = createHash("sha256")
    .update(`demo-ingest-cli|${f.step}|${bucket}`, "utf8")
    .digest("hex");

  const t0 = Date.now();
  let status = "error";
  let tripId = null;
  let eventId = null;
  let duplicate = false;
  try {
    const res = await fetch(`${BASE}/api/ingest/sms`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        app: "데모",
        title: `데모 ${f.step}`,
        receivedAt,
        idempotencyKey,
        source: "sim",
      }),
    });
    const json = await res.json().catch(() => ({}));
    status = typeof json.status === "string" ? json.status : String(res.status);
    tripId = json.tripId ?? null;
    eventId = json.eventId ?? null;
    duplicate = Boolean(json.duplicate);
  } catch {
    status = "network-error";
  }
  rows.push({
    step: f.step,
    label: f.label,
    status,
    tripId,
    latencyMs: Date.now() - t0,
    eventId,
    duplicate,
  });
}

console.log(formatTable(rows));
