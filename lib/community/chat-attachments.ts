import type { SupabaseClient } from "@supabase/supabase-js";

export const PARTY_CHAT_BUCKET = "party-chat";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;

export type PartyChatAttachment =
  | { type: "image"; url: string }
  | { type: "file"; url: string; name: string };

export function isImageChatFile(file: File): boolean {
  if (file.type && IMAGE_MIME_TYPES.has(file.type)) return true;
  return IMAGE_EXT.test(file.name);
}

export function parsePartyChatAttachment(
  message: string
): PartyChatAttachment | null {
  const trimmed = message.trim();
  const fileMatch = trimmed.match(/^📎 (.+)\n(https?:\/\/.+)$/);
  if (fileMatch) {
    return { type: "file", name: fileMatch[1], url: fileMatch[2] };
  }

  if (
    /^https?:\/\/.+/.test(trimmed) &&
    !trimmed.includes("\n") &&
    (IMAGE_EXT.test(trimmed) || trimmed.includes(`/${PARTY_CHAT_BUCKET}/`))
  ) {
    return { type: "image", url: trimmed };
  }

  return null;
}

export function formatPartyChatAttachmentMessage(payload: {
  type: "image" | "file";
  url: string;
  fileName: string;
}): string {
  if (payload.type === "image") return payload.url;
  return `📎 ${payload.fileName}\n${payload.url}`;
}

export async function uploadPartyChatAttachment(
  supabase: SupabaseClient,
  payload: { postId: string; userId: string; file: File }
): Promise<
  | { type: "image" | "file"; url: string; fileName: string }
  | { error: string }
> {
  if (payload.file.size > MAX_FILE_BYTES) {
    return { error: "10MB 이하 파일만 보낼 수 있어요." };
  }

  const extension = payload.file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${payload.postId}/${payload.userId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(PARTY_CHAT_BUCKET)
    .upload(path, payload.file, {
      upsert: false,
      contentType: payload.file.type || undefined,
      cacheControl: "3600",
    });

  if (error) {
    return { error: error.message };
  }

  const { data } = supabase.storage.from(PARTY_CHAT_BUCKET).getPublicUrl(path);
  const fileName = payload.file.name.trim() || "첨부 파일";
  const type = isImageChatFile(payload.file) ? "image" : "file";

  return { type, url: data.publicUrl, fileName };
}
