import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/admin";

const AVATAR_BUCKET = "avatars";

async function removeAvatarFolder(
  admin: NonNullable<ReturnType<typeof getServiceSupabase>>,
  userId: string
) {
  const { data } = await admin.storage.from(AVATAR_BUCKET).list(userId);
  const files = data ?? [];
  if (files.length === 0) return;
  await admin.storage
    .from(AVATAR_BUCKET)
    .remove(files.map((file) => `${userId}/${file.name}`));
}

/**
 * 회원 탈퇴: 세션 사용자 확인 후 service role로 Auth 유저 삭제.
 * profiles FK cascade가 커뮤니티/친구/알림 데이터를 함께 정리함.
 */
export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "로그인이 필요해요." },
      { status: 401 }
    );
  }

  const admin = getServiceSupabase();
  if (!admin) {
    console.error(
      "[account/delete] SUPABASE_SERVICE_ROLE_KEY is missing on the server"
    );
    return NextResponse.json(
      {
        error:
          "탈퇴 설비가 아직 준비되지 않았어요. 잠시 후 다시 시도해 주세요.",
      },
      { status: 503 }
    );
  }

  const userId = user.id;

  try {
    await removeAvatarFolder(admin, userId);

    // profiles FK cascade가 community/friends/notifications를 정리함.
    // 아바타 스토리지만 선행 정리 후 Auth 유저 삭제.
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("[account/delete]", deleteError.message);
      return NextResponse.json(
        { error: "계정 삭제에 실패했어요. 다시 시도해 주세요." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[account/delete]", error);
    return NextResponse.json(
      { error: "탈퇴 처리 중 오류가 발생했어요." },
      { status: 500 }
    );
  }

  await supabase.auth.signOut({ scope: "global" });

  return NextResponse.json({ ok: true });
}
