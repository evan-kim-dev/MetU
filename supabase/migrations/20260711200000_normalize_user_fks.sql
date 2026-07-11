-- =============================================================================
-- Step 2: Normalize community/social user IDs → uuid + profiles FK
--          Drop denormalized author/sender/member name+avatar snapshots
--
-- SAFE ORDER:
--   1) purge non-uuid / orphan text ids (guest-*, seed-*, etc.)
--   2) cast text → uuid
--   3) drop snapshot columns
--   4) add FKs to public.profiles(id)
--   5) rewrite RLS to compare uuid (auth.uid() = …)
--
-- DO NOT apply until Step 2 is approved. Prefer backup / staging first.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_uuid_text(value text)
returns boolean
language sql
immutable
as $$
  select value is not null
    and value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
$$;

-- ---------------------------------------------------------------------------
-- 1) Purge rows that cannot become uuid FKs
--    (guest-* local authors, malformed ids, ids not in profiles)
-- ---------------------------------------------------------------------------

-- Friendships referencing bad/missing profiles
delete from public.friendships f
where not public.is_uuid_text(f.user_id)
   or not public.is_uuid_text(f.friend_id)
   or not exists (select 1 from public.profiles p where p.id::text = f.user_id)
   or not exists (select 1 from public.profiles p where p.id::text = f.friend_id);

-- Notifications
delete from public.notifications n
where not public.is_uuid_text(n.user_id)
   or (n.actor_id is not null and not public.is_uuid_text(n.actor_id))
   or not exists (select 1 from public.profiles p where p.id::text = n.user_id)
   or (
     n.actor_id is not null
     and not exists (select 1 from public.profiles p where p.id::text = n.actor_id)
   );

-- Chat messages
delete from public.party_chat_messages m
where not public.is_uuid_text(m.sender_id)
   or not exists (select 1 from public.profiles p where p.id::text = m.sender_id);

-- Party members
delete from public.party_members pm
where not public.is_uuid_text(pm.user_id)
   or not exists (select 1 from public.profiles p where p.id::text = pm.user_id);

-- Likes
delete from public.comment_likes cl
where not public.is_uuid_text(cl.user_id)
   or not exists (select 1 from public.profiles p where p.id::text = cl.user_id);

delete from public.post_likes pl
where not public.is_uuid_text(pl.user_id)
   or not exists (select 1 from public.profiles p where p.id::text = pl.user_id);

-- Comments
delete from public.post_comments c
where not public.is_uuid_text(c.author_id)
   or not exists (select 1 from public.profiles p where p.id::text = c.author_id);

-- Posts (cascade removes dependent likes/comments/members/chat if any left)
delete from public.community_posts cp
where not public.is_uuid_text(cp.author_id)
   or not exists (select 1 from public.profiles p where p.id::text = cp.author_id);

-- Strip embedded party members from party_data (membership lives in party_members)
update public.community_posts
set party_data = party_data - 'members' - 'pendingMembers' - 'current'
where party_data is not null
  and (
    party_data ? 'members'
    or party_data ? 'pendingMembers'
    or party_data ? 'current'
  );

-- ---------------------------------------------------------------------------
-- 2) Drop policies that depend on text comparisons (recreated in section 5)
-- ---------------------------------------------------------------------------

-- community_posts
drop policy if exists "community_posts_select_all_auth" on public.community_posts;
drop policy if exists "community_posts_insert_auth" on public.community_posts;
drop policy if exists "community_posts_update_own" on public.community_posts;
drop policy if exists "community_posts_delete_own" on public.community_posts;

-- post_comments
drop policy if exists "post_comments_select_all_auth" on public.post_comments;
drop policy if exists "post_comments_insert_auth" on public.post_comments;
drop policy if exists "post_comments_update_own" on public.post_comments;
drop policy if exists "post_comments_delete_own" on public.post_comments;

-- post_likes
drop policy if exists "post_likes_select_all_auth" on public.post_likes;
drop policy if exists "post_likes_insert_own" on public.post_likes;
drop policy if exists "post_likes_delete_own" on public.post_likes;

-- comment_likes
drop policy if exists "comment_likes_select_all_auth" on public.comment_likes;
drop policy if exists "comment_likes_insert_own" on public.comment_likes;
drop policy if exists "comment_likes_delete_own" on public.comment_likes;

-- party_members
drop policy if exists "party_members_select_all_auth" on public.party_members;
drop policy if exists "party_members_insert_own" on public.party_members;
drop policy if exists "party_members_delete_own_non_host" on public.party_members;
drop policy if exists "party_members_update_by_host" on public.party_members;
drop policy if exists "party_members_update_own_rerequest" on public.party_members;

-- party_chat_messages
drop policy if exists "party_chat_messages_select_member_or_host" on public.party_chat_messages;
drop policy if exists "party_chat_messages_insert_member_or_host" on public.party_chat_messages;

