import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatPartyChatAttachmentMessage,
  isImageChatFile,
  parsePartyChatAttachment,
  type PartyChatAttachment,
} from "@/lib/community/chat-attachments";

export const DM_CHAT_BUCKET = "dm-chat";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export type DmChatAttachment = PartyChatAttachment;

export function parseDmChatAttachment(message: string): DmChatAttachment | null {
  const parsed = parsePartyChatAttachment(message);
  if (parsed) return parsed;

  const trimmed = message.trim();
  if (
    /^https?:\/\/.+/.test(trimmed) &&
    !trimmed.includes("\n") &&
    trimmed.includes(`/${DM_CHAT_BUCKET}/`)
  ) {
    return { type: "image", url: trimmed };
  }
  return null;
}

export function formatDmChatAttachmentMessage(payload: {
  type: "image" | "file";
  url: string;
  fileName: string;
}): string {
  return formatPartyChatAttachmentMessage(payload);
}

export async function uploadDmChatAttachment(
  supabase: SupabaseClient,
  payload: { threadId: string; userId: string; file: File }
): Promise<
  | { type: "image" | "file"; url: string; fileName: string }
  | { error: string }
> {
  if (payload.file.size > MAX_FILE_BYTES) {
    return { error: "10MB 이하 파일만 보낼 수 있어요." };
  }

  const extension = payload.file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${payload.threadId}/${payload.userId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(DM_CHAT_BUCKET)
    .upload(path, payload.file, {
      upsert: false,
      contentType: payload.file.type || undefined,
      cacheControl: "3600",
    });

  if (error) {
    return { error: error.message };
  }

  const { data } = supabase.storage.from(DM_CHAT_BUCKET).getPublicUrl(path);
  const fileName = payload.file.name.trim() || "첨부 파일";
  const type = isImageChatFile(payload.file) ? "image" : "file";

  return { type, url: data.publicUrl, fileName };
}

export function dmMessagePreview(message: string): string {
  const attachment = parseDmChatAttachment(message);
  if (attachment?.type === "image") return "사진을 보냈어요";
  if (attachment?.type === "file") return `파일을 보냈어요 · ${attachment.name}`;
  const trimmed = message.trim().replace(/\s+/g, " ");
  return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
}
