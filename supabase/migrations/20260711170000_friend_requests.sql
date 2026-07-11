-- Friend request approval + notification types

-- 1) friendships.status
alter table public.friendships
  add column if not exists status text;

update public.friendships
set status = 'accepted'
where status is null;

alter table public.friendships
  alter column status set default 'pending';

alter table public.friendships
  alter column status set not null;

alter table public.friendships
  drop constraint if exists friendships_status_check;

alter table public.friendships
  add constraint friendships_status_check
  check (status in ('pending', 'accepted', 'rejected'));

create index if not exists friendships_friend_status_idx
  on public.friendships (friend_id, status);

create index if not exists friendships_user_status_idx
  on public.friendships (user_id, status);

-- Addressee can accept/reject
drop policy if exists "friendships_update_addressee" on public.friendships;
create policy "friendships_update_addressee"
  on public.friendships for update
  to authenticated
  using (auth.uid()::text = friend_id)
  with check (auth.uid()::text = friend_id);

-- Requester can cancel pending / remove accepted
drop policy if exists "friendships_update_requester" on public.friendships;
create policy "friendships_update_requester"
  on public.friendships for update
  to authenticated
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

-- 2) notifications: allow friend request types
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'party_join_request',
      'party_join_accepted',
      'party_join_rejected',
      'friend_request',
      'friend_accepted',
      'friend_rejected'
    )
  );

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
      or (
        type = 'friend_request'
        and notifications.post_id is null
        and exists (
          select 1 from public.friendships f
          where f.user_id = auth.uid()::text
            and f.friend_id = notifications.user_id
            and f.status = 'pending'
        )
      )
      or (
        type in ('friend_accepted', 'friend_rejected')
        and notifications.post_id is null
        and exists (
          select 1 from public.friendships f
          where f.friend_id = auth.uid()::text
            and f.user_id = notifications.user_id
        )
      )
    )
  );
