-- 1:1 DM threads & messages (friends only)

create table if not exists public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  user_low uuid not null references public.profiles(id) on delete cascade,
  user_high uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint dm_threads_ordered check (user_low < user_high),
  constraint dm_threads_pair_unique unique (user_low, user_high)
);

create index if not exists dm_threads_user_low_idx on public.dm_threads (user_low);
create index if not exists dm_threads_user_high_idx on public.dm_threads (user_high);
create index if not exists dm_threads_last_message_idx
  on public.dm_threads (last_message_at desc);

create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  message text not null
    check (char_length(trim(message)) > 0 and char_length(message) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists dm_messages_thread_created_idx
  on public.dm_messages (thread_id, created_at asc);

create or replace function public.dm_are_accepted_friends(a uuid, b uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.user_id = a and f.friend_id = b)
        or (f.user_id = b and f.friend_id = a)
      )
  );
$$;

create or replace function public.dm_touch_thread_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.dm_threads
  set last_message_at = new.created_at
  where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists dm_messages_touch_thread on public.dm_messages;
create trigger dm_messages_touch_thread
  after insert on public.dm_messages
  for each row
  execute function public.dm_touch_thread_last_message();

alter table public.dm_threads enable row level security;
alter table public.dm_messages enable row level security;

drop policy if exists "dm_threads_select_participant_friend" on public.dm_threads;
create policy "dm_threads_select_participant_friend"
  on public.dm_threads for select
  to authenticated
  using (
    (auth.uid() = user_low or auth.uid() = user_high)
    and public.dm_are_accepted_friends(user_low, user_high)
  );

drop policy if exists "dm_threads_insert_participant_friend" on public.dm_threads;
create policy "dm_threads_insert_participant_friend"
  on public.dm_threads for insert
  to authenticated
  with check (
    (auth.uid() = user_low or auth.uid() = user_high)
    and public.dm_are_accepted_friends(user_low, user_high)
  );

drop policy if exists "dm_messages_select_participant_friend" on public.dm_messages;
create policy "dm_messages_select_participant_friend"
  on public.dm_messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.dm_threads t
      where t.id = dm_messages.thread_id
        and (auth.uid() = t.user_low or auth.uid() = t.user_high)
        and public.dm_are_accepted_friends(t.user_low, t.user_high)
    )
  );

drop policy if exists "dm_messages_insert_own_participant_friend" on public.dm_messages;
create policy "dm_messages_insert_own_participant_friend"
  on public.dm_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.dm_threads t
      where t.id = dm_messages.thread_id
        and (auth.uid() = t.user_low or auth.uid() = t.user_high)
        and public.dm_are_accepted_friends(t.user_low, t.user_high)
    )
  );

do $$
begin
  alter publication supabase_realtime add table public.dm_messages;
exception
  when duplicate_object then null;
end $$;
