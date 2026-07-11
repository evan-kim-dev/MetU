import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/community/storage";
import { syncPostCounts } from "@/lib/community/counts";
import type {
  CommunityPost,
  CreatePostInput,
  PartyInfo,
  PartyMember,
  PartyMemberStatus,
  PostComment,
  UpdatePostInput,
  WritablePostCategory,
} from "@/lib/community/types";

interface ProfileEmbed {
  display_name: string | null;
  avatar_url: string | null;
}

interface PostRow {
  id: string;
  author_id: string;
  category: WritablePostCategory;
  destination: string;
  title: string;
  body: string;
  image_urls: string[];
  party_data: Omit<PartyInfo, "members" | "current"> | null;
  created_at: string;
  profiles?: ProfileEmbed | ProfileEmbed[] | null;
}

interface CommentRow {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  profiles?: ProfileEmbed | ProfileEmbed[] | null;
}

interface LikeRow {
  post_id: string;
  user_id: string;
}

interface CommentLikeRow {
  comment_id: string;
  user_id: string;
}

interface PartyMemberRow {
  post_id: string;
  user_id: string;
  joined_at: string;
  is_host: boolean;
  status: PartyMemberStatus;
  profiles?: ProfileEmbed | ProfileEmbed[] | null;
}

type NotificationType =
  | "party_join_request"
  | "party_join_accepted"
  | "party_join_rejected";

const POST_COLUMNS = [
  "id",
  "author_id",
  "category",
  "destination",
  "title",
  "body",
  "image_urls",
  "party_data",
  "created_at",
  "profiles!community_posts_author_id_fkey(display_name, avatar_url)",
].join(", ");

const COMMENT_COLUMNS = [
  "id",
  "post_id",
  "author_id",
  "content",
  "created_at",
  "profiles!post_comments_author_id_fkey(display_name, avatar_url)",
].join(", ");

const PARTY_MEMBER_COLUMNS = [
  "post_id",
  "user_id",
  "joined_at",
  "is_host",
  "status",
  "profiles!party_members_user_id_fkey(display_name, avatar_url)",
].join(", ");

function oneProfile(
  value: ProfileEmbed | ProfileEmbed[] | null | undefined
): ProfileEmbed | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function displayFromProfile(
  value: ProfileEmbed | ProfileEmbed[] | null | undefined,
  fallbackName = "여행자",
  fallbackAvatar = "👤"
): { name: string; avatar: string } {
  const profile = oneProfile(value);
  const name = profile?.display_name?.trim() || fallbackName;
  const avatar = profile?.avatar_url?.trim() || fallbackAvatar;
  return { name, avatar };
}

function isAcceptedMember(row: PartyMemberRow): boolean {
  return row.is_host || row.status === "accepted";
}

function memberRowToMember(row: PartyMemberRow): PartyMember {
  const display = displayFromProfile(row.profiles);
  return {
    id: row.user_id,
    name: display.name,
    avatar: display.avatar,
    joinedAtIso: row.joined_at,
    isHost: row.is_host,
    status: row.status,
  };
}

