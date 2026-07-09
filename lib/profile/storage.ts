import type { TravelStyle } from "@/components/onboarding/types";
import { STORAGE_KEYS } from "@/lib/constants";
import { MOCK_PROFILE, type ProfileUser } from "@/lib/mock/profile";

const LEGACY_STORAGE_KEY = STORAGE_KEYS.profile;

export type ProfileUpdate = Partial<
  Pick<
    ProfileUser,
    | "name"
    | "email"
    | "avatarUrl"
    | "customAvatarUrl"
    | "membershipLabel"
    | "styles"
    | "bio"
    | "homeCity"
  >
>;

export function getProfileStorageKey(
  userId: string | null,
  isGuest: boolean
): string {
  if (isGuest) return `${LEGACY_STORAGE_KEY}-guest`;
  if (userId) return `${LEGACY_STORAGE_KEY}-${userId}`;
  return LEGACY_STORAGE_KEY;
}

function parseProfile(raw: string): ProfileUser | null {
  try {
    const parsed = JSON.parse(raw) as ProfileUser;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      ...MOCK_PROFILE,
      ...parsed,
      name: (parsed.name ?? MOCK_PROFILE.name).trim() || MOCK_PROFILE.name,
      styles: Array.isArray(parsed.styles) ? parsed.styles : MOCK_PROFILE.styles,
    };
  } catch {
    return null;
  }
}

/** 사용자(또는 게스트)별 저장 프로필 불러오기 */
export function loadProfile(
  userId: string | null,
  isGuest: boolean
): ProfileUser {
  if (typeof window === "undefined") return MOCK_PROFILE;

  const key = getProfileStorageKey(userId, isGuest);
  const raw = localStorage.getItem(key);
  if (raw) {
    const parsed = parseProfile(raw);
    if (parsed) return parsed;
  }

  // 예전 단일 키 데이터가 있으면 로그인 사용자에게 1회 마이그레이션
  if (userId && !isGuest) {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const parsed = parseProfile(legacy);
      if (parsed) {
        saveProfile(parsed, userId, false);
        return parsed;
      }
    }
  }

  return { ...MOCK_PROFILE };
}

export function saveProfile(
  profile: ProfileUser,
  userId: string | null,
  isGuest: boolean
): void {
  if (typeof window === "undefined") return;
  if (!userId && !isGuest) return;

  const key = getProfileStorageKey(userId, isGuest);
  localStorage.setItem(key, JSON.stringify(profile));
}

export function updateProfileData(
  profile: ProfileUser,
  update: ProfileUpdate
): ProfileUser {
  const nextAvatarUrl =
    update.customAvatarUrl !== undefined
      ? update.customAvatarUrl ?? profile.avatarUrl
      : update.avatarUrl ?? profile.avatarUrl;

  return {
    ...profile,
    ...update,
    name: (update.name ?? profile.name).trim() || profile.name,
    styles: (update.styles as TravelStyle[] | undefined) ?? profile.styles,
    avatarUrl: nextAvatarUrl,
  };
}

export function mergeAuthProfile(
  saved: ProfileUser,
  input: {
    displayName: string;
    email?: string | null;
    authAvatarUrl?: string;
    membershipLabel: string;
  }
): ProfileUser {
  const hasCustomAvatar = Boolean(saved.customAvatarUrl);

  return updateProfileData(saved, {
    // 저장된 닉네임·소개·도시·취향은 유지, 없을 때만 카카오 정보로 채움
    name: saved.name && saved.name !== MOCK_PROFILE.name ? saved.name : input.displayName,
    email: input.email ?? saved.email,
    membershipLabel: input.membershipLabel,
    avatarUrl: hasCustomAvatar
      ? saved.customAvatarUrl!
      : saved.avatarUrl && saved.avatarUrl !== MOCK_PROFILE.avatarUrl
        ? saved.avatarUrl
        : input.authAvatarUrl ?? saved.avatarUrl,
  });
}
