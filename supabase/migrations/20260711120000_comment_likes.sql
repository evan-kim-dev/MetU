-- Comment likes (per-comment heart)
create table if not exists public.comment_likes (
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists comment_likes_comment_id_idx
  on public.comment_likes (comment_id);

alter table public.comment_likes enable row level security;

create policy "comment_likes_select_all_auth"
  on public.comment_likes for select
  to authenticated
  using (true);

create policy "comment_likes_insert_own"
  on public.comment_likes for insert
  to authenticated
  with check (auth.uid()::text = user_id);

create policy "comment_likes_delete_own"
  on public.comment_likes for delete
  to authenticated
  using (auth.uid()::text = user_id);