async function insertNotification(
  supabase: SupabaseClient,
  input: {
    userId: string;
    type: NotificationType;
    postId: string;
    actorId: string;
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  await supabase.from(TABLES.notifications).insert({
    user_id: input.userId,
    type: input.type,
    post_id: input.postId,
    actor_id: input.actorId,
    payload: input.payload ?? {},
  });
}

function assemblePost(
  row: PostRow,
  comments: CommentRow[],
  likes: LikeRow[],
  members: PartyMemberRow[],
  commentLikes: CommentLikeRow[] = []
): CommunityPost {
  const author = displayFromProfile(row.profiles);
  const postComments = comments
    .filter((c) => c.post_id === row.id)
    .map((c): PostComment => {
      const likedBy = commentLikes
        .filter((l) => l.comment_id === c.id)
        .map((l) => l.user_id);
      const commentAuthor = displayFromProfile(c.profiles, "여행자", "💬");
      return {
        id: c.id,
        authorId: c.author_id,
        author: commentAuthor.name,
        avatar: commentAuthor.avatar,
        content: c.content,
        createdAt: formatRelativeTime(c.created_at),
        createdAtIso: c.created_at,
        likes: likedBy.length,
        likedBy,
      };
    });

  const likedBy = likes.filter((l) => l.post_id === row.id).map((l) => l.user_id);
  const postMembers = members.filter((m) => m.post_id === row.id);
  const acceptedMembers = postMembers.filter(isAcceptedMember).map(memberRowToMember);
  const pendingMembers = postMembers
    .filter((m) => !m.is_host && m.status === "pending")
    .map(memberRowToMember);

  const party: PartyInfo | undefined = row.party_data
    ? {
        startDate: row.party_data.startDate,
        endDate: row.party_data.endDate,
        needed: row.party_data.needed,
        budgetPerPerson: row.party_data.budgetPerPerson,
        members: acceptedMembers,
        pendingMembers,
        current: acceptedMembers.length,
      }
    : undefined;

  return syncPostCounts({
    id: row.id,
    category: row.category,
    authorId: row.author_id,
    author: author.name,
    avatar: author.avatar,
    destination: row.destination,
    title: row.title,
    preview: row.body,
    images: row.image_urls ?? [],
    likes: likedBy.length,
    comments: postComments.length,
    likedBy,
    commentList: postComments,
    createdAt: formatRelativeTime(row.created_at),
    createdAtIso: row.created_at,
    party,
  });
}

export async function fetchCommunityPostsFromSupabase(
  supabase: SupabaseClient
): Promise<CommunityPost[]> {
  const { data: posts, error } = await supabase
    .from(TABLES.communityPosts)
    .select(POST_COLUMNS)
    .order("created_at", { ascending: false });

  if (error || !posts?.length) return [];

  const postRows = posts as unknown as PostRow[];
  const postIds = postRows.map((p) => p.id);

  const [commentsRes, likesRes, membersRes] = await Promise.all([
    supabase.from(TABLES.postComments).select(COMMENT_COLUMNS).in("post_id", postIds),
    supabase.from(TABLES.postLikes).select("post_id, user_id").in("post_id", postIds),
    supabase.from(TABLES.partyMembers).select(PARTY_MEMBER_COLUMNS).in("post_id", postIds),
  ]);

  const comments = (commentsRes.data ?? []) as unknown as CommentRow[];
  const likes = (likesRes.data ?? []) as unknown as LikeRow[];
  const members = (membersRes.data ?? []) as unknown as PartyMemberRow[];
  const commentIds = comments.map((c) => c.id);

  let commentLikes: CommentLikeRow[] = [];
  if (commentIds.length > 0) {
    const { data, error: commentLikesError } = await supabase
      .from(TABLES.commentLikes)
      .select("comment_id, user_id")
      .in("comment_id", commentIds);
    if (!commentLikesError) {
      commentLikes = (data ?? []) as unknown as CommentLikeRow[];
    }
  }

  return postRows.map((row) =>
    assemblePost(row, comments, likes, members, commentLikes)
  );
}

function partyInputToData(
  party: PartyInfo | undefined
): Omit<PartyInfo, "members" | "current"> | null {
  if (!party) return null;
  return {
    startDate: party.startDate,
    endDate: party.endDate,
    needed: party.needed,
    budgetPerPerson: party.budgetPerPerson,
  };
}

export async function insertCommunityPostToSupabase(
  supabase: SupabaseClient,
  authorId: string,
  authorName: string,
  authorAvatar: string,
  input: CreatePostInput
): Promise<CommunityPost | null> {
  const { data, error } = await supabase
    .from(TABLES.communityPosts)
    .insert({
      author_id: authorId,
      category: input.category,
      destination: input.destination.trim(),
      title: input.title.trim(),
      body: input.body.trim(),
      image_urls: input.imageUrls ?? [],
      party_data: partyInputToData(input.party),
    })
    .select(POST_COLUMNS)
    .single();

  if (error || !data) {
    if (error) console.error("[community] insert post failed:", error.message);
    return null;
  }

  const row = data as unknown as PostRow;
  // insert 직후 join이 비면 호출자 스냅샷으로 보강
  if (!oneProfile(row.profiles)) {
    row.profiles = {
      display_name: authorName,
      avatar_url: authorAvatar.startsWith("http") ? authorAvatar : null,
    };
  }

  if (input.party) {
    await supabase.from(TABLES.partyMembers).insert({
      post_id: row.id,
      user_id: authorId,
      is_host: true,
      status: "accepted",
    });
  }

  const members = input.party
    ? [
        {
          post_id: row.id,
          user_id: authorId,
          joined_at: row.created_at,
          is_host: true,
          status: "accepted" as const,
          profiles: {
            display_name: authorName,
            avatar_url: authorAvatar.startsWith("http") ? authorAvatar : null,
          },
        },
      ]
    : [];

  return assemblePost(row, [], [], members);
}

export async function updateCommunityPostInSupabase(
  supabase: SupabaseClient,
  postId: string,
  authorId: string,
  input: UpdatePostInput
): Promise<CommunityPost | null> {
  const { data, error } = await supabase
    .from(TABLES.communityPosts)
    .update({
      category: input.category,
      destination: input.destination.trim(),
      title: input.title.trim(),
      body: input.body.trim(),
      image_urls: input.imageUrls ?? [],
      party_data: partyInputToData(input.party),
    })
    .eq("id", postId)
    .eq("author_id", authorId)
    .select(POST_COLUMNS)
    .single();

  if (error || !data) return null;
  const row = data as unknown as PostRow;

  const [commentsRes, likesRes, membersRes] = await Promise.all([
    supabase.from(TABLES.postComments).select(COMMENT_COLUMNS).eq("post_id", postId),
    supabase.from(TABLES.postLikes).select("post_id, user_id").eq("post_id", postId),
    supabase.from(TABLES.partyMembers).select(PARTY_MEMBER_COLUMNS).eq("post_id", postId),
  ]);

  const comments = (commentsRes.data ?? []) as unknown as CommentRow[];
  const commentIds = comments.map((c) => c.id);
  let commentLikes: CommentLikeRow[] = [];
  if (commentIds.length > 0) {
    const { data, error: commentLikesError } = await supabase
      .from(TABLES.commentLikes)
      .select("comment_id, user_id")
      .in("comment_id", commentIds);
    if (!commentLikesError) {
      commentLikes = (data ?? []) as unknown as CommentLikeRow[];
    }
  }

  return assemblePost(
    row,
    comments,
    (likesRes.data ?? []) as unknown as LikeRow[],
    (membersRes.data ?? []) as unknown as PartyMemberRow[],
    commentLikes
  );
}

export async function deleteCommunityPostFromSupabase(
  supabase: SupabaseClient,
  postId: string,
  authorId: string
): Promise<boolean> {
  const { error } = await supabase
    .from(TABLES.communityPosts)
    .delete()
    .eq("id", postId)
    .eq("author_id", authorId);

  return !error;
}

export async function togglePostLikeInSupabase(
  supabase: SupabaseClient,
  postId: string,
  userId: string,
  liked: boolean
): Promise<boolean> {
  if (liked) {
    const { error } = await supabase
      .from(TABLES.postLikes)
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
    return !error;
  }

  const { error } = await supabase.from(TABLES.postLikes).insert({
    post_id: postId,
    user_id: userId,
  });
  return !error;
}

export async function toggleCommentLikeInSupabase(
  supabase: SupabaseClient,
  commentId: string,
  userId: string,
  liked: boolean
): Promise<boolean> {
  if (liked) {
    const { error } = await supabase
      .from(TABLES.commentLikes)
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", userId);
    return !error;
  }

  const { error } = await supabase.from(TABLES.commentLikes).insert({
    comment_id: commentId,
    user_id: userId,
  });
  return !error;
}

export async function insertPostCommentToSupabase(
  supabase: SupabaseClient,
  postId: string,
  authorId: string,
  authorName: string,
  content: string,
  authorAvatar = "💬"
): Promise<PostComment | null> {
  const { data, error } = await supabase
    .from(TABLES.postComments)
    .insert({
      post_id: postId,
      author_id: authorId,
      content: content.trim(),
    })
    .select(COMMENT_COLUMNS)
    .single();

  if (error || !data) return null;

  const row = data as unknown as CommentRow;
  const display = displayFromProfile(
    row.profiles ?? {
      display_name: authorName,
      avatar_url: authorAvatar.startsWith("http") ? authorAvatar : null,
    },
    authorName,
    authorAvatar
  );
  return {
    id: row.id,
    authorId: row.author_id,
    author: display.name,
    avatar: display.avatar,
    content: row.content,
    createdAt: formatRelativeTime(row.created_at),
    createdAtIso: row.created_at,
    likes: 0,
    likedBy: [],
  };
}

export async function updatePostCommentInSupabase(
  supabase: SupabaseClient,
  commentId: string,
  authorId: string,
  content: string
): Promise<boolean> {
  const { error } = await supabase
    .from(TABLES.postComments)
    .update({ content: content.trim() })
    .eq("id", commentId)
    .eq("author_id", authorId);

  return !error;
}

export async function deletePostCommentFromSupabase(
  supabase: SupabaseClient,
  commentId: string,
  authorId: string
): Promise<boolean> {
  const { error } = await supabase
    .from(TABLES.postComments)
    .delete()
    .eq("id", commentId)
    .eq("author_id", authorId);

  return !error;
}

export async function joinPartyInSupabase(
  supabase: SupabaseClient,
  postId: string,
  userId: string,
  name: string,
  _avatar: string
): Promise<boolean> {
  const { data: post, error: postError } = await supabase
    .from(TABLES.communityPosts)
    .select("author_id, title, party_data")
    .eq("id", postId)
    .single();

  if (postError || !post) return false;
  if (post.author_id === userId) return false;

  const partyData = post.party_data as { needed?: number } | null;
  const needed = partyData?.needed ?? 0;

  const { data: existingMembers } = await supabase
    .from(TABLES.partyMembers)
    .select(PARTY_MEMBER_COLUMNS)
    .eq("post_id", postId);

  const rows = (existingMembers ?? []) as unknown as PartyMemberRow[];
  const acceptedCount = rows.filter(isAcceptedMember).length;
  if (needed > 0 && acceptedCount >= needed) return false;

  const mine = rows.find((m) => m.user_id === userId);
  if (mine) {
    if (mine.is_host || mine.status === "accepted" || mine.status === "pending") {
      return false;
    }
    // rejected → delete then re-request
    const { error: delError } = await supabase
      .from(TABLES.partyMembers)
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId)
      .eq("is_host", false);
    if (delError) return false;
  }

  const { error } = await supabase.from(TABLES.partyMembers).insert({
    post_id: postId,
    user_id: userId,
    is_host: false,
    status: "pending",
  });
  if (error) return false;

  await insertNotification(supabase, {
    userId: post.author_id,
    type: "party_join_request",
    postId,
    actorId: userId,
    payload: {
      actorName: name,
      postTitle: post.title,
    },
  });

  return true;
}

