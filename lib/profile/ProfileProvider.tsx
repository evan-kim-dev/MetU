"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MOCK_PROFILE, type ProfileUser } from "@/lib/mock/profile";
import {
  loadProfile,
  mergeAuthProfile,
  saveProfile,
  updateProfileData,
  type ProfileUpdate,
} from "./storage";
import {
  ensureProfileInSupabase,
  fetchProfileFromSupabase,
  isStoredAvatar,
  upsertProfileToSupabase,
} from "./supabase";
import type { AuthUser } from "@/lib/auth/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getBrowserSupabase } from "@/lib/supabase/browser";

interface ProfileContextValue {
  profile: ProfileUser;
  isReady: boolean;
  updateProfile: (update: ProfileUpdate) => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

function getAuthSeed(
  user: AuthUser,
  provider: ReturnType<typeof useAuth>["provider"]
) {
  const meta = user.user_metadata ?? {};
  const displayName =
    (typeof meta.name === "string" && meta.name.trim()) ||
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.nickname === "string" && meta.nickname.trim()) ||
    (typeof user.email === "string" && user.email.split("@")[0]) ||
    "여행자";
  const authAvatarUrl =
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta.picture === "string" && meta.picture) ||
    undefined;

  return {
    displayName,
    email: user.email,
    authAvatarUrl,
    membershipLabel: provider === "kakao" ? "카카오 회원" : "회원",
  };
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { isReady: isAuthReady, user, provider } = useAuth();
  const [profile, setProfile] = useState<ProfileUser>(MOCK_PROFILE);
  const [isReady, setIsReady] = useState(false);
  const lastLoadedKey = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userId = user?.id ?? null;
  const isGuest = provider === "guest";
  const storageKey = isGuest ? "guest" : (userId ?? "anonymous");

  useEffect(() => {
    if (!isAuthReady) return;

    let cancelled = false;

    async function load() {
      if (!userId && !isGuest) {
        if (!cancelled) {
          setProfile(MOCK_PROFILE);
          setIsReady(true);
          lastLoadedKey.current = null;
        }
        return;
      }

      if (lastLoadedKey.current === storageKey) return;

      if (isGuest) {
        const saved = loadProfile(null, true);
        if (!cancelled) {
          setProfile(
            updateProfileData(saved, {
              name: "게스트",
              email: "둘러보기 모드 · 로그인하면 동기화돼요",
              membershipLabel: "게스트",
              bio: "",
              homeCity: "",
              styles: [],
              avatarUrl: "",
              customAvatarUrl: null,
            })
          );
          lastLoadedKey.current = storageKey;
          setIsReady(true);
        }
        return;
      }

      if (!user || !userId) return;

      const authSeed = getAuthSeed(user, provider);
      const localSaved = loadProfile(userId, false);
      const mergedLocal = mergeAuthProfile(localSaved, authSeed);

      const supabase = getBrowserSupabase();
      if (!supabase) {
        if (!cancelled) {
          setProfile(mergedLocal);
          lastLoadedKey.current = storageKey;
          setIsReady(true);
        }
        return;
      }

      const remote = await fetchProfileFromSupabase(supabase, userId);
      let nextProfile = remote;

      if (!remote) {
        nextProfile = await ensureProfileInSupabase(
          supabase,
          userId,
          mergedLocal
        );
      } else {
        const shouldMigrateLocal =
          (localSaved.name !== MOCK_PROFILE.name &&
            localSaved.name !== remote.name) ||
          (Boolean(localSaved.customAvatarUrl) &&
            !isStoredAvatar(remote.avatarUrl) &&
            remote.avatarUrl === authSeed.authAvatarUrl) ||
          (Boolean(localSaved.bio) && !remote.bio) ||
          (Boolean(localSaved.homeCity) && !remote.homeCity) ||
          (localSaved.styles.length > 0 &&
            JSON.stringify(localSaved.styles) !== JSON.stringify(remote.styles));

        if (shouldMigrateLocal) {
          nextProfile = {
            ...remote,
            name:
              localSaved.name !== MOCK_PROFILE.name
                ? localSaved.name
                : remote.name,
            avatarUrl: localSaved.customAvatarUrl ?? remote.avatarUrl,
            customAvatarUrl: localSaved.customAvatarUrl ?? remote.customAvatarUrl,
            bio: localSaved.bio || remote.bio,
            homeCity: localSaved.homeCity || remote.homeCity,
            styles:
              localSaved.styles.length > 0 ? localSaved.styles : remote.styles,
          };
          await upsertProfileToSupabase(supabase, userId, nextProfile);
        }
      }

      if (!cancelled) {
        setProfile(nextProfile ?? mergedLocal);
        lastLoadedKey.current = storageKey;
        setIsReady(true);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [isAuthReady, isGuest, provider, storageKey, user, userId]);

  useEffect(() => {
    if (!isReady || !isAuthReady) return;
    if (!userId && !isGuest) return;

    if (isGuest) {
      saveProfile(profile, null, true);
      return;
    }

    if (!userId) return;

    const supabase = getBrowserSupabase();
    if (!supabase) {
      saveProfile(profile, userId, false);
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      void upsertProfileToSupabase(supabase, userId, profile);
    }, 400);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [profile, isReady, isAuthReady, userId, isGuest]);

  const updateProfile = useCallback((update: ProfileUpdate) => {
    setProfile((prev) => updateProfileData(prev, update));
  }, []);

  const value = useMemo(
    () => ({ profile, isReady, updateProfile }),
    [profile, isReady, updateProfile]
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used within ProfileProvider");
  }
  return context;
}
