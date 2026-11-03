-- S0: 익명(게스트) 권한 제한 + 지출 제안 + 결제자 변경 RPC.
-- 익명 JWT = role authenticated + claim is_anonymous=true.
-- restrictive 정책은 기존 permissive 와 AND 로 합쳐진다.
-- 전부 멱등(if not exists / drop if exists / create or replace).

-- ---------------------------------------------------------------------------
-- A) 익명 INSERT 차단 (테이블이 있을 때만)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'trips',
    'trip_invites',
    'community_posts',
    'post_comments',
    'post_likes',
    'party_members',
    'party_chat_messages',
    'trip_plans',
    'budget_insight_logs'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists anon_block_insert on public.%I', t);
      execute format(
        $f$
        create policy anon_block_insert on public.%I
          as restrictive
          for insert
          to authenticated
          with check (
            (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true
          )
        $f$,
        t
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- B) 게스트는 trip_expenses / trip_expense_shares 직접 쓰기 불가
--    (앱 서버 agent_* security definer / 호스트 세션만 씀)
-- ---------------------------------------------------------------------------
drop policy if exists anon_block_insert on public.trip_expenses;
create policy anon_block_insert on public.trip_expenses
  as restrictive
  for insert
  to authenticated
  with check (
    (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true
  );

drop policy if exists anon_block_update on public.trip_expenses;
create policy anon_block_update on public.trip_expenses
  as restrictive
  for update
  to authenticated
  using (
    (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true
  )
  with check (
    (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true
  );

drop policy if exists anon_block_delete on public.trip_expenses;
create policy anon_block_delete on public.trip_expenses
  as restrictive
  for delete
  to authenticated
  using (
    (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true
  );

drop policy if exists anon_block_insert on public.trip_expense_shares;
create policy anon_block_insert on public.trip_expense_shares
  as restrictive
  for insert
  to authenticated
  with check (
    (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true
  );

drop policy if exists anon_block_update on public.trip_expense_shares;
create policy anon_block_update on public.trip_expense_shares
  as restrictive
  for update
  to authenticated
  using (
    (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true
  )
  with check (
    (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true
  );

drop policy if exists anon_block_delete on public.trip_expense_shares;
create policy anon_block_delete on public.trip_expense_shares
  as restrictive
  for delete
  to authenticated
  using (
    (select (auth.jwt() ->> 'is_anonymous')::boolean) is not true
  );

-- ---------------------------------------------------------------------------
-- C) trip_members: 게스트는 role / trip_id / user_id 변경 금지 (display_name 허용)
-- ---------------------------------------------------------------------------
create or replace function public.trip_members_guest_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (select (auth.jwt() ->> 'is_anonymous')::boolean) is true then
    if new.trip_id is distinct from old.trip_id
       or new.user_id is distinct from old.user_id
       or new.role is distinct from old.role then
      raise exception 'guest-cannot-change-membership'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trip_members_guest_guard on public.trip_members;
create trigger trip_members_guest_guard
  before update on public.trip_members
  for each row
  execute function public.trip_members_guest_guard();

-- ---------------------------------------------------------------------------
-- D) 지출 제안 테이블 + RLS + 트리거 + resolve RPC
-- ---------------------------------------------------------------------------
create table if not exists public.trip_expense_proposals (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  proposed_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  proposer_member_id uuid not null references public.trip_members (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  category text not null default '기타' check (char_length(category) <= 20),
  spent_on date,
  note text check (note is null or char_length(note) <= 200),
  items jsonb not null default '[]'::jsonb
    check (jsonb_typeof(items) = 'array' and pg_column_size(items) <= 8000),
  source text not null default 'guest' check (source in ('guest', 'receipt')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  resolved_by uuid references auth.users (id),
  resolved_at timestamptz,
  resolved_expense_id uuid references public.trip_expenses (id) on delete set null,
  reject_reason text check (reject_reason is null or char_length(reject_reason) <= 100),
  created_at timestamptz not null default now()
);

create index if not exists trip_expense_proposals_trip_status_idx
  on public.trip_expense_proposals (trip_id, status, created_at desc);

alter table public.trip_expense_proposals enable row level security;

drop policy if exists trip_expense_proposals_select on public.trip_expense_proposals;
create policy trip_expense_proposals_select
  on public.trip_expense_proposals
  for select
  to authenticated
  using (
    public.is_trip_owner(trip_id)
    or proposed_by = (select auth.uid())
  );

drop policy if exists trip_expense_proposals_insert on public.trip_expense_proposals;
create policy trip_expense_proposals_insert
  on public.trip_expense_proposals
  for insert
  to authenticated
  with check (
    proposed_by = (select auth.uid())
    and status = 'pending'
    and public.is_trip_member(trip_id)
    and exists (
      select 1
      from public.trip_members m
      where m.id = proposer_member_id
        and m.trip_id = trip_expense_proposals.trip_id
        and m.user_id = (select auth.uid())
    )
  );

revoke all on public.trip_expense_proposals from anon;
revoke update, delete on public.trip_expense_proposals from authenticated;
grant select, insert on public.trip_expense_proposals to authenticated;

create or replace function public.trip_expense_proposals_pending_cap()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_pending int;
  v_trip_pending int;
begin
  select count(*)::int into v_user_pending
  from public.trip_expense_proposals
  where trip_id = new.trip_id
    and proposed_by = new.proposed_by
    and status = 'pending';

  if v_user_pending >= 5 then
    raise exception 'too-many-pending' using errcode = '23514';
  end if;

  select count(*)::int into v_trip_pending
  from public.trip_expense_proposals
  where trip_id = new.trip_id
    and status = 'pending';

  if v_trip_pending >= 50 then
    raise exception 'too-many-pending' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trip_expense_proposals_pending_cap on public.trip_expense_proposals;
create trigger trip_expense_proposals_pending_cap
  before insert on public.trip_expense_proposals
  for each row
  execute function public.trip_expense_proposals_pending_cap();

create or replace function public.resolve_expense_proposal(
  p_id uuid,
  p_decision text,
  p_expense_id uuid default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.trip_expense_proposals%rowtype;
begin
  if v_uid is null then
    raise exception 'not-authenticated' using errcode = '28000';
  end if;

  select * into v_row
  from public.trip_expense_proposals
  where id = p_id
  for update;

  if not found then
    raise exception 'not-found';
  end if;

  if v_row.status <> 'pending' then
    raise exception 'not-pending';
  end if;

  if p_decision = 'approved' or p_decision = 'rejected' then
    if not public.is_trip_owner(v_row.trip_id) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  elsif p_decision = 'withdrawn' then
    if v_row.proposed_by <> v_uid then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  else
    raise exception 'bad-decision';
  end if;

  if p_decision = 'approved' then
    if p_expense_id is null then
      raise exception 'bad-expense';
    end if;
    if not exists (
      select 1
      from public.trip_expenses e
      where e.id = p_expense_id
        and e.trip_id = v_row.trip_id
        and e.status in ('confirmed', 'auto')
    ) then
      raise exception 'bad-expense';
    end if;

    update public.trip_expense_proposals
    set
      status = 'approved',
      resolved_by = v_uid,
      resolved_at = now(),
      resolved_expense_id = p_expense_id,
      reject_reason = null
    where id = p_id;
  elsif p_decision = 'rejected' then
    update public.trip_expense_proposals
    set
      status = 'rejected',
      resolved_by = v_uid,
      resolved_at = now(),
      resolved_expense_id = null,
      reject_reason = left(nullif(trim(coalesce(p_reason, '')), ''), 100)
    where id = p_id;
  else
    update public.trip_expense_proposals
    set
      status = 'withdrawn',
      resolved_by = v_uid,
      resolved_at = now(),
      resolved_expense_id = null,
      reject_reason = null
    where id = p_id;
  end if;
end;
$$;

revoke all on function public.resolve_expense_proposal(uuid, text, uuid, text)
  from public, anon;
grant execute on function public.resolve_expense_proposal(uuid, text, uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- E) 결제자 변경 RPC (호스트만, 금액·분담 불변)
-- ---------------------------------------------------------------------------
create or replace function public.set_expense_payer(
  p_expense_id uuid,
  p_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_trip uuid;
  v_status text;
begin
  if v_uid is null then
    raise exception 'not-authenticated' using errcode = '28000';
  end if;

  select trip_id, status into v_trip, v_status
  from public.trip_expenses
  where id = p_expense_id
  for update;

  if not found then
    raise exception 'not-found';
  end if;

  if not public.is_trip_owner(v_trip) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_status = 'voided' then
    raise exception 'voided';
  end if;

  if not exists (
    select 1
    from public.trip_members m
    where m.id = p_member_id
      and m.trip_id = v_trip
  ) then
    raise exception 'bad-member';
  end if;

  update public.trip_expenses
  set
    paid_by = p_member_id,
    updated_at = now()
  where id = p_expense_id;
end;
$$;

revoke all on function public.set_expense_payer(uuid, uuid) from public, anon;
grant execute on function public.set_expense_payer(uuid, uuid) to authenticated;
