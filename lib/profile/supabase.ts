import type { SupabaseClient } from "@supabase/supabase-js";
import type { TravelStyle } from "@/components/onboarding/types";
import { TABLES } from "@/lib/constants";
import { MOCK_PROFILE, type ProfileUser } from "@/lib/mock/profile";
import type { ProfileUpdate } from "./storage";

const AVATAR_BUCKET = "avatars";

export interface ProfileRow {
  id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  bio: string;
  home_city: string;
  travel_styles: TravelStyle[] | null;
  membership_label: string;
}

function rowToProfile(row: ProfileRow): ProfileUser {
  return {
    name: row.display_name || MOCK_PROFILE.name,
    email: row.email ?? MOCK_PROFILE.email,
    avatarUrl: row.avatar_url ?? MOCK_PROFILE.avatarUrl,
    membershipLabel: row.membership_label || "회원",
    styles: Array.isArray(row.travel_styles) ? row.travel_styles : MOCK_PROFILE.styles,
    bio: row.bio || undefined,
    homeCity: row.home_city || undefined,
  };
}

function profileToRow(profile: ProfileUser, userId: string): Omit<ProfileRow, "id"> {
  return {
    display_name: profile.name,
    email: profile.email,
    avatar_url: profile.customAvatarUrl ?? profile.avatarUrl,
    bio: profile.bio ?? "",
    home_city: profile.homeCity ?? "",
    travel_styles: profile.styles,
    membership_label: profile.membershipLabel,
  };
}

export async function fetchProfileFromSupabase(
  supabase: SupabaseClient,
  userId: string
): Promise<ProfileUser | null> {
  const { data, error } = await supabase
    .from(TABLES.profiles)
    .select(
      "id, display_name, email, avatar_url, bio, home_city, travel_styles, membership_label"
    )
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return rowToProfile(data as ProfileRow);
}

export async function upsertProfileToSupabase(
  supabase: SupabaseClient,
  userId: string,
  profile: ProfileUser
): Promise<boolean> {
  const row = profileToRow(profile, userId);
  const { error } = await supabase.from(TABLES.profiles).upsert({
    id: userId,
    ...row,
  });

  return !error;
}

export async function ensureProfileInSupabase(
  supabase: SupabaseClient,
  userId: string,
  seed: ProfileUser
): Promise<ProfileUser> {
  const existing = await fetchProfileFromSupabase(supabase, userId);
  if (existing) return existing;

  const ok = await upsertProfileToSupabase(supabase, userId, seed);
  if (!ok) return seed;

  return (await fetchProfileFromSupabase(supabase, userId)) ?? seed;
}

export function applyProfileUpdate(
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
    styles: update.styles ?? profile.styles,
    avatarUrl: nextAvatarUrl,
    customAvatarUrl:
      update.customAvatarUrl !== undefined
        ? update.customAvatarUrl
        : profile.customAvatarUrl,
  };
}

export async function uploadProfileAvatar(
  supabase: SupabaseClient,
  userId: string,
  file: File
): Promise<{ publicUrl: string } | { error: string }> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/avatar.${extension}`;

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: "3600",
    });

  if (error) {
    return { error: error.message };
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return { publicUrl: `${data.publicUrl}?t=${Date.now()}` };
}

export async function removeProfileAvatar(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { data } = await supabase.storage.from(AVATAR_BUCKET).list(userId);
  const files = data ?? [];
  if (files.length === 0) return;

  await supabase.storage
    .from(AVATAR_BUCKET)
    .remove(files.map((file) => `${userId}/${file.name}`));
}

export function isStoredAvatar(url?: string | null): boolean {
  return Boolean(url && url.includes("/storage/v1/object/public/avatars/"));
}
