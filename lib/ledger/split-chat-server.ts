import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { TABLES } from "@/lib/constants";
import {
  parseSplitChatPayload,
  type SplitChatMessage,
  type SplitChatPayload,
  type SplitChatSenderKind,
} from "@/lib/ledger/split-chat";

const ThreadRow = z.strictObject({
  id: z.string().uuid(),
  trip_id: z.string().uuid(),
});

const MessageRow = z.looseObject({
  id: z.string().uuid(),
  thread_id: z.string().uuid(),
  sender_kind: z.enum(["user", "agent", "system"]),
  sender_user_id: z.string().uuid().nullable().optional(),
  body: z.string(),
  payload: z.unknown().nullable().optional(),
  created_at: z.string(),
});

const MESSAGE_COLUMNS = [
  "id",
  "thread_id",
  "sender_kind",
  "sender_user_id",
  "body",
  "payload",
  "created_at",
].join(", ");

function defaultSenderName(kind: SplitChatSenderKind): string {
  if (kind === "agent") return "MetU AI";
  if (kind === "system") return "시스템";
  return "여행자";
}

export function rowToSplitChatMessage(
  raw: unknown,
  fallbackName?: string
): SplitChatMessage | null {
  const parsed = MessageRow.safeParse(raw);
  if (!parsed.success) return null;
  const row = parsed.data;
  const kind = row.sender_kind;
  const name =
    kind === "user"
      ? fallbackName?.trim() || defaultSenderName(kind)
      : defaultSenderName(kind);
  const payload = parseSplitChatPayload(row.payload ?? null);
  return {
    id: row.id,
    threadId: row.thread_id,
    senderKind: kind,
    senderUserId: row.sender_user_id ?? null,
    senderName: name,
    body: row.body,
    payload,
    createdAt: row.created_at,
  };
}

/**
 * 여행당 1 스레드 ensure. 멤버 세션(RLS)으로 insert/select.
 */
export async function ensureSplitThread(
  supabase: SupabaseClient,
  tripId: string
): Promise<{ ok: true; threadId: string } | { ok: false; error: string }> {
  const { data: existing, error: selErr } = await supabase
    .from(TABLES.tripSplitThreads)
    .select("id, trip_id")
    .eq("trip_id", tripId)
    .maybeSingle();
  if (selErr) {
    console.error("[split-chat] ensure select", selErr.message);
    return { ok: false, error: "load-failed" };
  }
  if (existing) {
    const row = ThreadRow.safeParse(existing);
    if (!row.success) return { ok: false, error: "load-failed" };
    return { ok: true, threadId: row.data.id };
  }

  const { data: inserted, error: insErr } = await supabase
    .from(TABLES.tripSplitThreads)
    .insert({ trip_id: tripId })
    .select("id, trip_id")
    .single();
  if (insErr) {
    // 동시 ensure 시 unique 충돌 → 재조회
    if (/duplicate|unique/i.test(insErr.message)) {
      const { data: again } = await supabase
        .from(TABLES.tripSplitThreads)
        .select("id, trip_id")
        .eq("trip_id", tripId)
        .maybeSingle();
      const row = ThreadRow.safeParse(again);
      if (row.success) return { ok: true, threadId: row.data.id };
    }
    console.error("[split-chat] ensure insert", insErr.message);
    return { ok: false, error: "create-failed" };
  }
  const row = ThreadRow.safeParse(inserted);
  if (!row.success) return { ok: false, error: "create-failed" };
  return { ok: true, threadId: row.data.id };
}

export async function listSplitChatMessages(
  supabase: SupabaseClient,
  threadId: string,
  limit = 100
): Promise<SplitChatMessage[]> {
  const { data, error } = await supabase
    .from(TABLES.tripSplitMessages)
    .select(MESSAGE_COLUMNS)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("[split-chat] list", error.message);
    return [];
  }
  const rows = data ?? [];
  const userIds = [
    ...new Set(
      rows
        .map((r) => {
          const parsed = MessageRow.safeParse(r);
          return parsed.success ? parsed.data.sender_user_id : null;
        })
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const nameByUser = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from(TABLES.profiles)
      .select("id, display_name")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      const id = String((p as { id: string }).id);
      const name = String(
        (p as { display_name?: string | null }).display_name ?? ""
      ).trim();
      if (name) nameByUser.set(id, name);
    }
  }
  return rows
    .map((row) => {
      const parsed = MessageRow.safeParse(row);
      const uid = parsed.success ? parsed.data.sender_user_id : null;
      return rowToSplitChatMessage(
        row,
        uid ? nameByUser.get(uid) : undefined
      );
    })
    .filter((m): m is SplitChatMessage => m != null);
}

export async function insertUserSplitMessage(
  supabase: SupabaseClient,
  args: {
    threadId: string;
    userId: string;
    body: string;
    payload?: SplitChatPayload | null;
  }
): Promise<SplitChatMessage | null> {
  const { data, error } = await supabase
    .from(TABLES.tripSplitMessages)
    .insert({
      thread_id: args.threadId,
      sender_kind: "user",
      sender_user_id: args.userId,
      body: args.body,
      payload: args.payload ?? null,
    })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error || !data) {
    if (error) console.error("[split-chat] insert user", error.message);
    return null;
  }
  return rowToSplitChatMessage(data);
}

/** agent/system — service_role 클라이언트만 사용. */
export async function insertAgentSplitMessage(
  admin: SupabaseClient,
  args: {
    threadId: string;
    senderKind: "agent" | "system";
    body: string;
    payload?: SplitChatPayload | null;
  }
): Promise<SplitChatMessage | null> {
  const { data, error } = await admin
    .from(TABLES.tripSplitMessages)
    .insert({
      thread_id: args.threadId,
      sender_kind: args.senderKind,
      sender_user_id: null,
      body: args.body,
      payload: args.payload ?? null,
    })
    .select(
      "id, thread_id, sender_kind, sender_user_id, body, payload, created_at"
    )
    .single();
  if (error || !data) {
    if (error) console.error("[split-chat] insert agent", error.message);
    return null;
  }
  return rowToSplitChatMessage(data);
}

export async function getSplitMessageById(
  supabase: SupabaseClient,
  messageId: string
): Promise<SplitChatMessage | null> {
  const { data, error } = await supabase
    .from(TABLES.tripSplitMessages)
    .select(MESSAGE_COLUMNS)
    .eq("id", messageId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("[split-chat] get message", error.message);
    return null;
  }
  return rowToSplitChatMessage(data);
}