export async function acceptPartyMemberInSupabase(
  supabase: SupabaseClient,
  postId: string,
  hostId: string,
  memberId: string
): Promise<boolean> {
  const { data: post, error: postError } = await supabase
    .from(TABLES.communityPosts)
    .select("author_id, title, party_data")
    .eq("id", postId)
    .single();

  if (postError || !post || post.author_id !== hostId) return false;

  const partyData = post.party_data as { needed?: number } | null;
  const needed = partyData?.needed ?? 0;

  const { data: existingMembers } = await supabase
    .from(TABLES.partyMembers)
    .select(PARTY_MEMBER_COLUMNS)
    .eq("post_id", postId);

  const rows = (existingMembers ?? []) as unknown as PartyMemberRow[];
  const acceptedCount = rows.filter(isAcceptedMember).length;
  if (needed > 0 && acceptedCount >= needed) return false;

  const target = rows.find(
    (m) => m.user_id === memberId && !m.is_host && m.status === "pending"
  );
  if (!target) return false;

  const { error } = await supabase
    .from(TABLES.partyMembers)
    .update({ status: "accepted" })
    .eq("post_id", postId)
    .eq("user_id", memberId)
    .eq("is_host", false)
    .eq("status", "pending");

  if (error) return false;

  await insertNotification(supabase, {
    userId: memberId,
    type: "party_join_accepted",
    postId,
    actorId: hostId,
    payload: { postTitle: post.title },
  });

  return true;
}

