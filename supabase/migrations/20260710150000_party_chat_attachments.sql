insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'party-chat',
  'party-chat',
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

drop policy if exists "party_chat_public_read" on storage.objects;
create policy "party_chat_public_read"
  on storage.objects for select
  using (bucket_id = 'party-chat');

drop policy if exists "party_chat_insert_own" on storage.objects;
create policy "party_chat_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'party-chat'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

drop policy if exists "party_chat_update_own" on storage.objects;
create policy "party_chat_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'party-chat'
    and auth.uid()::text = (storage.foldername(name))[2]
  );

drop policy if exists "party_chat_delete_own" on storage.objects;
create policy "party_chat_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'party-chat'
    and auth.uid()::text = (storage.foldername(name))[2]
  );
