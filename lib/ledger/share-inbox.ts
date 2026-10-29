export const SHARE_INBOX_CACHE = "share-inbox-v1";
export const SHARE_TTL_MS = 10 * 60 * 1000;
export const SHARE_MAX_FILE_BYTES = 5 * 1024 * 1024;

export type ShareInboxMeta = {
  id: string;
  title: string;
  text: string;
  url: string;
  hasFile: boolean;
  fileName?: string;
  fileType?: string;
  createdAt: number;
};

export function shareMetaCacheUrl(id: string): string {
  return `/__share/${id}/meta.json`;
}

export function shareFileCacheUrl(id: string): string {
  return `/__share/${id}/file-0`;
}

export function combineShareText(parts: {
  title?: string | null;
  text?: string | null;
  url?: string | null;
}): string {
  return [parts.title, parts.text, parts.url]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000);
}

export async function readShareInbox(
  id: string
): Promise<{ meta: ShareInboxMeta; file: File | null } | null> {
  if (typeof caches === "undefined") return null;
  const cache = await caches.open(SHARE_INBOX_CACHE);
  const metaRes = await cache.match(shareMetaCacheUrl(id));
  if (!metaRes) return null;
  const meta = (await metaRes.json()) as ShareInboxMeta;
  let file: File | null = null;
  if (meta.hasFile) {
    const fileRes = await cache.match(shareFileCacheUrl(id));
    if (fileRes) {
      const blob = await fileRes.blob();
      file = new File([blob], meta.fileName || "shared.jpg", {
        type: meta.fileType || blob.type || "image/jpeg",
        lastModified: meta.createdAt,
      });
    }
  }
  return { meta, file };
}

export async function deleteShareInbox(id: string): Promise<void> {
  if (typeof caches === "undefined") return;
  const cache = await caches.open(SHARE_INBOX_CACHE);
  await cache.delete(shareMetaCacheUrl(id));
  await cache.delete(shareFileCacheUrl(id));
}

export async function purgeExpiredShareInbox(now = Date.now()): Promise<void> {
  if (typeof caches === "undefined") return;
  const cache = await caches.open(SHARE_INBOX_CACHE);
  const keys = await cache.keys();
  await Promise.all(
    keys.map(async (req) => {
      const path = new URL(req.url).pathname;
      if (!path.includes("/__share/") || !path.endsWith("/meta.json")) return;
      const res = await cache.match(req);
      if (!res) {
        await cache.delete(req);
        return;
      }
      try {
        const meta = (await res.json()) as ShareInboxMeta;
        if (now - meta.createdAt > SHARE_TTL_MS) {
          await deleteShareInbox(meta.id);
        }
      } catch {
        await cache.delete(req);
      }
    })
  );
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/** Android installed PWA can receive system shares via SW; iOS does not. */
export function isShareTargetSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (isIosDevice()) return false;
  if (!("serviceWorker" in navigator) || !("caches" in window)) return false;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  return standalone;
}