export async function rejectPartyMemberInSupabase(
  supabase: SupabaseClient,
  postId: string,
  hostId: string,
  memberId: string
): Promise<boolean> {
  const { data: post, error: postError } = await supabase
    .from(TABLES.communityPosts)
    .select("author_id, title")
    .eq("id", postId)
    .single();

  if (postError || !post || post.author_id !== hostId) return false;

  const { error } = await supabase
    .from(TABLES.partyMembers)
    .update({ status: "rejected" })
    .eq("post_id", postId)
    .eq("user_id", memberId)
    .eq("is_host", false)
    .eq("status", "pending");

  if (error) return false;

  await insertNotification(supabase, {
    userId: memberId,
    type: "party_join_rejected",
    postId,
    actorId: hostId,
    payload: { postTitle: post.title },
  });

  return true;
}

export async function leavePartyInSupabase(
  supabase: SupabaseClient,
  postId: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from(TABLES.partyMembers)
    .delete()
    .eq("post_id", postId)
    .eq("user_id", userId)
    .eq("is_host", false);

  return !error;
}

export async function cancelJoinRequestInSupabase(
  supabase: SupabaseClient,
  postId: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from(TABLES.partyMembers)
    .delete()
    .eq("post_id", postId)
    .eq("user_id", userId)
    .eq("is_host", false)
    .eq("status", "pending");

  return !error;
}
