"use client";

import { useEffect, useRef, useState } from "react";
import {
  CURRENCY_OPTIONS,
  MOCK_PROFILE,
} from "@/lib/mock/profile";
import { useAuth } from "@/lib/auth/AuthProvider";
import { clearGuestSession } from "@/lib/auth/guest-session";
import { STORAGE_KEYS } from "@/lib/constants";
import { useProfile } from "@/lib/profile/ProfileProvider";
import {
  isStoredAvatar,
  removeProfileAvatar,
  uploadProfileAvatar,
} from "@/lib/profile/supabase";
import {
  clearSupabaseAuthCookies,
  clearSupabaseAuthStorage,
  getBrowserSupabase,
  resetBrowserSupabase,
} from "@/lib/supabase/browser";
import type { TravelStyle } from "@/components/onboarding/types";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export function useProfileContent() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { logout, provider, user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const [selectedStyles, setSelectedStyles] = useState<TravelStyle[]>(
    profile.styles
  );
  const [styleInsight, setStyleInsight] = useState(
    "관심 스타일을 고르면 맞춤 여행지를 추천해 드려요."
  );
  const [styleInsightLoading, setStyleInsightLoading] = useState(false);
  const [currency, setCurrency] =
    useState<(typeof CURRENCY_OPTIONS)[number]>("KRW");
  const [notifications, setNotifications] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(profile.name);
  const [draftBio, setDraftBio] = useState(profile.bio ?? "");
  const [draftHomeCity, setDraftHomeCity] = useState(profile.homeCity ?? "");
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    setSelectedStyles(profile.styles);
    setDraftName(profile.name);
    setDraftBio(profile.bio ?? "");
    setDraftHomeCity(profile.homeCity ?? "");
  }, [profile.bio, profile.homeCity, profile.name, profile.styles]);

  useEffect(() => {
    const local =
      selectedStyles.length === 0
        ? "관심 스타일을 고르면 맞춤 여행지를 추천해 드려요."
        : "선택하신 스타일을 바탕으로 맞춤 여행지를 추천해 드려요.";
    setStyleInsight(local);

    if (selectedStyles.length === 0) {
      setStyleInsightLoading(false);
      return;
    }

    const controller = new AbortController();
    setStyleInsightLoading(true);

    const timer = window.setTimeout(() => {
      fetch("/api/style-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styles: selectedStyles }),
        signal: controller.signal,
        cache: "no-store",
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("style-insight-failed");
          return (await res.json()) as { insight?: string };
        })
        .then((data) => {
          if (data.insight?.trim()) setStyleInsight(data.insight.trim());
        })
        .catch((error) => {
          if ((error as Error)?.name === "AbortError") return;
          setStyleInsight(local);
        })
        .finally(() => {
          if (!controller.signal.aborted) setStyleInsightLoading(false);
        });
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [selectedStyles]);

  const toggleStyle = (style: TravelStyle) => {
    setSelectedStyles((prev) => {
      const next = prev.includes(style)
        ? prev.filter((item) => item !== style)
        : [...prev, style];
      updateProfile({ styles: next });
      return next;
    });
  };

  const handleSaveProfile = () => {
    const nextName = draftName.trim();
    if (!nextName) {
      setDraftName(profile.name);
      setDraftBio(profile.bio ?? "");
      setDraftHomeCity(profile.homeCity ?? "");
      setIsEditing(false);
      return;
    }
    updateProfile({
      name: nextName,
      bio: draftBio.trim(),
      homeCity: draftHomeCity.trim(),
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setDraftName(profile.name);
    setDraftBio(profile.bio ?? "");
    setDraftHomeCity(profile.homeCity ?? "");
    setIsEditing(false);
  };

  const handleAvatarSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAvatarError("이미지 파일만 업로드할 수 있어요.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError("2MB 이하 이미지만 업로드할 수 있어요.");
      return;
    }

    const supabase = getBrowserSupabase();
    const canUseStorage = Boolean(supabase && user?.id && provider !== "guest");

    if (canUseStorage && supabase && user?.id) {
      setIsUploadingAvatar(true);
      void uploadProfileAvatar(supabase, user.id, file).then((result) => {
        setIsUploadingAvatar(false);
        if ("error" in result) {
          setAvatarError("사진 업로드에 실패했어요. 다시 시도해주세요.");
          return;
        }
        setAvatarError(null);
        updateProfile({
          customAvatarUrl: result.publicUrl,
          avatarUrl: result.publicUrl,
        });
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") return;
      setAvatarError(null);
      updateProfile({ customAvatarUrl: dataUrl, avatarUrl: dataUrl });
    };
    reader.onerror = () => {
      setAvatarError("사진을 불러오지 못했어요. 다시 시도해주세요.");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarError(null);
    const meta = user?.user_metadata ?? {};
    const authAvatar =
      (typeof meta.avatar_url === "string" && meta.avatar_url) ||
      (typeof meta.picture === "string" && meta.picture) ||
      MOCK_PROFILE.avatarUrl;

    const supabase = getBrowserSupabase();
    if (supabase && user?.id && provider !== "guest") {
      void removeProfileAvatar(supabase, user.id);
    }

    updateProfile({ customAvatarUrl: null, avatarUrl: authAvatar });
  };

  const openDeleteConfirm = () => {
    if (provider === "guest" || isDeletingAccount) return;
    setDeleteError(null);
    setDeleteConfirmOpen(true);
  };

  const closeDeleteConfirm = () => {
    if (isDeletingAccount) return;
    setDeleteConfirmOpen(false);
  };

  const handleDeleteAccount = async () => {
    if (provider === "guest" || isDeletingAccount) return;

    setDeleteError(null);
    setIsDeletingAccount(true);

    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!res.ok) {
        setDeleteError(data?.error ?? "탈퇴에 실패했어요. 다시 시도해 주세요.");
        setIsDeletingAccount(false);
        setDeleteConfirmOpen(false);
        return;
      }

      clearGuestSession();
      clearSupabaseAuthStorage();
      clearSupabaseAuthCookies();
      resetBrowserSupabase();

      try {
        localStorage.removeItem(STORAGE_KEYS.trips);
        localStorage.removeItem(STORAGE_KEYS.profile);
        localStorage.removeItem(STORAGE_KEYS.communityPosts);
        localStorage.removeItem(STORAGE_KEYS.partyChatMessages);
      } catch {
        /* ignore */
      }

      window.location.assign("/login?deleted=1");
    } catch {
      setDeleteError("네트워크 오류로 탈퇴에 실패했어요.");
      setIsDeletingAccount(false);
      setDeleteConfirmOpen(false);
    }
  };

  const hasCustomAvatar =
    Boolean(profile.customAvatarUrl) || isStoredAvatar(profile.avatarUrl);

  return {
    fileInputRef,
    logout,
    provider,
    profile,
    selectedStyles,
    styleInsight,
    styleInsightLoading,
    currency,
    setCurrency,
    notifications,
    setNotifications,
    isEditing,
    setIsEditing,
    draftName,
    setDraftName,
    draftBio,
    setDraftBio,
    draftHomeCity,
    setDraftHomeCity,
    avatarError,
    isUploadingAvatar,
    isDeletingAccount,
    deleteError,
    deleteConfirmOpen,
    hasCustomAvatar,
    toggleStyle,
    handleSaveProfile,
    handleCancelEdit,
    handleAvatarSelect,
    handleRemoveAvatar,
    openDeleteConfirm,
    closeDeleteConfirm,
    handleDeleteAccount,
  };
}
