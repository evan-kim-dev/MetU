-- Party join approval (pending → accepted/rejected) + in-app notifications

-- 1) party_members.status
alter table public.party_members
  add column if not exists status text not null default 'accepted';

alter table public.party_members
  drop constraint if exists party_members_status_check;

alter table public.party_members
  add constraint party_members_status_check
  check (status in ('pending', 'accepted', 'rejected'));

create index if not exists party_members_post_status_idx
  on public.party_members (post_id, status);

-- Host can update member rows on their posts (accept/reject)
drop policy if exists "party_members_update_by_host" on public.party_members;
create policy "party_members_update_by_host"
  on public.party_members for update
  to authenticated
  using (
    exists (
      select 1 from public.community_posts cp
      where cp.id = party_members.post_id
        and cp.author_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1 from public.community_posts cp
      where cp.id = party_members.post_id
        and cp.author_id = auth.uid()::text
    )
  );

-- Applicant may re-request: update own rejected → pending
drop policy if exists "party_members_update_own_rerequest" on public.party_members;
create policy "party_members_update_own_rerequest"
  on public.party_members for update
  to authenticated
  using (auth.uid()::text = user_id and is_host = false)
  with check (auth.uid()::text = user_id and is_host = false and status = 'pending');

-- 2) Chat RLS: only accepted members or host (or post author)
drop policy if exists "party_chat_messages_select_member_or_host" on public.party_chat_messages;
create policy "party_chat_messages_select_member_or_host"
  on public.party_chat_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.party_members pm
      where pm.post_id = party_chat_messages.post_id
        and pm.user_id = auth.uid()::text
        and (pm.is_host = true or pm.status = 'accepted')
    )
    or exists (
      select 1 from public.community_posts cp
      where cp.id = party_chat_messages.post_id
        and cp.author_id = auth.uid()::text
    )
  );

drop policy if exists "party_chat_messages_insert_member_or_host" on public.party_chat_messages;
create policy "party_chat_messages_insert_member_or_host"
  on public.party_chat_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()::text
    and (
      exists (
        select 1 from public.party_members pm
        where pm.post_id = party_chat_messages.post_id
          and pm.user_id = auth.uid()::text
          and (pm.is_host = true or pm.status = 'accepted')
      )
      or exists (
        select 1 from public.community_posts cp
        where cp.id = party_chat_messages.post_id
          and cp.author_id = auth.uid()::text
      )
    )
  );

-- 3) notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  type text not null
    check (type in ('party_join_request', 'party_join_accepted', 'party_join_rejected')),
  post_id uuid references public.community_posts(id) on delete cascade,
  actor_id text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (auth.uid()::text = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- Insert: actor must be self; recipient rules by type
drop policy if exists "notifications_insert_related" on public.notifications;
create policy "notifications_insert_related"
  on public.notifications for insert
  to authenticated
  with check (
    actor_id = auth.uid()::text
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
            and pm.user_id = auth.uid()::text
            and pm.status = 'pending'
        )
      )
      or (
        type in ('party_join_accepted', 'party_join_rejected')
        and exists (
          select 1 from public.community_posts cp
          where cp.id = notifications.post_id
            and cp.author_id = auth.uid()::text
        )
        and exists (
          select 1 from public.party_members pm
          where pm.post_id = notifications.post_id
            and pm.user_id = notifications.user_id
            and pm.is_host = false
        )
      )
    )
  );