-- notifications
drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
drop policy if exists "notifications_insert_related" on public.notifications;

-- friendships
drop policy if exists "friendships_select_involved" on public.friendships;
drop policy if exists "friendships_insert_own" on public.friendships;
drop policy if exists "friendships_delete_own" on public.friendships;
drop policy if exists "friendships_update_addressee" on public.friendships;
drop policy if exists "friendships_update_requester" on public.friendships;

-- Drop check constraints that break during text→uuid alters
alter table public.friendships
  drop constraint if exists friendships_no_self;
alter table public.friendships
  drop constraint if exists friendships_user_friend_unique;

-- ---------------------------------------------------------------------------
-- 3) Cast text → uuid + drop snapshot columns
-- ---------------------------------------------------------------------------

-- community_posts
alter table public.community_posts
  alter column author_id type uuid using author_id::uuid;

alter table public.community_posts
  drop column if exists author_name,
  drop column if exists author_avatar;

-- post_comments
alter table public.post_comments
  alter column author_id type uuid using author_id::uuid;

alter table public.post_comments
  drop column if exists author_name,
  drop column if exists author_avatar;

-- post_likes
alter table public.post_likes
  alter column user_id type uuid using user_id::uuid;

-- comment_likes
alter table public.comment_likes
  alter column user_id type uuid using user_id::uuid;

-- party_members
alter table public.party_members
  alter column user_id type uuid using user_id::uuid;

alter table public.party_members
  drop column if exists name,
  drop column if exists avatar;

-- party_chat_messages
alter table public.party_chat_messages
  alter column sender_id type uuid using sender_id::uuid;

alter table public.party_chat_messages
  drop column if exists sender_name,
  drop column if exists sender_avatar;

-- notifications
alter table public.notifications
  alter column user_id type uuid using user_id::uuid;

alter table public.notifications
  alter column actor_id type uuid using nullif(actor_id, '')::uuid;

-- friendships
alter table public.friendships
  alter column user_id type uuid using user_id::uuid;

alter table public.friendships
  alter column friend_id type uuid using friend_id::uuid;

alter table public.friendships
  add constraint friendships_user_friend_unique unique (user_id, friend_id);

alter table public.friendships
  add constraint friendships_no_self check (user_id <> friend_id);

-- ---------------------------------------------------------------------------
-- 4) Foreign keys → profiles (cascade / set null)
-- ---------------------------------------------------------------------------

alter table public.community_posts
  drop constraint if exists community_posts_author_id_fkey;
alter table public.community_posts
  add constraint community_posts_author_id_fkey
  foreign key (author_id) references public.profiles(id) on delete cascade;

alter table public.post_comments
  drop constraint if exists post_comments_author_id_fkey;
alter table public.post_comments
  add constraint post_comments_author_id_fkey
  foreign key (author_id) references public.profiles(id) on delete cascade;

alter table public.post_likes
  drop constraint if exists post_likes_user_id_fkey;
alter table public.post_likes
  add constraint post_likes_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.comment_likes
  drop constraint if exists comment_likes_user_id_fkey;
alter table public.comment_likes
  add constraint comment_likes_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.party_members
  drop constraint if exists party_members_user_id_fkey;
alter table public.party_members
  add constraint party_members_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.party_chat_messages
  drop constraint if exists party_chat_messages_sender_id_fkey;
alter table public.party_chat_messages
  add constraint party_chat_messages_sender_id_fkey
  foreign key (sender_id) references public.profiles(id) on delete cascade;

alter table public.notifications
  drop constraint if exists notifications_user_id_fkey;
alter table public.notifications
  add constraint notifications_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.notifications
  drop constraint if exists notifications_actor_id_fkey;
alter table public.notifications
  add constraint notifications_actor_id_fkey
  foreign key (actor_id) references public.profiles(id) on delete set null;

alter table public.friendships
  drop constraint if exists friendships_user_id_fkey;
alter table public.friendships
  add constraint friendships_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.friendships
  drop constraint if exists friendships_friend_id_fkey;
alter table public.friendships
  add constraint friendships_friend_id_fkey
  foreign key (friend_id) references public.profiles(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 5) RLS policies (uuid)
-- ---------------------------------------------------------------------------

-- community_posts
create policy "community_posts_select_all_auth"
  on public.community_posts for select
  to authenticated
  using (true);

create policy "community_posts_insert_auth"
  on public.community_posts for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "community_posts_update_own"
  on public.community_posts for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "community_posts_delete_own"
  on public.community_posts for delete
  to authenticated
  using (auth.uid() = author_id);

-- post_comments
create policy "post_comments_select_all_auth"
  on public.post_comments for select
  to authenticated
  using (true);

