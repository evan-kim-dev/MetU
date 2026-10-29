-- L-1A: expand Step 5-A ledger into full trip ledger core
-- Additive where possible; keeps trips.expenses jsonb untouched.

-- ---------------------------------------------------------------------------
-- trips date / currency helpers
-- ---------------------------------------------------------------------------
alter table public.trips
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists local_currency text;

do $$ begin
  alter table public.trips
    add constraint trips_local_currency_chk
    check (local_currency is null or local_currency ~ '^[A-Z]{3}$');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- trip_members: role + composite unique for FK pairs
-- ---------------------------------------------------------------------------
alter table public.trip_members
  add column if not exists role text;

update public.trip_members
set role = case when coalesce(is_owner, false) then 'owner' else 'member' end
where role is null;

alter table public.trip_members
  alter column role set default 'member';

do $$ begin
  alter table public.trip_members
    add constraint trip_members_role_chk
    check (role in ('owner', 'member'));
exception when duplicate_object then null;
end $$;

create unique index if not exists trip_members_id_trip_uidx
  on public.trip_members (id, trip_id);

create unique index if not exists trip_members_trip_user_uidx
  on public.trip_members (trip_id, user_id)
  where user_id is not null;

drop index if exists trip_members_trip_name_uidx;
create unique index if not exists trip_members_trip_name_uidx
  on public.trip_members (trip_id, lower(display_name));

-- ---------------------------------------------------------------------------
-- helpers (after trip_members)
-- ---------------------------------------------------------------------------
create or replace function public.is_trip_owner(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id and t.user_id = auth.uid()
  );
$$;

create or replace function public.is_trip_member(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_trip_owner(p_trip_id)
      or exists (
        select 1 from public.trip_members m
        where m.trip_id = p_trip_id and m.user_id = auth.uid()
      );
$$;

revoke all on function public.is_trip_owner(uuid) from public;
revoke all on function public.is_trip_member(uuid) from public;
grant execute on function public.is_trip_owner(uuid) to authenticated;
grant execute on function public.is_trip_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- trip_invites
-- ---------------------------------------------------------------------------
create table if not exists public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  claim_member_id uuid,
  expires_at timestamptz not null,
  max_uses int not null default 10 check (max_uses between 1 and 50),
  use_count int not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (claim_member_id, trip_id)
    references public.trip_members(id, trip_id)
    on delete set null
);

-- ---------------------------------------------------------------------------
-- ledger_card_profiles
-- ---------------------------------------------------------------------------
create table if not exists public.ledger_card_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  kind text not null check (kind in ('credit', 'debit', 'travel_prepaid', 'cash')),
  fee_rate numeric(7, 5)
    check (fee_rate is null or (fee_rate >= 0 and fee_rate <= 0.1)),
  fee_flat_krw integer not null default 0 check (fee_flat_krw >= 0),
  note text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- expand trip_expenses (keep legacy columns for Step 5 UI)
-- ---------------------------------------------------------------------------
alter table public.trip_expenses
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists merchant text default '',
  add column if not exists merchant_ko text,
  add column if not exists payment_method text default 'card',
  add column if not exists card_profile_id uuid
    references public.ledger_card_profiles(id) on delete set null,
  add column if not exists card_label text,
  add column if not exists fx_rate numeric(18, 8),
  add column if not exists fx_rate_date date,
  add column if not exists fx_source text,
  add column if not exists fx_is_fallback boolean not null default false,
  add column if not exists fee_rate numeric(7, 5) not null default 0,
  add column if not exists fee_flat_krw integer not null default 0,
  add column if not exists krw_base bigint,
  add column if not exists fee_krw bigint not null default 0,
  add column if not exists source text default 'manual',
  add column if not exists raw_input jsonb,
  add column if not exists items jsonb not null default '[]'::jsonb,
  add column if not exists paid_at timestamptz,
  add column if not exists time_is_estimated boolean not null default false,
  add column if not exists dedupe_hash text,
  add column if not exists note text,
  add column if not exists updated_at timestamptz not null default now();

-- backfill from legacy columns
update public.trip_expenses
set
  merchant = coalesce(nullif(merchant, ''), nullif(label, ''), ''),
  fx_rate = coalesce(fx_rate, fx_rate_to_krw, 1),
  fx_source = coalesce(fx_source, 'auto_daily'),
  krw_base = coalesce(krw_base, krw_amount),
  source = coalesce(source, 'manual'),
  spent_on = coalesce(spent_on, (created_at at time zone 'Asia/Seoul')::date)
