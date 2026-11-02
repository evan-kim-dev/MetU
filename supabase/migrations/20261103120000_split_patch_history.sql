-- K7: 자연어 분담 수정 — 적용 이력(되돌리기용) + 적용/되돌리기 에이전트 RPC.
-- Additive only. 기존 마이그레이션은 수정하지 않는다.
--
-- - LLM 은 금액을 만들지 않는다. 서버가 순수 함수로 계산한 분담액만 들어온다.
--   RPC 는 그래도 한 번 더 검증한다 (멤버 소속, 정수·0 이상, 합 = krw_amount).
-- - 사용자가 입력한 원문(자연어)은 저장하지 않는다. 이력에는 patch 종류와 전/후 분담만 남는다.
-- - service_role 만 실행. p_actor 의 여행 멤버십을 직접 검증한다 (security definer).
-- - 적용: 같은 (expense_id, idempotency_key) 를 두 번 보내면 한 번만 적용된다.
--   p_expected_before 가 현재 분담과 다르면 {ok:false, reason:'conflict'} (아무것도 바꾸지 않음).
-- - 되돌리기: 이미 되돌렸으면 변경 없이 성공(already). 적용 이후 분담이 또 바뀌었으면 conflict.
-- - 분담이 바뀌므로 열려 있는 정산은 stale 로 표시한다 (agent_void_expense 와 같은 방식).

-- ---------------------------------------------------------------------------
-- 1) 이력 테이블
-- ---------------------------------------------------------------------------
create table if not exists public.trip_expense_split_history (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  expense_id uuid not null references public.trip_expenses(id) on delete cascade,
  actor uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null
    check (length(idempotency_key) between 1 and 100),
  patch_kind text not null
    check (patch_kind in ('exclude', 'only', 'weights', 'itemExclusions')),
  before_split_type text not null,
  before_shares jsonb not null,
  before_inputs jsonb not null default '{}'::jsonb,
  after_split_type text not null,
  after_shares jsonb not null,
  after_inputs jsonb not null default '{}'::jsonb,
  applied_at timestamptz not null default now(),
  undone_at timestamptz,
  undone_by uuid references auth.users(id) on delete set null
);

create unique index if not exists trip_expense_split_history_idem_uidx
  on public.trip_expense_split_history (expense_id, idempotency_key);

create index if not exists trip_expense_split_history_expense_idx
  on public.trip_expense_split_history (expense_id, applied_at desc);

alter table public.trip_expense_split_history enable row level security;

-- 읽기는 여행 멤버만. 쓰기 정책은 두지 않는다 (RPC 로만 기록).
drop policy if exists "trip_expense_split_history_select"
  on public.trip_expense_split_history;
create policy "trip_expense_split_history_select"
  on public.trip_expense_split_history for select
  to authenticated
  using (public.is_trip_member(trip_id));

revoke all on table public.trip_expense_split_history from anon, authenticated;
grant select on table public.trip_expense_split_history to authenticated;

-- ---------------------------------------------------------------------------
-- 2) 적용 RPC
-- ---------------------------------------------------------------------------
create or replace function public.agent_apply_split_patch(
  p_actor uuid,
  p_expense_id uuid,
  p_expected_before jsonb,
  p_split_type text,
  p_shares jsonb,
  p_input_values jsonb,
  p_patch_kind text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.trip_expenses%rowtype;
  v_hist public.trip_expense_split_history%rowtype;
  v_current jsonb;
  v_before_inputs jsonb;
  v_inputs jsonb := coalesce(p_input_values, '{}'::jsonb);
  v_sum bigint := 0;
  v_entry record;
  v_id uuid;
begin
  if p_actor is null then
    raise exception 'actor-required';
  end if;
  if p_idempotency_key is null
     or length(p_idempotency_key) not between 1 and 100 then
    raise exception 'idempotency-key-required';
  end if;
  if p_split_type is null or p_split_type not in ('equal', 'ratio', 'fixed') then
    raise exception 'bad-split-type';
  end if;
  if p_patch_kind is null
     or p_patch_kind not in ('exclude', 'only', 'weights', 'itemExclusions') then
    raise exception 'bad-patch-kind';
  end if;
  if p_shares is null or jsonb_typeof(p_shares) <> 'object'
     or p_shares = '{}'::jsonb then
    raise exception 'bad-shares';
  end if;
  if p_expected_before is null or jsonb_typeof(p_expected_before) <> 'object' then
    raise exception 'bad-expected-before';
  end if;
  if jsonb_typeof(v_inputs) <> 'object' then
    raise exception 'bad-input-values';
  end if;

  -- 같은 지출에 대한 적용/되돌리기를 직렬화한다.
  select * into v_row from public.trip_expenses
  where id = p_expense_id
  for update;
  if not found then
    raise exception 'not-found';
  end if;

  if not (
    exists (
      select 1 from public.trips t
      where t.id = v_row.trip_id and t.user_id = p_actor
    )
    or exists (
      select 1 from public.trip_members m
      where m.trip_id = v_row.trip_id and m.user_id = p_actor
    )
  ) then
    raise exception 'forbidden';
  end if;

  -- 멱등: 이미 적용한 키면 그대로 성공
  select * into v_hist from public.trip_expense_split_history
  where expense_id = p_expense_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'ok', true, 'already', true, 'historyId', v_hist.id
    );
  end if;

  if v_row.status = 'voided' then
    raise exception 'voided';
  end if;

  select coalesce(jsonb_object_agg(s.member_id::text, s.share_krw), '{}'::jsonb)
    into v_current
  from public.trip_expense_shares s
  where s.expense_id = p_expense_id;

  if v_current <> p_expected_before then
    return jsonb_build_object('ok', false, 'reason', 'conflict');
  end if;

  -- 서버가 계산한 값이라도 DB 에서 한 번 더 확인한다.
  for v_entry in select key, value from jsonb_each_text(p_shares)
  loop
    if v_entry.value !~ '^[0-9]{1,15}$' then
      raise exception 'bad-shares';
    end if;
    if not exists (
      select 1 from public.trip_members m
      where m.id = v_entry.key::uuid and m.trip_id = v_row.trip_id
    ) then
      raise exception 'unknown-member';
    end if;
    v_sum := v_sum + v_entry.value::bigint;
  end loop;
  if v_sum <> v_row.krw_amount then
    raise exception 'shares-sum-mismatch';
  end if;

  select coalesce(jsonb_object_agg(s.member_id::text, s.input_value), '{}'::jsonb)
    into v_before_inputs
  from public.trip_expense_shares s
  where s.expense_id = p_expense_id;

  delete from public.trip_expense_shares where expense_id = p_expense_id;

  insert into public.trip_expense_shares (
    expense_id, member_id, trip_id, input_value, share_krw
  )
  select
    p_expense_id,
    e.key::uuid,
    v_row.trip_id,
    nullif(v_inputs->>e.key, '')::numeric,
    e.value::bigint
  from jsonb_each_text(p_shares) as e(key, value);

  update public.trip_expenses
  set split_type = p_split_type,
      updated_at = now()
  where id = p_expense_id;

  update public.trip_settlements
  set status = 'stale'
  where trip_id = v_row.trip_id and status = 'open';

  insert into public.trip_expense_split_history (
    trip_id, expense_id, actor, idempotency_key, patch_kind,
    before_split_type, before_shares, before_inputs,
    after_split_type, after_shares, after_inputs
  ) values (
    v_row.trip_id, p_expense_id, p_actor, p_idempotency_key, p_patch_kind,
    v_row.split_type, v_current, v_before_inputs,
    p_split_type, p_shares, v_inputs
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'already', false, 'historyId', v_id);
end;
$$;

