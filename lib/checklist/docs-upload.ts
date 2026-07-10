import type { SupabaseClient } from "@supabase/supabase-js";

export const CHECKLIST_DOCS_BUCKET = "checklist-docs";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_LOCAL_FALLBACK_BYTES = 2 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

export function isChecklistDocFile(file: File): boolean {
  if (file.type && ALLOWED_MIME_TYPES.has(file.type)) return true;
  return /\.(jpe?g|png|gif|webp|pdf)$/i.test(file.name);
}

export async function fileToDataUrl(file: File): Promise<string | { error: string }> {
  if (file.size > MAX_LOCAL_FALLBACK_BYTES) {
    return { error: "오프라인 저장은 2MB 이하 파일만 가능해요. 로그인 후 다시 시도해 주세요." };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      resolve({ error: "파일을 읽지 못했어요." });
    };
    reader.onerror = () => resolve({ error: "파일을 읽지 못했어요." });
    reader.readAsDataURL(file);
  });
}

export async function uploadChecklistDocFile(
  supabase: SupabaseClient,
  payload: {
    userId: string;
    countryId: string;
    docId: string;
    file: File;
  }
): Promise<{ url: string } | { error: string }> {
  if (!isChecklistDocFile(payload.file)) {
    return { error: "JPG, PNG, WEBP, GIF, PDF만 업로드할 수 있어요." };
  }

  if (payload.file.size > MAX_IMAGE_BYTES) {
    return { error: "파일은 5MB 이하만 업로드할 수 있어요." };
  }

  const extension = payload.file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${payload.userId}/${payload.countryId}/${payload.docId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(CHECKLIST_DOCS_BUCKET)
    .upload(path, payload.file, {
      upsert: false,
      contentType: payload.file.type || undefined,
      cacheControl: "3600",
    });

  if (error) {
    return { error: error.message };
  }

  const { data } = supabase.storage.from(CHECKLIST_DOCS_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}