create policy "post_comments_insert_auth"
  on public.post_comments for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "post_comments_update_own"
  on public.post_comments for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "post_comments_delete_own"
  on public.post_comments for delete
  to authenticated
  using (auth.uid() = author_id);

-- post_likes
create policy "post_likes_select_all_auth"
  on public.post_likes for select
  to authenticated
  using (true);

create policy "post_likes_insert_own"
  on public.post_likes for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "post_likes_delete_own"
  on public.post_likes for delete
  to authenticated
  using (auth.uid() = user_id);

-- comment_likes
create policy "comment_likes_select_all_auth"
  on public.comment_likes for select
  to authenticated
  using (true);

create policy "comment_likes_insert_own"
  on public.comment_likes for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "comment_likes_delete_own"
  on public.comment_likes for delete
  to authenticated
  using (auth.uid() = user_id);

-- party_members
create policy "party_members_select_all_auth"
  on public.party_members for select
  to authenticated
  using (true);

create policy "party_members_insert_own"
  on public.party_members for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "party_members_delete_own_non_host"
  on public.party_members for delete
  to authenticated
  using (auth.uid() = user_id and is_host = false);

create policy "party_members_update_by_host"
  on public.party_members for update
  to authenticated
  using (
    exists (
      select 1 from public.community_posts cp
      where cp.id = party_members.post_id
        and cp.author_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.community_posts cp
      where cp.id = party_members.post_id
        and cp.author_id = auth.uid()
    )
  );

create policy "party_members_update_own_rerequest"
  on public.party_members for update
  to authenticated
  using (auth.uid() = user_id and is_host = false)
  with check (auth.uid() = user_id and is_host = false and status = 'pending');

-- party_chat_messages
create policy "party_chat_messages_select_member_or_host"
  on public.party_chat_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.party_members pm
      where pm.post_id = party_chat_messages.post_id
        and pm.user_id = auth.uid()
        and (pm.is_host = true or pm.status = 'accepted')
    )
    or exists (
      select 1 from public.community_posts cp
      where cp.id = party_chat_messages.post_id
        and cp.author_id = auth.uid()
    )
  );

create policy "party_chat_messages_insert_member_or_host"
  on public.party_chat_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and (
      exists (
        select 1 from public.party_members pm
        where pm.post_id = party_chat_messages.post_id
          and pm.user_id = auth.uid()
          and (pm.is_host = true or pm.status = 'accepted')
      )
      or exists (
        select 1 from public.community_posts cp
        where cp.id = party_chat_messages.post_id
          and cp.author_id = auth.uid()
      )
    )
  );

-- notifications
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "notifications_insert_related"
  on public.notifications for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and (
      (
        type = 'party_join_request'
        and exists (
          select 1 from public.community_posts cp
          where cp.id = notifications.post_id
            and cp.author_id = notifications.user_id
        )
        and exists (
          select 1 from public.party_members pm
          where pm.post_id = notifications.post_id
            and pm.user_id = auth.uid()
            and pm.status = 'pending'
        )
      )
      or (
        type in ('party_join_accepted', 'party_join_rejected')
        and exists (
          select 1 from public.community_posts cp
          where cp.id = notifications.post_id
            and cp.author_id = auth.uid()
        )
        and exists (
          select 1 from public.party_members pm
          where pm.post_id = notifications.post_id
            and pm.user_id = notifications.user_id
            and pm.is_host = false
        )
      )
      or (
        type = 'friend_request'
        and notifications.post_id is null
        and exists (
          select 1 from public.friendships f
          where f.user_id = auth.uid()
            and f.friend_id = notifications.user_id
            and f.status = 'pending'
        )
      )
      or (
        type in ('friend_accepted', 'friend_rejected')
        and notifications.post_id is null
        and exists (
          select 1 from public.friendships f
          where f.friend_id = auth.uid()
            and f.user_id = notifications.user_id
        )
      )
    )
  );

-- friendships
create policy "friendships_select_involved"
  on public.friendships for select
  to authenticated
  using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "friendships_insert_own"
  on public.friendships for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "friendships_delete_own"
  on public.friendships for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "friendships_update_addressee"
  on public.friendships for update
  to authenticated
  using (auth.uid() = friend_id)
  with check (auth.uid() = friend_id);

create policy "friendships_update_requester"
  on public.friendships for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6) Convenience view: post + author profile (optional read path)
-- ---------------------------------------------------------------------------
create or replace view public.community_posts_with_author
with (security_invoker = true)
as
select
  cp.*,
  p.display_name as author_name,
  p.avatar_url as author_avatar
from public.community_posts cp
join public.profiles p on p.id = cp.author_id;

-- ---------------------------------------------------------------------------
-- 7) Cleanup helper
-- ---------------------------------------------------------------------------
drop function if exists public.is_uuid_text(text);
