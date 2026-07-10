create table if not exists public.party_chat_messages (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  sender_id text not null,
  sender_name text not null default '',
  sender_avatar text not null default '💬',
  message text not null check (char_length(trim(message)) > 0 and char_length(message) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists party_chat_messages_post_created_idx
  on public.party_chat_messages (post_id, created_at asc);

alter table public.party_chat_messages enable row level security;

create policy "party_chat_messages_select_member_or_host"
  on public.party_chat_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.party_members pm
      where pm.post_id = party_chat_messages.post_id
        and pm.user_id = auth.uid()::text
    )
    or exists (
      select 1 from public.community_posts cp
      where cp.id = party_chat_messages.post_id
        and cp.author_id = auth.uid()::text
    )
  );

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
      )
      or exists (
        select 1 from public.community_posts cp
        where cp.id = party_chat_messages.post_id
          and cp.author_id = auth.uid()::text
      )
    )
  );
