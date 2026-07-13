-- DM attachments storage + dm_message notifications

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dm-chat',
  'dm-chat',
  true,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "dm_chat_public_read" on storage.objects;
create policy "dm_chat_public_read"
  on storage.objects for select
  using (bucket_id = 'dm-chat');

drop policy if exists "dm_chat_insert_own" on storage.objects;
create policy "dm_chat_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'dm-chat'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

drop policy if exists "dm_chat_update_own" on storage.objects;
create policy "dm_chat_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'dm-chat'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

drop policy if exists "dm_chat_delete_own" on storage.objects;
create policy "dm_chat_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'dm-chat'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

-- Allow dm_message notification type
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
      'friend_rejected',
      'dm_message'
    )
  );

drop policy if exists "notifications_insert_related" on public.notifications;
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
      or (
        type = 'dm_message'
        and notifications.post_id is null
        and notifications.user_id <> auth.uid()
        and public.dm_are_accepted_friends(auth.uid(), notifications.user_id)
      )
    )
  );
