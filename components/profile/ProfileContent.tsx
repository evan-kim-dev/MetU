"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  Camera,
  ChevronRight,
  FileText,
  Globe,
  MapPin,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import {
  CURRENCY_OPTIONS,
  MOCK_PROFILE,
  PROFILE_STYLE_OPTIONS,
} from "@/lib/mock/profile";
import { LEGAL_LINKS } from "@/lib/legal/documents";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useProfile } from "@/lib/profile/ProfileProvider";
import {
  isStoredAvatar,
  removeProfileAvatar,
  uploadProfileAvatar,
} from "@/lib/profile/supabase";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { TravelStyle } from "@/components/onboarding/types";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function isDataUrl(src: string): boolean {
  return src.startsWith("data:");
}

function ProfileAvatar({ src, alt }: { src: string; alt: string }) {
  if (isDataUrl(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className="h-full w-full object-cover" />
    );
  }

  return (
    <Image src={src} alt={alt} fill sizes="96px" className="object-cover" />
  );
}

export function ProfileContent() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { logout, provider, user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const [selectedStyles, setSelectedStyles] = useState<TravelStyle[]>(
    profile.styles
  );
  const [currency, setCurrency] = useState<(typeof CURRENCY_OPTIONS)[number]>("KRW");
  const [notifications, setNotifications] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(profile.name);
  const [draftBio, setDraftBio] = useState(profile.bio ?? "");
  const [draftHomeCity, setDraftHomeCity] = useState(profile.homeCity ?? "");
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  useEffect(() => {
    setSelectedStyles(profile.styles);
    setDraftName(profile.name);
    setDraftBio(profile.bio ?? "");
    setDraftHomeCity(profile.homeCity ?? "");
  }, [profile.bio, profile.homeCity, profile.name, profile.styles]);

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

  const hasCustomAvatar =
    Boolean(profile.customAvatarUrl) || isStoredAvatar(profile.avatarUrl);

  return (
    <MobileShell>
      <div className="flex flex-col gap-8 px-4 pb-6 pt-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-[26px] font-bold leading-8 tracking-tight text-ink-heading">
            내 프로필
          </h1>
          <p className="text-base text-ink-body">여행 설정 및 계정 관리</p>
        </header>

        <div className="flex flex-col gap-4">
          <section className="relative rounded-xl2 bg-surface-white p-6 shadow-soft">
            <div className="flex flex-col items-center">
              <div className="relative mb-4">
                <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-surface-base shadow-sm">
                  <ProfileAvatar
                    src={profile.avatarUrl}
                    alt={`${profile.name} 프로필`}
                  />
                </div>
                {hasCustomAvatar ? (
                  <button
                    type="button"
                    aria-label="프로필 사진 삭제"
                    onClick={handleRemoveAvatar}
                    disabled={provider === "guest"}
                    className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface-white bg-ink-heading text-surface-white shadow-soft disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.6} />
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label="프로필 사진 변경"
                  disabled={provider === "guest" || isUploadingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-brand text-surface-white shadow-soft disabled:opacity-50"
                >
                  <Camera className="h-4 w-4" strokeWidth={2.4} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isUploadingAvatar}
                  onChange={handleAvatarSelect}
                />
              </div>

              {avatarError ? (
                <p className="mb-2 text-center text-xs text-danger">{avatarError}</p>
              ) : null}

              {isEditing ? (
                <div className="flex w-full flex-col gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-ink-caption">닉네임</span>
                    <input
                      autoFocus
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      className="w-full rounded-lg border border-brand bg-surface-white px-3 py-2.5 text-center text-lg font-semibold text-ink-heading focus:outline-none focus:ring-4 focus:ring-brand/10"
                      aria-label="닉네임 입력"
                      placeholder="여행자"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-ink-caption">여행 한마디</span>
                    <textarea
                      value={draftBio}
                      onChange={(e) => setDraftBio(e.target.value)}
                      rows={2}
                      maxLength={80}
                      className="w-full resize-none rounded-lg border border-line-soft bg-surface-white px-3 py-2.5 text-sm text-ink-body focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                      placeholder="예: 예산 안에서 최대한 즐기는 여행을 좋아해요."
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-ink-caption">자주 출발하는 도시</span>
                    <input
                      value={draftHomeCity}
                      onChange={(e) => setDraftHomeCity(e.target.value)}
                      className="w-full rounded-lg border border-line-soft bg-surface-white px-3 py-2.5 text-sm text-ink-body focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                      placeholder="예: 서울"
                    />
                  </label>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-semibold text-ink-heading">
                    {profile.name}
                  </h2>
                  <p className="mt-1 text-sm text-ink-body">{profile.email}</p>
                  {profile.bio ? (
                    <p className="mt-3 text-center text-sm leading-6 text-ink-body">
                      {profile.bio}
                    </p>
                  ) : null}
                  {profile.homeCity ? (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ink-caption">
                      <MapPin className="h-3.5 w-3.5" />
                      출발 도시 · {profile.homeCity}
                    </p>
                  ) : null}
                </>
              )}

              {provider === "guest" ? (
                <p className="mt-4 w-full rounded-lg border border-line-soft bg-surface-soft py-3 text-center text-sm font-semibold text-ink-caption">
                  게스트로 로그인 중
                </p>
              ) : isEditing ? (
                <div className="mt-4 grid w-full grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="rounded-lg border border-line-muted bg-surface-white py-3 text-sm font-semibold text-ink-body"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    className="rounded-lg border border-brand bg-brand py-3 text-sm font-semibold text-surface-white"
                  >
                    저장
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDraftName(profile.name);
                    setDraftBio(profile.bio ?? "");
                    setDraftHomeCity(profile.homeCity ?? "");
                    setIsEditing(true);
                  }}
                  className="mt-4 w-full rounded-lg border border-line-muted bg-surface-white py-3 text-sm font-semibold tracking-wide text-brand"
                >
                  프로필 수정
                </button>
              )}
            </div>
          </section>

          <section className="rounded-xl2 bg-surface-white p-6 shadow-soft">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mint text-mint-dark">
                <Sparkles className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <h3 className="text-xl font-semibold text-ink-heading">
                여행 취향 설정
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {PROFILE_STYLE_OPTIONS.map((option) => {
                const selected = selectedStyles.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleStyle(option.value)}
                    className={[
                      "flex flex-col items-center gap-2 rounded-lg border px-3 py-3 text-sm font-semibold tracking-wide transition-all",
                      selected
                        ? "border-2 border-brand bg-brand/5 text-brand"
                        : "border border-line-muted bg-surface-white text-ink-body",
                    ].join(" ")}
                  >
                    <span className="text-lg">{option.emoji}</span>
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-full border border-insight-border bg-insight-bg px-3 py-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <p className="text-sm leading-5 text-brand">
                선택하신 스타일을 바탕으로 맞춤 여행지를 추천해 드려요.
              </p>
            </div>
          </section>

          <section className="rounded-xl2 bg-surface-white p-6 shadow-soft">
            <h3 className="mb-4 text-xl font-semibold text-ink-heading">앱 설정</h3>

            <div className="flex flex-col">
              <div className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-membership">
                    <Wallet className="h-4 w-4 text-ink-body" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold tracking-wide text-ink-heading">
                      기본 통화
                    </p>
                    <p className="text-sm text-ink-body">예산 표시 단위</p>
                  </div>
                </div>
                <select
                  value={currency}
                  onChange={(e) =>
                    setCurrency(e.target.value as (typeof CURRENCY_OPTIONS)[number])
                  }
                  className="rounded-lg border border-line-muted bg-surface-base px-3 py-2 text-sm text-ink-heading focus:border-brand focus:outline-none"
                >
                  {CURRENCY_OPTIONS.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="flex items-center justify-between border-t border-membership py-4"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-membership">
                    <Globe className="h-4 w-4 text-ink-body" />
                  </span>
                  <span className="text-sm font-semibold tracking-wide text-ink-heading">
                    언어
                  </span>
                </div>
                <div className="flex items-center gap-1 text-sm text-ink-body">
                  한국어
                  <ChevronRight className="h-4 w-4" />
                </div>
              </button>

              <div className="flex items-center justify-between border-t border-membership py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-membership">
                    <Bell className="h-4 w-4 text-ink-body" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold tracking-wide text-ink-heading">
                      알림
                    </p>
                    <p className="text-sm text-ink-body">여행 팁 및 예산 알림</p>
                  </div>
                </div>
                <ToggleSwitch
                  checked={notifications}
                  onChange={setNotifications}
                  label="알림 설정"
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl2 bg-surface-white p-6 shadow-soft">
            <div className="mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-ink-body" strokeWidth={2.2} />
              <h3 className="text-xl font-semibold text-ink-heading">
                약관 및 정책
              </h3>
            </div>
            <ul className="flex flex-col">
              {LEGAL_LINKS.map((item, index) => (
                <li key={item.slug}>
                  <Link
                    href={`/legal/${item.slug}`}
                    className={`flex items-center justify-between py-4 transition-colors active:bg-surface-soft ${
                      index > 0 ? "border-t border-membership" : ""
                    }`}
                  >
                    <span className="text-sm font-semibold tracking-wide text-ink-heading">
                      {item.title}
                    </span>
                    <ChevronRight className="h-4 w-4 text-line-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <button
            type="button"
            onClick={logout}
            className="w-full rounded-xl2 border border-danger-border py-3.5 text-sm font-semibold tracking-wide text-danger transition-colors active:bg-danger/5"
          >
            로그아웃
          </button>
        </div>
      </div>
    </MobileShell>
  );
}
