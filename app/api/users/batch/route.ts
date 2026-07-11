import { NextResponse } from "next/server";
import type { TravelStyle } from "@/components/onboarding/types";
import { TABLES } from "@/lib/constants";
import { isProfileUserId } from "@/lib/profile/enrich-author-avatars";
import type { PublicProfile } from "@/lib/profile/public";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

function rowToPublicProfile(row: Record<string, unknown>): PublicProfile {
  return {
    id: row.id as string,
    name: (row.display_name as string) || "여행자",
    avatarUrl: (row.avatar_url as string | null) ?? null,
    bio: (row.bio as string) || "",
    homeCity: (row.home_city as string) || "",
    styles: Array.isArray(row.travel_styles)
      ? (row.travel_styles as TravelStyle[])
      : [],
    membershipLabel: (row.membership_label as string) || "회원",
  };
}

const PROFILE_SELECT =
  "id, display_name, avatar_url, bio, home_city, travel_styles, membership_label";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { ids?: string[] };
    const ids = [...new Set((body.ids ?? []).filter(isProfileUserId))].slice(
      0,
      100
    );

    if (ids.length === 0) {
      return NextResponse.json({ profiles: {} as Record<string, PublicProfile> });
    }

    const supabase = getServiceSupabase() ?? (await createServerSupabase());
    const { data, error } = await supabase
      .from(TABLES.profiles)
      .select(PROFILE_SELECT)
      .in("id", ids);

    if (error) {
      return NextResponse.json(
        { profiles: {} as Record<string, PublicProfile>, error: error.message },
        { status: 200 }
      );
    }

    const profiles: Record<string, PublicProfile> = {};
    for (const row of data ?? []) {
      const profile = rowToPublicProfile(row as Record<string, unknown>);
      profiles[profile.id] = profile;
    }

    return NextResponse.json({ profiles });
  } catch {
    return NextResponse.json({ profiles: {} as Record<string, PublicProfile> });
  }
}
