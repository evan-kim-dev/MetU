import { NextResponse } from "next/server";
import { readJsonLimited } from "@/lib/agent/body-limit";
import { parseExpenseTextOut } from "@/lib/ai/contracts";
import { aiChatOrNull } from "@/lib/ai/chat-client";
import { TABLES } from "@/lib/constants";
import {
  parseCardSms,
  redactSms,
  splitSmsBatch,
} from "@/lib/ledger/sms/parse";
import { guardApi } from "@/lib/security/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { todayIsoDate } from "@/lib/shared/dates";

export const maxDuration = 60;

type Body = {
  tripId?: string;
  text?: string;
  source?: "sms" | "push" | "text" | "voice";
};

type Member = { id: string; displayName: string; userId: string | null };

type Draft = {
  origin: "rule" | "llm";
  source: string;
  merchant: string | null;
  merchantKo: string | null;
  amount: number | null;
  currency: string | null;
  spentOn: string | null;
  paidAt: string | null;
  timeIsEstimated: boolean;
  category: string;
  paymentMethod: "card" | "cash" | "transfer" | null;
  payerMemberId: string | null;
  participantMemberIds: string[] | null;
  splitType: "equal" | "fixed" | "ratio" | null;
  confidence: number;
  warnings: string[];
  kind: "approval" | "cancel" | "unknown";
};

function matchMemberId(
  name: string | null | undefined,
  members: Member[]
): string | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  if (!n) return null;
  if (n === "나" || n === "내가" || n === "저") {
    return members.find((m) => m.userId)?.id ?? null;
  }
  const hit = members.find((m) => m.displayName.toLowerCase() === n);
  return hit?.id ?? null;
}

function guessCategory(merchant: string | null): string {
  if (!merchant) return "기타";
  const m = merchant.toUpperCase();
  if (/HOTEL|숙소|AIRBNB/.test(m)) return "숙소";
  if (/UBER|TAXI|지하철|버스|교통|JR|metro/i.test(m)) return "교통";
  if (/LAWSON|7-?ELEVEN|편의|CAFE|RESTAURANT|라멘|식/.test(m)) return "식비";
  if (/AMAZON|UNIQLO|쇼핑|STORE/.test(m)) return "쇼핑";
  return "기타";
}

export async function POST(request: Request) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  const { identity, clientKey } = guard;

  if (identity.kind === "guest") {
    return NextResponse.json({ error: "login-required" }, { status: 401 });
  }

  const limited = await readJsonLimited(request, 16_384);
  if (!limited.ok) return limited.response;
  const body = limited.json as Body;

  const tripId = body.tripId?.trim() ?? "";
  const text = (body.text ?? "").trim();
  const source = body.source ?? "text";
  if (!tripId || !text || text.length > 2000) {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  const supabase = await createServerSupabase();

  const { data: tripMeta, error: tripErr } = await supabase.rpc(
    "get_ledger_trip",
    { p_trip_id: tripId }
  );
  if (tripErr || !tripMeta) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const meta = tripMeta as {
    startDate?: string | null;
    endDate?: string | null;
    localCurrency?: string | null;
    dateRange?: string | null;
  };

  const { data: memberRows } = await supabase
    .from(TABLES.tripMembers)
    .select("id, display_name, user_id")
    .eq("trip_id", tripId);

  const members: Member[] = (memberRows ?? []).map((r) => ({
    id: r.id as string,
    displayName: r.display_name as string,
    userId: (r.user_id as string | null) ?? null,
  }));

  const today = todayIsoDate();
  const smsCtx = {
    today,
    tripStart: meta.startDate ?? null,
    tripEnd: meta.endDate ?? null,
  };
  const defaultCurrency = (meta.localCurrency ?? "KRW").toUpperCase();
  const memberNames = members.map((m) => m.displayName).join(", ");

  const chunks = splitSmsBatch(text).slice(0, 5);
  const drafts: Draft[] = [];
  const rejected: Array<{ reason: string }> = [];

  for (const chunk of chunks) {
    const ruled = parseCardSms(chunk, smsCtx);
    if (ruled.kind === "cancel") {
      drafts.push({
        origin: "rule",
        source,
        merchant: ruled.merchant,
        merchantKo: null,
        amount: ruled.amount,
        currency: ruled.currency,
        spentOn: ruled.spentOn,
        paidAt: ruled.paidAt,
        timeIsEstimated: ruled.timeIsEstimated,
        category: "기타",
        paymentMethod: "card",
        payerMemberId: null,
        participantMemberIds: null,
        splitType: null,
        confidence: ruled.confidence,
        warnings: [...ruled.warnings, "취소 문자"],
        kind: "cancel",
      });
      continue;
    }

    if (ruled.ok && ruled.confidence >= 0.8 && ruled.kind === "approval") {
      drafts.push({
        origin: "rule",
        source,
        merchant: ruled.merchant,
        merchantKo: null,
        amount: ruled.amount,
        currency: ruled.currency,
        spentOn: ruled.spentOn,
        paidAt: ruled.paidAt,
        timeIsEstimated: ruled.timeIsEstimated,
        category: guessCategory(ruled.merchant),
        paymentMethod: "card",
        payerMemberId:
          members.find((m) => m.userId === identity.userId)?.id ?? null,
        participantMemberIds: members.map((m) => m.id),
        splitType: "equal",
        confidence: ruled.confidence,
        warnings: ruled.warnings,
        kind: "approval",
      });
      continue;
    }

    const redacted = redactSms(chunk);
    const prompt = [
      `today=${today}`,
      `tripStart=${meta.startDate ?? ""}`,
      `tripEnd=${meta.endDate ?? ""}`,
      `defaultCurrency=${defaultCurrency}`,
      `members=${memberNames}`,
      `source=${source}`,
      "---",
      redacted,
    ].join("\n");

    const chat = await aiChatOrNull({
      mode: "expense_text",
      prompt,
      clientKey,
    });
    if (!chat) {
      rejected.push({ reason: "llm-unavailable" });
      continue;
    }
    const parsed = parseExpenseTextOut(chat.content);
    if (!parsed || !parsed.isExpense) {
      rejected.push({ reason: "not-expense" });
      continue;
    }

    const payerMemberId = matchMemberId(parsed.payerName, members);
    const participantMemberIds = parsed.participantNames
      .map((n) => matchMemberId(n, members))
      .filter((id): id is string => Boolean(id));

    let paidAt: string | null = null;
    if (parsed.spentDate) {
      const t = parsed.spentTime ?? "12:00";
      paidAt = `${parsed.spentDate}T${t.length === 5 ? t : "12:00"}:00+09:00`;
    }

    drafts.push({
      origin: "llm",
      source,
      merchant: parsed.merchant,
      merchantKo: parsed.merchantKo,
      amount: parsed.amount,
      currency: parsed.currency,
      spentOn: parsed.spentDate,
      paidAt,
      timeIsEstimated: !parsed.spentTime,
      category: parsed.category,
      paymentMethod: parsed.paymentMethod,
      payerMemberId,
      participantMemberIds:
        participantMemberIds.length > 0
          ? participantMemberIds
          : members.map((m) => m.id),
      splitType: parsed.splitHint,
      confidence: parsed.confidence,
      warnings: parsed.warnings,
      kind: "approval",
    });
  }

  // 로그에 원문 금지 — 길이/건수만
  console.info(
    JSON.stringify({
      route: "ledger/parse-text",
      textLen: text.length,
      chunks: chunks.length,
      drafts: drafts.length,
      rejected: rejected.length,
    })
  );

  return NextResponse.json({ drafts, rejected });
}