revoke all on function public.agent_apply_split_patch(uuid, uuid, jsonb, text, jsonb, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.agent_apply_split_patch(uuid, uuid, jsonb, text, jsonb, jsonb, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 3) 되돌리기 RPC
-- ---------------------------------------------------------------------------
create or replace function public.agent_undo_split_patch(
  p_actor uuid,
  p_history_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hist public.trip_expense_split_history%rowtype;
  v_row public.trip_expenses%rowtype;
  v_current jsonb;
  v_sum bigint;
begin
  if p_actor is null then
    raise exception 'actor-required';
  end if;

  select * into v_hist from public.trip_expense_split_history
  where id = p_history_id;
  if not found then
    raise exception 'not-found';
  end if;

  -- 적용 RPC 와 같은 순서(지출 → 이력)로 잠가 교착을 피한다.
  select * into v_row from public.trip_expenses
  where id = v_hist.expense_id
  for update;
  if not found then
    raise exception 'not-found';
  end if;

  if not (
    exists (
      select 1 from public.trips t
      where t.id = v_hist.trip_id and t.user_id = p_actor
    )
    or exists (
      select 1 from public.trip_members m
      where m.trip_id = v_hist.trip_id and m.user_id = p_actor
    )
  ) then
    raise exception 'forbidden';
  end if;

  select * into v_hist from public.trip_expense_split_history
  where id = p_history_id
  for update;

  if v_hist.undone_at is not null then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  if v_row.status = 'voided' then
    raise exception 'voided';
  end if;

  select coalesce(jsonb_object_agg(s.member_id::text, s.share_krw), '{}'::jsonb)
    into v_current
  from public.trip_expense_shares s
  where s.expense_id = v_hist.expense_id;

  -- 적용 뒤에 분담이 또 바뀌었으면 덮어쓰지 않는다.
  if v_current <> v_hist.after_shares then
    return jsonb_build_object('ok', false, 'reason', 'conflict');
  end if;

  -- 이전 분담의 멤버가 그 사이 삭제됐다면 합이 안 맞으므로 되돌리지 않는다.
  select coalesce(sum(b.value::bigint), 0) into v_sum
  from jsonb_each_text(v_hist.before_shares) as b(key, value)
  where exists (
    select 1 from public.trip_members m
    where m.id = b.key::uuid and m.trip_id = v_hist.trip_id
  );
  if v_sum <> v_row.krw_amount then
    return jsonb_build_object('ok', false, 'reason', 'conflict');
  end if;

  delete from public.trip_expense_shares where expense_id = v_hist.expense_id;

  insert into public.trip_expense_shares (
    expense_id, member_id, trip_id, input_value, share_krw
  )
  select
    v_hist.expense_id,
    b.key::uuid,
    v_hist.trip_id,
    nullif(v_hist.before_inputs->>b.key, '')::numeric,
    b.value::bigint
  from jsonb_each_text(v_hist.before_shares) as b(key, value)
  where exists (
    select 1 from public.trip_members m
    where m.id = b.key::uuid and m.trip_id = v_hist.trip_id
  );

  update public.trip_expenses
  set split_type = v_hist.before_split_type,
      updated_at = now()
  where id = v_hist.expense_id;

  update public.trip_settlements
  set status = 'stale'
  where trip_id = v_hist.trip_id and status = 'open';

  update public.trip_expense_split_history
  set undone_at = now(), undone_by = p_actor
  where id = p_history_id;

  return jsonb_build_object('ok', true, 'already', false);
end;
$$;

revoke all on function public.agent_undo_split_patch(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.agent_undo_split_patch(uuid, uuid)
  to service_role;
