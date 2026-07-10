import type { SupabaseClient } from "@supabase/supabase-js";

export const COMMUNITY_POST_BUCKET = "community-posts";
export const MAX_POST_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function isCommunityPostImage(file: File): boolean {
  if (file.type && IMAGE_MIME_TYPES.has(file.type)) return true;
  return /\.(jpe?g|png|gif|webp)$/i.test(file.name);
}

export async function uploadCommunityPostImage(
  supabase: SupabaseClient,
  userId: string,
  file: File
): Promise<{ url: string } | { error: string }> {
  if (!isCommunityPostImage(file)) {
    return { error: "JPG, PNG, WEBP, GIF 이미지만 업로드할 수 있어요." };
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "사진은 5MB 이하만 업로드할 수 있어요." };
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(COMMUNITY_POST_BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
      cacheControl: "3600",
    });

  if (error) {
    return { error: error.message };
  }

  const { data } = supabase.storage.from(COMMUNITY_POST_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}
