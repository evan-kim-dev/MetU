import type { SupabaseClient } from "@supabase/supabase-js";

export const SPLIT_CHAT_ATTACH_BUCKET = "trip-split-chat";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;

export function isSplitChatImageFile(file: File): boolean {
  if (file.type && IMAGE_MIME_TYPES.has(file.type)) return true;
  return IMAGE_EXT.test(file.name);
}

export async function uploadSplitChatAttachment(
  supabase: SupabaseClient,
  payload: { tripId: string; userId: string; file: File }
): Promise<
  | { kind: "image" | "file"; url: string; fileName: string }
  | { error: string }
> {
  if (payload.file.size > MAX_FILE_BYTES) {
    return { error: "10MB 이하 파일만 보낼 수 있어요." };
  }

  const extension = payload.file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${payload.tripId}/${payload.userId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(SPLIT_CHAT_ATTACH_BUCKET)
    .upload(path, payload.file, {
      upsert: false,
      contentType: payload.file.type || undefined,
      cacheControl: "3600",
    });

  if (error) {
    console.error("[split-chat] upload", error.message);
    return { error: "파일을 올리지 못했어요. 다시 시도해 주세요." };
  }

  const { data } = supabase.storage
    .from(SPLIT_CHAT_ATTACH_BUCKET)
    .getPublicUrl(path);
  const fileName = payload.file.name.trim() || "첨부 파일";
  const kind = isSplitChatImageFile(payload.file) ? "image" : "file";

  return { kind, url: data.publicUrl, fileName };
}
