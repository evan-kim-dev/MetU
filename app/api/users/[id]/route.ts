import { NextResponse } from "next/server";
import type { TravelStyle } from "@/components/onboarding/types";
import { TABLES } from "@/lib/constants";
import { isProfileUserId } from "@/lib/profile/enrich-author-avatars";
import type { PublicProfile } from "@/lib/profile/public";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "missing-id" }, { status: 400 });
  }

  if (!isProfileUserId(id)) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  try {
    const supabase = getServiceSupabase() ?? (await createServerSupabase());
    const { data, error } = await supabase
      .from(TABLES.profiles)
      .select(
        "id, display_name, avatar_url, bio, home_city, travel_styles, membership_label"
      )
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "not-found" }, { status: 404 });
    }

    const profile: PublicProfile = {
      id: data.id as string,
      name: (data.display_name as string) || "여행자",
      avatarUrl: (data.avatar_url as string | null) ?? null,
      bio: (data.bio as string) || "",
      homeCity: (data.home_city as string) || "",
      styles: Array.isArray(data.travel_styles)
        ? (data.travel_styles as TravelStyle[])
        : [],
      membershipLabel: (data.membership_label as string) || "회원",
    };

    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json({ error: "fetch-failed" }, { status: 500 });
  }
}
