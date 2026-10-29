-- Follow-up fixes for agent_core (storage, RLS, race, sweep, notify dedupe)

-- Private upload bucket (service role only; no public policies)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'agent-uploads',
  'agent-uploads',
  false,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Tokens: clients may select/update(revoke) own rows; insert via service role only
drop policy if exists "agent_ingest_tokens_own" on public.agent_ingest_tokens;

create policy "agent_ingest_tokens_select_own"
  on public.agent_ingest_tokens for select
  using (user_id = auth.uid());

create policy "agent_ingest_tokens_update_own"
  on public.agent_ingest_tokens for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "agent_ingest_tokens_delete_own"
  on public.agent_ingest_tokens for delete
  using (user_id = auth.uid());

-- Notify dedupe per user (not global)
drop index if exists public.notifications_dedupe_uidx;
create unique index if not exists notifications_dedupe_user_uidx
  on public.notifications (user_id, (payload->>'dedupe_key'))
  where payload ? 'dedupe_key' and nullif(payload->>'dedupe_key', '') is not null;

-- Sweep: also cap stale processing retries
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
      and attempts < 3
      and locked_at is not null
      and locked_at < now() - interval '2 minutes'
    )
  order by created_at asc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;

revoke all on function public.agent_sweep_candidates(int) from public, anon, authenticated;
grant execute on function public.agent_sweep_candidates(int) to service_role;

-- Race-safe save: unique violation on (source_event_id, source_index) returns existing id
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
  v_paid uuid;
  v_share jsonb;
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

  v_paid := nullif(p_expense->>'paid_by', '')::uuid;
  if v_paid is null or not exists (
    select 1 from public.trip_members m
    where m.id = v_paid and m.trip_id = p_trip_id
  ) then
    raise exception 'bad-payer';
  end if;

  for v_share in select * from jsonb_array_elements(coalesce(p_shares, '[]'::jsonb))
  loop
    if not exists (
      select 1 from public.trip_members m
      where m.id = (v_share->>'member_id')::uuid and m.trip_id = p_trip_id
    ) then
      raise exception 'bad-share-member';
    end if;
  end loop;

  v_expense := (p_expense - 'id') || jsonb_build_object(
    'trip_id', p_trip_id,
    'created_by', p_actor::text
  );

  begin
    v_id := public.save_trip_expense(v_expense, p_shares);
  exception when unique_violation then
    if p_event_id is not null then
      select id into v_existing
      from public.trip_expenses
      where source_event_id = p_event_id and source_index = p_index
      limit 1;
      if v_existing is not null then
        return v_existing;
      end if;
    end if;
    raise;
  end;

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

revoke all on function public.agent_save_expense(uuid, uuid, jsonb, jsonb, text, uuid, int, jsonb) from public, anon, authenticated;
grant execute on function public.agent_save_expense(uuid, uuid, jsonb, jsonb, text, uuid, int, jsonb) to service_role;

-- Void: only auto expenses by actor, or trip owner; mark open settlements stale
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
  v_row public.trip_expenses%rowtype;
  v_owner uuid;
  v_open boolean := false;
begin
  select * into v_row from public.trip_expenses where id = p_expense_id;
  if not found then
    raise exception 'not-found';
  end if;
  if v_row.status = 'voided' then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  select user_id into v_owner from public.trips where id = v_row.trip_id;

  if not (
    v_owner = p_actor
    or (
      v_row.status = 'auto'
      and v_row.created_by = p_actor
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

  update public.trip_settlements
  set status = 'stale'
  where trip_id = v_row.trip_id and status = 'open';

  select exists (
    select 1 from public.trip_settlements s
    where s.trip_id = v_row.trip_id and s.status in ('open', 'stale')
  ) into v_open;

  return jsonb_build_object('ok', true, 'settlement_open', v_open);
end;
$$;

revoke all on function public.agent_void_expense(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.agent_void_expense(uuid, uuid, text) to service_role;
