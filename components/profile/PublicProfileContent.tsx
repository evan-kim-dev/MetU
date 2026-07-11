"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, UserRound } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { useGoBack } from "@/lib/navigation/useGoBack";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCommunityState } from "@/lib/community/CommunityProvider";
import { isAvatarImage, type PublicProfile } from "@/lib/profile/public";
import { STYLE_LABELS } from "@/lib/trips/data";
import { useRouter } from "next/navigation";

interface PublicProfileContentProps {
  userId: string;
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  const value = src?.trim() || "";
  return (
    <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-surface-base bg-surface-soft shadow-sm">
      {isAvatarImage(value) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt={`${name} 프로필`}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-4xl">
          {value || "👤"}
        </div>
      )}
    </div>
  );
}

export function PublicProfileContent({ userId }: PublicProfileContentProps) {
  const router = useRouter();
  const goBack = useGoBack("/board");
  const { user } = useAuth();
  const { posts } = useCommunityState();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fallbackFromPosts = useMemo(() => {
    const match = posts.find((post) => post.authorId === userId);
    if (!match) return null;
    return {
      id: userId,
      name: match.author,
      avatarUrl: isAvatarImage(match.avatar) ? match.avatar : null,
      avatarEmoji: isAvatarImage(match.avatar) ? null : match.avatar,
      bio: "",
      homeCity: "",
      styles: [] as PublicProfile["styles"],
      membershipLabel: "커뮤니티 회원",
    };
  }, [posts, userId]);

  useEffect(() => {
    if (user?.id && user.id === userId) {
      router.replace("/profile");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    void fetch(`/api/users/${encodeURIComponent(userId)}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("not-found");
        return (await res.json()) as { profile?: PublicProfile };
      })
      .then((data) => {
        if (cancelled) return;
        if (data.profile) {
          setProfile(data.profile);
          setNotFound(false);
        } else {
          setProfile(null);
          setNotFound(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setProfile(null);
        setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router, user?.id, userId]);

  const display = profile
    ? {
        name: profile.name,
        avatar: profile.avatarUrl,
        bio: profile.bio,
        homeCity: profile.homeCity,
        styles: profile.styles,
        membershipLabel: profile.membershipLabel,
      }
    : fallbackFromPosts
      ? {
          name: fallbackFromPosts.name,
          avatar: fallbackFromPosts.avatarUrl ?? fallbackFromPosts.avatarEmoji,
          bio: "",
          homeCity: "",
          styles: [],
          membershipLabel: fallbackFromPosts.membershipLabel,
        }
      : null;

  return (
    <MobileShell title="프로필" showBack onBack={goBack}>
      <div className="flex flex-col gap-6 px-5 pb-10 pt-6">
        {loading && !display ? (
          <div className="flex flex-col items-center gap-3 py-16 text-ink-caption">
            <div className="h-24 w-24 animate-pulse rounded-full bg-surface-soft" />
            <p className="text-sm">프로필을 불러오는 중…</p>
          </div>
        ) : !display ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <UserRound className="h-10 w-10 text-ink-caption" />
            <p className="text-base font-bold text-ink-heading">
              프로필을 찾을 수 없어요
            </p>
            <p className="text-sm text-ink-caption">
              탈퇴했거나 아직 공개 정보가 없는 계정일 수 있어요.
            </p>
          </div>
        ) : (
          <>
            <section className="rounded-xl2 bg-surface-white p-6 shadow-soft">
              <div className="flex flex-col items-center text-center">
                <Avatar src={display.avatar} name={display.name} />
                <h1 className="mt-4 text-xl font-extrabold text-ink-heading">
                  {display.name}
                </h1>
                <p className="mt-1 text-xs font-semibold text-brand">
                  {display.membershipLabel}
                </p>
                {display.homeCity ? (
                  <p className="mt-2 inline-flex items-center gap-1 text-sm text-ink-caption">
                    <MapPin className="h-3.5 w-3.5" />
                    {display.homeCity}
                  </p>
                ) : null}
                {display.bio ? (
                  <p className="mt-3 max-w-[280px] text-sm leading-relaxed text-ink-body">
                    {display.bio}
                  </p>
                ) : notFound && fallbackFromPosts ? (
                  <p className="mt-3 text-sm text-ink-caption">
                    커뮤니티에서 본 작성자 정보예요.
                  </p>
                ) : null}
              </div>
            </section>

            {display.styles.length > 0 ? (
              <section className="rounded-xl2 bg-surface-white p-5 shadow-soft">
                <h2 className="mb-3 text-sm font-extrabold text-ink-heading">
                  여행 스타일
                </h2>
                <div className="flex flex-wrap gap-2">
                  {display.styles.map((style) => (
                    <span
                      key={style}
                      className="rounded-full bg-surface-soft px-3 py-1 text-xs font-semibold text-brand-strong"
                    >
                      {STYLE_LABELS[style] ?? style}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </MobileShell>
  );
}