where true;

-- widen split_type (drop old check if present, add new)
do $$ begin
  alter table public.trip_expenses drop constraint if exists trip_expenses_split_type_check;
exception when undefined_object then null;
end $$;

alter table public.trip_expenses
  drop constraint if exists trip_expenses_split_type_check;

do $$ begin
  alter table public.trip_expenses
    add constraint trip_expenses_split_type_check
    check (split_type in ('equal', 'custom', 'fixed', 'ratio'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.trip_expenses
    add constraint trip_expenses_payment_method_chk
    check (payment_method in ('card', 'cash', 'transfer'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.trip_expenses
    add constraint trip_expenses_source_chk
    check (source in ('receipt', 'sms', 'manual', 'voice'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.trip_expenses
    add constraint trip_expenses_fx_source_chk
    check (fx_source in ('auto_daily', 'cash_manual'));
exception when duplicate_object then null;
end $$;

create unique index if not exists trip_expenses_id_trip_uidx
  on public.trip_expenses (id, trip_id);

create index if not exists trip_expenses_trip_date_idx
  on public.trip_expenses (trip_id, spent_on);

create index if not exists trip_expenses_dedupe_idx
  on public.trip_expenses (trip_id, dedupe_hash);

-- ---------------------------------------------------------------------------
-- trip_expense_shares: trip_id + input_value
-- ---------------------------------------------------------------------------
alter table public.trip_expense_shares
  add column if not exists trip_id uuid,
  add column if not exists input_value numeric(18, 4);

update public.trip_expense_shares s
set trip_id = e.trip_id
from public.trip_expenses e
where s.expense_id = e.id and s.trip_id is null;

-- ---------------------------------------------------------------------------
-- cash rates + fx cache + settlements
-- ---------------------------------------------------------------------------
create table if not exists public.trip_cash_rates (
  trip_id uuid not null,
  member_id uuid not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  krw_per_unit numeric(18, 8) not null check (krw_per_unit > 0),
  note text,
  updated_at timestamptz not null default now(),
  primary key (trip_id, member_id, currency),
  foreign key (member_id, trip_id)
    references public.trip_members(id, trip_id) on delete cascade
);

create table if not exists public.fx_rates (
  rate_date date not null,
  base text not null check (base ~ '^[A-Z]{3}$'),
  quote text not null check (quote ~ '^[A-Z]{3}$'),
  rate numeric(18, 8) not null check (rate > 0),
  provider text not null default 'frankfurter',
  fetched_at timestamptz not null default now(),
  primary key (rate_date, base, quote)
);

create table if not exists public.trip_settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  version int not null,
  status text not null default 'open'
    check (status in ('open', 'completed', 'superseded')),
  basis_hash text not null,
  share_token text unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (trip_id, version),
  unique (id, trip_id)
);

create table if not exists public.trip_settlement_transfers (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null,
  trip_id uuid not null,
  from_member uuid not null,
  to_member uuid not null,
  krw bigint not null check (krw > 0),
  status text not null default 'pending'
    check (status in ('pending', 'paid')),
  paid_at timestamptz,
  confirmed_at timestamptz,
  foreign key (settlement_id, trip_id)
    references public.trip_settlements(id, trip_id) on delete cascade,
  foreign key (from_member, trip_id)
    references public.trip_members(id, trip_id),
  foreign key (to_member, trip_id)
    references public.trip_members(id, trip_id),
  check (from_member <> to_member)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.trip_invites enable row level security;
alter table public.ledger_card_profiles enable row level security;
alter table public.trip_cash_rates enable row level security;
alter table public.fx_rates enable row level security;
alter table public.trip_settlements enable row level security;
alter table public.trip_settlement_transfers enable row level security;

-- replace member policies with is_trip_member helpers
drop policy if exists "trip_members_owner_all" on public.trip_members;
create policy "trip_members_select"
  on public.trip_members for select
  using (public.is_trip_member(trip_id));
create policy "trip_members_insert"
  on public.trip_members for insert
  with check (public.is_trip_owner(trip_id));
create policy "trip_members_update"
  on public.trip_members for update
  using (public.is_trip_owner(trip_id) or user_id = auth.uid());
create policy "trip_members_delete"
  on public.trip_members for delete
  using (public.is_trip_owner(trip_id) and role <> 'owner');

drop policy if exists "trip_expenses_owner_all" on public.trip_expenses;
create policy "trip_expenses_select"
  on public.trip_expenses for select
  using (public.is_trip_member(trip_id));
create policy "trip_expenses_insert"
  on public.trip_expenses for insert
  with check (
    public.is_trip_member(trip_id)
    and created_by = auth.uid()
  );
create policy "trip_expenses_update"
  on public.trip_expenses for update
  using (created_by = auth.uid() or public.is_trip_owner(trip_id));
create policy "trip_expenses_delete"
  on public.trip_expenses for delete
  using (created_by = auth.uid() or public.is_trip_owner(trip_id));

drop policy if exists "trip_expense_shares_owner_all" on public.trip_expense_shares;
create policy "trip_expense_shares_select"
  on public.trip_expense_shares for select
  using (public.is_trip_member(trip_id));
create policy "trip_expense_shares_write"
  on public.trip_expense_shares for all
  using (
    public.is_trip_owner(trip_id)
    or exists (
      select 1 from public.trip_expenses e
      where e.id = expense_id and e.created_by = auth.uid()
    )
  )
  with check (
    public.is_trip_owner(trip_id)
    or exists (
      select 1 from public.trip_expenses e
      where e.id = expense_id and e.created_by = auth.uid()
    )
  );

create policy "trip_invites_owner"
  on public.trip_invites for all
  using (public.is_trip_owner(trip_id))
  with check (public.is_trip_owner(trip_id));

create policy "ledger_card_profiles_own"
  on public.ledger_card_profiles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "trip_cash_rates_select"
  on public.trip_cash_rates for select
  using (public.is_trip_member(trip_id));
create policy "trip_cash_rates_write"
  on public.trip_cash_rates for all
  using (
    public.is_trip_owner(trip_id)
    or exists (
      select 1 from public.trip_members m
      where m.id = member_id and m.user_id = auth.uid()
    )
  )
  with check (
    public.is_trip_owner(trip_id)
    or exists (
      select 1 from public.trip_members m
      where m.id = member_id and m.user_id = auth.uid()
    )
  );

create policy "fx_rates_select_auth"
  on public.fx_rates for select
  to authenticated
  using (true);

create policy "trip_settlements_select"
  on public.trip_settlements for select
  using (public.is_trip_member(trip_id));

create policy "trip_settlement_transfers_select"
  on public.trip_settlement_transfers for select
  using (public.is_trip_member(trip_id));

-- ---------------------------------------------------------------------------
-- RPCs (core set)
-- ---------------------------------------------------------------------------
create or replace function public.ensure_trip_owner_member(p_trip_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
begin
  if not public.is_trip_owner(p_trip_id) then
    raise exception 'forbidden';
  end if;

  select id into v_id
  from public.trip_members
  where trip_id = p_trip_id and role = 'owner'
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  select coalesce(nullif(trim(p.display_name), ''), '나') into v_name
  from public.profiles p
  where p.id = auth.uid();

  if v_name is null then
    v_name := '나';
  end if;

  insert into public.trip_members (trip_id, user_id, display_name, role, is_owner)
  values (p_trip_id, auth.uid(), left(v_name, 30), 'owner', true)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.create_trip_invite(
  p_trip_id uuid,
  p_ttl_hours int default 72,
  p_max_uses int default 10,
  p_claim_member_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_hash text;
begin
  if not public.is_trip_owner(p_trip_id) then
    raise exception 'forbidden';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');
  v_hash := encode(sha256(convert_to(v_token, 'utf8')), 'hex');

  insert into public.trip_invites (
    trip_id, token_hash, created_by, claim_member_id, expires_at, max_uses
  ) values (
    p_trip_id,
    v_hash,
    auth.uid(),
    p_claim_member_id,
    now() + make_interval(hours => greatest(1, least(p_ttl_hours, 168))),
    greatest(1, least(coalesce(p_max_uses, 10), 50))
  );

  return v_token;
end;
$$;

create or replace function public.preview_trip_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_inv public.trip_invites%rowtype;
  v_trip public.trips%rowtype;
begin
  if auth.uid() is null then
    return null;
  end if;
  v_hash := encode(sha256(convert_to(p_token, 'utf8')), 'hex');
  select * into v_inv from public.trip_invites where token_hash = v_hash;
  if not found then return null; end if;
  if v_inv.revoked_at is not null or v_inv.expires_at <= now()
     or v_inv.use_count >= v_inv.max_uses then
    return null;
  end if;

  select * into v_trip from public.trips where id = v_inv.trip_id;
  if not found then return null; end if;

  return jsonb_build_object(
    'tripId', v_trip.id,
    'destination', v_trip.destination,
    'dateRange', v_trip.date_range,
    'ownerName', coalesce(
      (select display_name from public.trip_members
       where trip_id = v_trip.id and role = 'owner' limit 1),
      '호스트'
    ),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'displayName', m.display_name,
        'claimable', (m.user_id is null)
      ) order by m.created_at)
      from public.trip_members m where m.trip_id = v_trip.id
    ), '[]'::jsonb),
    'claimMemberId', v_inv.claim_member_id
  );
end;
$$;

create or replace function public.join_trip(
  p_token text,
  p_claim_member_id uuid default null,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_inv public.trip_invites%rowtype;
  v_existing uuid;
  v_id uuid;
  v_name text;
  v_claim uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  v_hash := encode(sha256(convert_to(p_token, 'utf8')), 'hex');

  update public.trip_invites
  set use_count = use_count + 1
  where token_hash = v_hash
    and revoked_at is null
    and expires_at > now()
    and use_count < max_uses
  returning * into v_inv;

  if not found then
    raise exception 'invite-invalid';
  end if;

  select id into v_existing
  from public.trip_members
  where trip_id = v_inv.trip_id and user_id = auth.uid()
  limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  v_claim := coalesce(p_claim_member_id, v_inv.claim_member_id);
  if v_claim is not null then
    update public.trip_members
    set user_id = auth.uid()
    where id = v_claim and trip_id = v_inv.trip_id and user_id is null
    returning id into v_id;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  v_name := left(coalesce(nullif(trim(p_display_name), ''), '동행'), 30);
  insert into public.trip_members (trip_id, user_id, display_name, role, is_owner)
  values (v_inv.trip_id, auth.uid(), v_name, 'member', false)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.get_ledger_trip(p_trip_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip public.trips%rowtype;
begin
  if not public.is_trip_member(p_trip_id) then
    return null;
  end if;
  select * into v_trip from public.trips where id = p_trip_id;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', v_trip.id,
    'destination', v_trip.destination,
    'dateRange', v_trip.date_range,
    'startDate', v_trip.start_date,
    'endDate', v_trip.end_date,
    'localCurrency', v_trip.local_currency,
    'budget', v_trip.budget,
    'people', v_trip.people,
    'budgetAllocation', v_trip.budget_allocation
  );
end;
$$;

create or replace function public.get_shared_settlement(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s public.trip_settlements%rowtype;
  v_trip public.trips%rowtype;
begin
  select * into v_s from public.trip_settlements where share_token = p_token;
  if not found then return null; end if;
  select * into v_trip from public.trips where id = v_s.trip_id;

  return jsonb_build_object(
    'destination', v_trip.destination,
    'dateRange', v_trip.date_range,
    'version', v_s.version,
    'status', v_s.status,
    'completedAt', v_s.completed_at,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'displayName', m.display_name
      ))
      from public.trip_members m where m.trip_id = v_s.trip_id
    ), '[]'::jsonb),
    'transfers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'from', t.from_member,
        'to', t.to_member,
        'krw', t.krw,
        'status', t.status
      ))
      from public.trip_settlement_transfers t
      where t.settlement_id = v_s.id
    ), '[]'::jsonb),
    'totals', jsonb_build_object(
      'totalKrw', coalesce((
        select sum(e.krw_amount)::bigint from public.trip_expenses e
        where e.trip_id = v_s.trip_id
      ), 0)
    )
  );
end;
$$;

revoke all on function public.ensure_trip_owner_member(uuid) from public;
revoke all on function public.create_trip_invite(uuid, int, int, uuid) from public;
revoke all on function public.preview_trip_invite(text) from public;
revoke all on function public.join_trip(text, uuid, text) from public;
revoke all on function public.get_ledger_trip(uuid) from public;
revoke all on function public.get_shared_settlement(text) from public;

grant execute on function public.ensure_trip_owner_member(uuid) to authenticated;
grant execute on function public.create_trip_invite(uuid, int, int, uuid) to authenticated;
grant execute on function public.preview_trip_invite(text) to authenticated;
grant execute on function public.join_trip(text, uuid, text) to authenticated;
grant execute on function public.get_ledger_trip(uuid) to authenticated;
grant execute on function public.get_shared_settlement(text) to anon, authenticated;

-- Realtime
do $$ begin
  alter publication supabase_realtime add table public.trip_expenses;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.trip_expense_shares;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.trip_members;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.trip_settlements;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.trip_settlement_transfers;
exception when duplicate_object then null;
end $$;
