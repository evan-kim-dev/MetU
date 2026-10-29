-- P6: agent schema (events, steps, ingest tokens, expense status, settle safety)
-- Additive only. Existing L-1A tables assumed.

-- ---------------------------------------------------------------------------
-- A. Expand existing tables
-- ---------------------------------------------------------------------------
alter table public.trip_expenses
  add column if not exists status text,
  add column if not exists source_event_id uuid,
  add column if not exists source_index int,
  add column if not exists agent_reasons jsonb,
  add column if not exists reviewed_at timestamptz,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id);

update public.trip_expenses set status = 'confirmed' where status is null;
alter table public.trip_expenses alter column status set default 'confirmed';
alter table public.trip_expenses alter column status set not null;

do $$ begin
  alter table public.trip_expenses
    add constraint trip_expenses_status_chk
    check (status in ('confirmed', 'auto', 'voided'));
exception when duplicate_object then null;
end $$;

create unique index if not exists trip_expenses_source_event_uidx
  on public.trip_expenses (source_event_id, source_index)
  where source_event_id is not null;

alter table public.trip_members
  add column if not exists auto_include boolean not null default true;

alter table public.trips
  add column if not exists auto_settle boolean not null default true;

alter table public.trip_settlements
  add column if not exists origin text;

update public.trip_settlements set origin = 'manual' where origin is null;
alter table public.trip_settlements alter column origin set default 'manual';
alter table public.trip_settlements alter column origin set not null;

do $$ begin
  alter table public.trip_settlements
    add constraint trip_settlements_origin_chk
    check (origin in ('manual', 'auto'));
exception when duplicate_object then null;
end $$;

-- widen status to include stale
alter table public.trip_settlements drop constraint if exists trip_settlements_status_check;
do $$ begin
  alter table public.trip_settlements
    add constraint trip_settlements_status_check
    check (status in ('open', 'completed', 'superseded', 'stale'));
exception when duplicate_object then null;
end $$;

-- notifications types
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'party_join_request',
      'party_join_accepted',
      'party_join_rejected',
      'friend_request',
      'friend_accepted',
      'friend_rejected',
      'dm_message',
      'expense_added',
      'expense_review',
      'expense_voided',
      'settlement_ready',
      'settlement_stale',
      'transfer_marked_paid',
      'transfer_reminder',
      'agent_digest'
    )
  );

-- ---------------------------------------------------------------------------
-- B. New tables
-- ---------------------------------------------------------------------------
create table if not exists public.agent_ingest_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  label text not null default '',
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create table if not exists public.agent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  source text not null
    check (source in (
      'sms_shortcut','sms_android','share','paste','upload','manual','sim','domain','cron'
    )),
  kind text not null
    check (kind in ('sms','text','image','domain')),
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  status text not null default 'received'
    check (status in (
      'received','processing','done','needs_review','ignored','failed'
    )),
  attempts int not null default 0,
  locked_at timestamptz,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (user_id, idempotency_key)
);

create index if not exists agent_events_sweep_idx
  on public.agent_events (status, created_at);

create table if not exists public.agent_steps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.agent_events(id) on delete cascade,
  seq int not null,
  tool text not null,
  input jsonb,
  output jsonb,
  ms int,
  ok boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);

create table if not exists public.ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  model text not null,
  purpose text not null,
  input_tokens int,
  output_tokens int,
  ms int,
  ok boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists notifications_dedupe_uidx
  on public.notifications ((payload->>'dedupe_key'))
  where payload ? 'dedupe_key' and nullif(payload->>'dedupe_key', '') is not null;

-- RLS
alter table public.agent_ingest_tokens enable row level security;
alter table public.agent_events enable row level security;
alter table public.agent_steps enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.ai_usage_log enable row level security;

drop policy if exists "agent_ingest_tokens_own" on public.agent_ingest_tokens;
create policy "agent_ingest_tokens_own"
  on public.agent_ingest_tokens for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "agent_events_owner_select" on public.agent_events;
create policy "agent_events_owner_select"
  on public.agent_events for select
  using (user_id = auth.uid());

drop policy if exists "agent_steps_owner_select" on public.agent_steps;
create policy "agent_steps_owner_select"
  on public.agent_steps for select
  using (
    exists (
      select 1 from public.agent_events e
      where e.id = event_id and e.user_id = auth.uid()
    )
  );

