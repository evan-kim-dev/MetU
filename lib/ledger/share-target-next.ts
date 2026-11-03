import { safeNextPath } from "@/lib/security/safe-next";

/**
 * 게스트가 공유 페이로드를 잃지 않도록 로그인 next 경로를 만들어요.
 * id / text 쿼리를 유지하고, 그 외는 /share-target 만.
 */
export function shareTargetLoginNext(
  search: string | URLSearchParams
): string {
  const params =
    typeof search === "string"
      ? new URLSearchParams(
          search.startsWith("?") ? search.slice(1) : search
        )
      : search;
  const id = params.get("id")?.trim();
  if (id && /^[\w-]{1,128}$/.test(id)) {
    return safeNextPath(
      `/share-target?id=${encodeURIComponent(id)}`,
      "/share-target"
    );
  }
  const text = params.get("text")?.trim();
  if (text) {
    const clipped = text.slice(0, 500);
    return safeNextPath(
      `/share-target?text=${encodeURIComponent(clipped)}`,
      "/share-target"
    );
  }
  return "/share-target";
}
