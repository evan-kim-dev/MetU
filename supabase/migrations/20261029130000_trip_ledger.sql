-- Trip ledger: members, expenses, shares (Step 5-A)

create table if not exists public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  user_id uuid references auth.users(id) on delete set null,
  is_owner boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists trip_members_trip_name_uidx
  on public.trip_members (trip_id, display_name);

create table if not exists public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  paid_by uuid not null references public.trip_members(id) on delete restrict,
  label text not null default '',
  category text not null default '기타',
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'KRW',
  fx_rate_to_krw numeric(14, 6) not null default 1,
  krw_amount bigint not null check (krw_amount > 0),
  place_id uuid references public.places(id) on delete set null,
  spent_on date,
  day_index int,
  receipt_path text,
  split_type text not null default 'equal'
    check (split_type in ('equal', 'custom')),
  created_at timestamptz not null default now()
);

create index if not exists trip_expenses_trip_idx
  on public.trip_expenses (trip_id, spent_on);

create table if not exists public.trip_expense_shares (
  expense_id uuid not null references public.trip_expenses(id) on delete cascade,
  member_id uuid not null references public.trip_members(id) on delete cascade,
  share_krw bigint not null check (share_krw >= 0),
  primary key (expense_id, member_id)
);

alter table public.trip_members enable row level security;
alter table public.trip_expenses enable row level security;
alter table public.trip_expense_shares enable row level security;

create policy "trip_members_owner_all"
  on public.trip_members for all
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and t.user_id = auth.uid()
    )
  );

create policy "trip_expenses_owner_all"
  on public.trip_expenses for all
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and t.user_id = auth.uid()
    )
  );

create policy "trip_expense_shares_owner_all"
  on public.trip_expense_shares for all
  using (
    exists (
      select 1
      from public.trip_expenses e
      join public.trips t on t.id = e.trip_id
      where e.id = expense_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.trip_expenses e
      join public.trips t on t.id = e.trip_id
      where e.id = expense_id and t.user_id = auth.uid()
    )
  );

create or replace function public.get_shared_ledger(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
  v_result jsonb;
begin
  select id into v_trip_id
  from public.trips
  where share_token = p_token
  limit 1;

  if v_trip_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'displayName', m.display_name,
        'isOwner', m.is_owner
      ) order by m.created_at)
      from public.trip_members m
      where m.trip_id = v_trip_id
    ), '[]'::jsonb),
    'expenses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'paidBy', e.paid_by,
        'label', e.label,
        'category', e.category,
        'amount', e.amount,
        'currency', e.currency,
        'fxRateToKrw', e.fx_rate_to_krw,
        'krwAmount', e.krw_amount,
        'placeId', e.place_id,
        'spentOn', e.spent_on,
        'dayIndex', e.day_index,
        'splitType', e.split_type,
        'shares', coalesce((
          select jsonb_object_agg(s.member_id::text, s.share_krw)
          from public.trip_expense_shares s
          where s.expense_id = e.id
        ), '{}'::jsonb)
      ) order by e.created_at)
      from public.trip_expenses e
      where e.trip_id = v_trip_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_shared_ledger(text) from public;
grant execute on function public.get_shared_ledger(text) to anon, authenticated;
