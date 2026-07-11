-- Friendships: user_id adds friend_id (one-way, instant)
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  friend_id text not null,
  created_at timestamptz not null default now(),
  constraint friendships_user_friend_unique unique (user_id, friend_id),
  constraint friendships_no_self check (user_id <> friend_id)
);

create index if not exists friendships_user_id_idx
  on public.friendships (user_id);

create index if not exists friendships_friend_id_idx
  on public.friendships (friend_id);

alter table public.friendships enable row level security;

drop policy if exists "friendships_select_involved" on public.friendships;
create policy "friendships_select_involved"
  on public.friendships for select
  to authenticated
  using (
    auth.uid()::text = user_id
    or auth.uid()::text = friend_id
  );

drop policy if exists "friendships_insert_own" on public.friendships;
create policy "friendships_insert_own"
  on public.friendships for insert
  to authenticated
  with check (auth.uid()::text = user_id);

drop policy if exists "friendships_delete_own" on public.friendships;
create policy "friendships_delete_own"
  on public.friendships for delete
  to authenticated
  using (auth.uid()::text = user_id);