drop policy if exists "push_subscriptions_own" on public.push_subscriptions;
create policy "push_subscriptions_own"
  on public.push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "ai_usage_log_own_select" on public.ai_usage_log;
create policy "ai_usage_log_own_select"
  on public.ai_usage_log for select
  using (user_id = auth.uid());

-- Realtime
do $$ begin
  alter publication supabase_realtime add table public.agent_events;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.agent_steps;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.trip_expenses;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- C. RPCs (service_role only)
-- ---------------------------------------------------------------------------
create or replace function public.agent_claim_event(
  p_event_id uuid,
  p_stale_seconds int default 120
)
returns public.agent_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.agent_events%rowtype;
begin
  update public.agent_events
  set
    status = 'processing',
    locked_at = now(),
    attempts = attempts + 1
  where id = p_event_id
    and (
      status in ('received', 'failed')
      or (
        status = 'processing'
        and locked_at is not null
        and locked_at < now() - make_interval(secs => greatest(30, p_stale_seconds))
      )
    )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.agent_save_expense(
  p_actor uuid,
  p_trip_id uuid,
  p_expense jsonb,
  p_shares jsonb,
  p_status text,
  p_event_id uuid,
  p_index int,
  p_reasons jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_existing uuid;
  v_expense jsonb;
begin
  if p_actor is null then
    raise exception 'actor-required';
  end if;
  if not (
    exists (select 1 from public.trips t where t.id = p_trip_id and t.user_id = p_actor)
    or exists (
      select 1 from public.trip_members m
      where m.trip_id = p_trip_id and m.user_id = p_actor
    )
  ) then
    raise exception 'forbidden';
  end if;

  if p_status not in ('confirmed', 'auto') then
    raise exception 'bad-status';
  end if;

  if p_event_id is not null then
    select id into v_existing
    from public.trip_expenses
    where source_event_id = p_event_id and source_index = p_index
    limit 1;
    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  v_expense := p_expense || jsonb_build_object(
    'trip_id', p_trip_id,
    'created_by', p_actor::text,
    'status', p_status
  );

  -- reuse save_trip_expense (security invoker would fail; inline minimal insert)
  v_id := public.save_trip_expense(v_expense, p_shares);

  update public.trip_expenses
  set
    status = p_status,
    source_event_id = p_event_id,
    source_index = p_index,
    agent_reasons = p_reasons,
    updated_at = now()
  where id = v_id;

  return v_id;
end;
$$;

create or replace function public.agent_void_expense(
  p_actor uuid,
  p_expense_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip uuid;
  v_open boolean := false;
begin
  select trip_id into v_trip from public.trip_expenses where id = p_expense_id;
  if v_trip is null then
    raise exception 'not-found';
  end if;
  if not (
    exists (select 1 from public.trips t where t.id = v_trip and t.user_id = p_actor)
    or exists (
      select 1 from public.trip_members m
      where m.trip_id = v_trip and m.user_id = p_actor
    )
  ) then
    raise exception 'forbidden';
  end if;

  update public.trip_expenses
  set
    status = 'voided',
    voided_at = now(),
    voided_by = p_actor,
    agent_reasons = coalesce(agent_reasons, '{}'::jsonb)
      || jsonb_build_object('void_reason', coalesce(p_reason, '')),
    updated_at = now()
  where id = p_expense_id;

  select exists (
    select 1 from public.trip_settlements s
    where s.trip_id = v_trip and s.status in ('open', 'stale')
  ) into v_open;

  return jsonb_build_object('ok', true, 'settlement_open', v_open);
end;
$$;

create or replace function public.agent_notify(
  p_user_id uuid,
  p_type text,
  p_trip_id uuid,
  p_actor uuid,
  p_payload jsonb,
  p_dedupe_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_payload jsonb;
begin
  -- notifications has no trip_id column; keep trip in payload
  v_payload := coalesce(p_payload, '{}'::jsonb);
  if p_trip_id is not null then
    v_payload := v_payload || jsonb_build_object('trip_id', p_trip_id::text);
  end if;
  if p_dedupe_key is not null and length(p_dedupe_key) > 0 then
    v_payload := v_payload || jsonb_build_object('dedupe_key', p_dedupe_key);
    if exists (
      select 1 from public.notifications n
      where n.payload->>'dedupe_key' = p_dedupe_key
    ) then
      return null;
    end if;
  end if;

  insert into public.notifications (user_id, type, actor_id, payload)
  values (
    p_user_id,
    p_type,
    p_actor,
    v_payload
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- p_mode = origin ('manual'|'auto'); basis_hash + transfers required (TS computes them)
create or replace function public.agent_create_settlement(
  p_actor uuid,
  p_trip_id uuid,
  p_mode text,
  p_basis_hash text,
  p_transfers jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ver int;
  v_id uuid;
  v_token text;
  v_t jsonb;
  v_count int := 0;
  v_origin text;
  v_existing uuid;
  v_has_paid boolean := false;
begin
  if p_actor is null then
    raise exception 'actor-required';
  end if;
  if not exists (
    select 1 from public.trips t where t.id = p_trip_id and t.user_id = p_actor
  ) then
    raise exception 'forbidden';
  end if;

  v_origin := case when p_mode = 'auto' then 'auto' else 'manual' end;

  select id into v_existing
  from public.trip_settlements
  where trip_id = p_trip_id
    and basis_hash = p_basis_hash
    and status in ('open', 'stale')
  order by version desc
  limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  select exists (
    select 1
    from public.trip_settlements s
    join public.trip_settlement_transfers t on t.settlement_id = s.id
    where s.trip_id = p_trip_id
      and s.status in ('open', 'stale')
      and t.status = 'paid'
  ) into v_has_paid;

  if v_has_paid then
    raise exception 'has_paid';
  end if;

  update public.trip_settlements
  set status = 'superseded'
  where trip_id = p_trip_id and status in ('open', 'stale');

  select coalesce(max(version), 0) + 1 into v_ver
  from public.trip_settlements where trip_id = p_trip_id;

  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

  insert into public.trip_settlements (
    trip_id, version, status, basis_hash, share_token, created_by, origin
  ) values (
    p_trip_id, v_ver, 'open', p_basis_hash, v_token, p_actor, v_origin
  ) returning id into v_id;

  for v_t in select * from jsonb_array_elements(coalesce(p_transfers, '[]'::jsonb))
  loop
    insert into public.trip_settlement_transfers (
      settlement_id, trip_id, from_member, to_member, krw
    ) values (
      v_id,
      p_trip_id,
      (v_t->>'from')::uuid,
      (v_t->>'to')::uuid,
      (v_t->>'krw')::bigint
    );
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    update public.trip_settlements
    set status = 'completed', completed_at = now()
    where id = v_id;
  end if;

  return v_id;
end;
$$;

create or replace function public.agent_sweep_candidates(p_limit int default 10)
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select id
  from public.agent_events
  where
    status = 'received'
    or (
      status = 'failed'
      and attempts < 3
      and created_at < now() - interval '2 minutes'
    )
    or (
      status = 'processing'
      and locked_at is not null
      and locked_at < now() - interval '2 minutes'
    )
  order by created_at asc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;

revoke all on function public.agent_claim_event(uuid, int) from public, anon, authenticated;
revoke all on function public.agent_save_expense(uuid, uuid, jsonb, jsonb, text, uuid, int, jsonb) from public, anon, authenticated;
revoke all on function public.agent_void_expense(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.agent_notify(uuid, text, uuid, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.agent_create_settlement(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.agent_sweep_candidates(int) from public, anon, authenticated;

grant execute on function public.agent_claim_event(uuid, int) to service_role;
grant execute on function public.agent_save_expense(uuid, uuid, jsonb, jsonb, text, uuid, int, jsonb) to service_role;
grant execute on function public.agent_void_expense(uuid, uuid, text) to service_role;
grant execute on function public.agent_notify(uuid, text, uuid, uuid, jsonb, text) to service_role;
grant execute on function public.agent_create_settlement(uuid, uuid, text, text, jsonb) to service_role;
grant execute on function public.agent_sweep_candidates(int) to service_role;

-- Optional: pg_cron cleanup comment
-- select cron.schedule('agent_events_payload_gc', '0 4 * * *', $$
--   update public.agent_events set payload = '{}'::jsonb
--   where created_at < now() - interval '7 days' and payload <> '{}'::jsonb;
-- $$);
