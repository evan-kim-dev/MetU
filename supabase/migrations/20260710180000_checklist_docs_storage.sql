insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'checklist-docs',
  'checklist-docs',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "checklist_docs_public_read" on storage.objects;
create policy "checklist_docs_public_read"
  on storage.objects for select
  using (bucket_id = 'checklist-docs');

drop policy if exists "checklist_docs_insert_own" on storage.objects;
create policy "checklist_docs_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'checklist-docs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "checklist_docs_update_own" on storage.objects;
create policy "checklist_docs_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'checklist-docs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "checklist_docs_delete_own" on storage.objects;
create policy "checklist_docs_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'checklist-docs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
