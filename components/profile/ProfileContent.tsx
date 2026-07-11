"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
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
  PROFILE_STYLE_OPTIONS,
} from "@/lib/mock/profile";
import { LEGAL_LINKS } from "@/lib/legal/documents";
import { LoginMethodList } from "@/components/auth/LoginMethodList";
import { useProfileContent } from "@/components/profile/useProfileContent";

function isDataUrl(src: string): boolean {
  return src.startsWith("data:");
}

function isRemoteUrl(src: string): boolean {
  return /^https?:\/\//i.test(src.trim());
}

function normalizeAvatarSrc(src: string): string {
  return src.trim().replace(/^http:\/\//i, "https://");
}

function ProfileAvatar({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const value = src.trim();

  useEffect(() => {
    setFailed(false);
  }, [value]);

  if (!value || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-soft text-3xl">
        👤
      </div>
    );
  }

  // 카카오 CDN 등 외부 아바타는 next/image 호스트 제한에 자주 걸려 일반 img 사용
  if (isDataUrl(value) || isRemoteUrl(value)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={normalizeAvatarSrc(value)}
        alt={alt}
        className="h-full w-full object-cover"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <Image src={value} alt={alt} fill sizes="96px" className="object-cover" />
  );
}

export function ProfileContent() {
  const {
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
    hasCustomAvatar,
    toggleStyle,
    handleSaveProfile,
    handleCancelEdit,
    handleAvatarSelect,
    handleRemoveAvatar,
    isDeletingAccount,
    deleteError,
    deleteConfirmOpen,
    openDeleteConfirm,
    closeDeleteConfirm,
    handleDeleteAccount,
  } = useProfileContent();

  return (
    <MobileShell>
      <div className="flex flex-col gap-8 px-4 pb-6 pt-6">
        <header>
          <h1 className="text-[22px] font-bold leading-7 tracking-tight text-ink-heading">
            내 프로필
          </h1>
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
                <LoginMethodList collapsible className="mt-4" />
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
              <Sparkles
                className={[
                  "mt-0.5 h-4 w-4 shrink-0 text-brand",
                  styleInsightLoading ? "animate-pulse" : "",
                ].join(" ")}
              />
              <p className="text-sm leading-5 text-brand">{styleInsight}</p>
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

          {provider !== "guest" ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={logout}
                disabled={isDeletingAccount}
                className="w-full rounded-xl2 border border-danger-border py-3.5 text-sm font-semibold tracking-wide text-danger transition-colors active:bg-danger/5 disabled:opacity-60"
              >
                로그아웃
              </button>
              <button
                type="button"
                onClick={openDeleteConfirm}
                disabled={isDeletingAccount}
                className="w-full rounded-xl2 py-3 text-sm font-semibold tracking-wide text-ink-caption transition-colors active:bg-surface-soft disabled:opacity-60"
              >
                회원 탈퇴
              </button>
              {deleteError ? (
                <p className="text-center text-xs text-danger">{deleteError}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {deleteConfirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-heading/40 px-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          onClick={closeDeleteConfirm}
        >
          <div
            className="w-full max-w-dialog rounded-xl2 bg-surface-white p-5 shadow-overlay"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="delete-account-title"
              className="text-lg font-extrabold text-ink-heading"
            >
              정말 탈퇴하시겠어요?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-body">
              탈퇴하면 아래 데이터가 모두 삭제되며{" "}
              <span className="font-bold text-danger">복구할 수 없어요.</span>
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-ink-caption">
              <li>프로필·닉네임·여행 취향</li>
              <li>저장한 여행 계획과 예산·일정</li>
              <li>작성한 게시글·댓글·동행 채팅</li>
              <li>알림 및 계정 로그인 정보</li>
            </ul>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                disabled={isDeletingAccount}
                className="rounded-xl border border-line-muted py-3 text-sm font-bold text-ink-body disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleDeleteAccount();
                }}
                disabled={isDeletingAccount}
                className="rounded-xl bg-danger py-3 text-sm font-bold text-surface-white disabled:opacity-60"
              >
                {isDeletingAccount ? "탈퇴 중..." : "탈퇴하기"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </MobileShell>
  );
}
