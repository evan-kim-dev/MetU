-- 분담 대화 첨부 (사진·파일). Additive only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-split-chat',
  'trip-split-chat',
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
    'application/zip'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- path: {tripId}/{userId}/{uuid}.ext
drop policy if exists "trip_split_chat_public_read" on storage.objects;
create policy "trip_split_chat_public_read"
  on storage.objects for select
  using (bucket_id = 'trip-split-chat');

drop policy if exists "trip_split_chat_insert_own" on storage.objects;
create policy "trip_split_chat_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'trip-split-chat'
    and (select auth.uid())::text = (storage.foldername(name))[2]
    and public.is_trip_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "trip_split_chat_update_own" on storage.objects;
create policy "trip_split_chat_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'trip-split-chat'
    and (select auth.uid())::text = (storage.foldername(name))[2]
  );

drop policy if exists "trip_split_chat_delete_own" on storage.objects;
create policy "trip_split_chat_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'trip-split-chat'
    and (select auth.uid())::text = (storage.foldername(name))[2]
  );
