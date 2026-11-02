-- K1: 외화 지출(F) + 해외 원화 청구 문자(K) 병합.
-- - 최종 KRW(krw_amount) = 청구액(billed_krw). krw_base(시장환율 환산)·fee_krw 는 그대로 둔다.
--   "시장환율 대비 차이"는 billed_krw 와 krw_base 만으로 계산한다 (fee_krw 를 음수로 쓰지 않는다).
-- - 쓰기는 agent_* security definer RPC 로만 (service_role 만 실행, p_actor 멤버십 직접 검증).
-- - 같은 호출을 두 번 해도 결과가 같다 (멱등). 병합 전 값은 fx_merge.before 에 보관해 되돌린다.
-- - 금액이 바뀌면 분담을 비례(equal 은 균등)로 다시 나누고 열린 정산을 stale 로 표시한다.
-- 새 마이그레이션 파일이며 기존 마이그레이션은 수정하지 않는다.

alter table public.trip_expenses
  add column if not exists billed_krw bigint,
  add column if not exists billed_source text,
  add column if not exists billed_event_id uuid references public.agent_events (id) on delete set null,
  add column if not exists fx_merge jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'trip_expenses_billed_krw_positive'
      and conrelid = 'public.trip_expenses'::regclass
  ) then
    alter table public.trip_expenses
      add constraint trip_expenses_billed_krw_positive
      check (billed_krw is null or billed_krw > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'trip_expenses_billed_source_check'
      and conrelid = 'public.trip_expenses'::regclass
  ) then
    alter table public.trip_expenses
      add constraint trip_expenses_billed_source_check
      check (billed_source is null or billed_source in ('sms', 'manual'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'trip_expenses_billed_pair_check'
      and conrelid = 'public.trip_expenses'::regclass
  ) then
    alter table public.trip_expenses
      add constraint trip_expenses_billed_pair_check
      check ((billed_krw is null) = (billed_source is null));
  end if;
end $$;

-- 내부 도우미: 분담을 새 총액에 맞춰 다시 나눈다 (직접 호출 금지).
-- equal 이면 균등(나머지는 마지막 멤버), 그 외에는 기존 분담 비례(나머지는 가장 큰 몫).
create or replace function public._fx_resplit_shares(
  p_expense_id uuid,
  p_new_total bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_split text;
  v_n int;
  v_old_total bigint;
  v_assigned bigint := 0;
  v_i int := 0;
  v_new bigint;
  v_top uuid;
  v_rec record;
begin
  select split_type into v_split from public.trip_expenses where id = p_expense_id;

  select count(*), coalesce(sum(share_krw), 0)::bigint
    into v_n, v_old_total
  from public.trip_expense_shares
  where expense_id = p_expense_id;

  if v_n = 0 then
    return;
  end if;

  if v_split = 'equal' or v_old_total <= 0 then
    for v_rec in
      select member_id from public.trip_expense_shares
      where expense_id = p_expense_id
      order by member_id
    loop
      v_i := v_i + 1;
      if v_i = v_n then
        v_new := p_new_total - v_assigned;
      else
        v_new := p_new_total / v_n;
        v_assigned := v_assigned + v_new;
      end if;
      update public.trip_expense_shares
      set share_krw = v_new
      where expense_id = p_expense_id and member_id = v_rec.member_id;
    end loop;
    return;
  end if;

  select member_id into v_top
  from public.trip_expense_shares
  where expense_id = p_expense_id
  order by share_krw desc, member_id
  limit 1;

  update public.trip_expense_shares
  set share_krw = floor(share_krw::numeric * p_new_total::numeric / v_old_total::numeric)::bigint
  where expense_id = p_expense_id;

  select coalesce(sum(share_krw), 0)::bigint into v_assigned
  from public.trip_expense_shares
  where expense_id = p_expense_id;

  if v_assigned <> p_new_total then
    update public.trip_expense_shares
    set share_krw = share_krw + (p_new_total - v_assigned)
    where expense_id = p_expense_id and member_id = v_top;
  end if;
end;
$$;

revoke all on function public._fx_resplit_shares(uuid, bigint) from public, anon, authenticated, service_role;

-- 청구액 적용.
--   p_foreign is null : p_expense_id 는 외화 지출(F). K(청구 문자)의 금액을 청구액으로 붙인다.
--   p_foreign 있음    : p_expense_id 는 해외 원화 지출(K). 외화 영수증(F) 정보를 얹어 외화 지출로 바꾼다.
--     p_foreign = { amount, currency, fx_rate, fx_rate_date, fx_is_fallback, krw_base,
--                   items?, merchant_ko?, billed_event_id? }
create or replace function public.agent_apply_billed_krw(
  p_actor uuid,
  p_expense_id uuid,
  p_billed_krw bigint,
  p_source text,
  p_event_id uuid default null,
  p_foreign jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.trip_expenses%rowtype;
  v_before jsonb;
  v_billed_event uuid;
  v_market_krw bigint;
  v_kind text;
  v_currency text;
  v_f_amount numeric;
  v_f_rate numeric;
  v_f_base bigint;
  v_has_items boolean;
  v_open boolean := false;
begin
  if p_actor is null then
    raise exception 'actor-required';
  end if;
  if p_source is null or p_source not in ('sms', 'manual') then
    raise exception 'bad-source';
  end if;
  if p_billed_krw is null or p_billed_krw <= 0 then
    raise exception 'bad-billed-krw';
  end if;

  select * into v_row from public.trip_expenses where id = p_expense_id for update;
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

  if v_row.status = 'voided' then
    raise exception 'voided';
  end if;

  if p_foreign is null then
    v_billed_event := p_event_id;
  else
    v_billed_event := nullif(p_foreign->>'billed_event_id', '')::uuid;
  end if;

  -- 멱등: 같은 이벤트(트리거/청구)가 같은 금액으로 다시 들어오면 변경 없이 성공
  if v_row.billed_krw is not null and v_row.billed_krw = p_billed_krw then
    if p_source = 'manual' and v_row.billed_source = 'manual' then
      return jsonb_build_object('ok', true, 'applied', false, 'already', true);
    end if;
    if p_event_id is not null and (
      v_row.fx_merge->>'trigger_event_id' = p_event_id::text
      or v_row.billed_event_id = p_event_id
    ) then
      return jsonb_build_object('ok', true, 'applied', false, 'already', true);
    end if;
  end if;

  -- 이미 다른 청구가 붙어 있으면 문자 경로는 덮어쓰지 않는다 (직접 입력만 고칠 수 있음)
  if v_row.billed_krw is not null and p_source = 'sms' then
    raise exception 'already-billed';
  end if;

  v_before := coalesce(
    v_row.fx_merge->'before',
    jsonb_build_object(
      'amount', v_row.amount,
      'currency', v_row.currency,
      'fx_rate', v_row.fx_rate,
      'fx_rate_to_krw', v_row.fx_rate_to_krw,
      'fx_rate_date', v_row.fx_rate_date,
      'fx_source', v_row.fx_source,
      'fx_is_fallback', v_row.fx_is_fallback,
      'krw_base', v_row.krw_base,
      'fee_krw', v_row.fee_krw,
      'krw_amount', v_row.krw_amount,
      'items', v_row.items,
      'merchant_ko', v_row.merchant_ko
    )
  );

  if p_foreign is null then
    -- F 에 청구액 붙이기
    if upper(coalesce(v_row.currency, '')) = 'KRW' then
      raise exception 'not-foreign';
    end if;
    v_kind := coalesce(v_row.fx_merge->>'kind', 'billed_on_foreign');
    v_market_krw := coalesce(v_row.krw_base, v_row.krw_amount);

    update public.trip_expenses
    set
      krw_base = coalesce(krw_base, v_row.krw_amount),
      krw_amount = p_billed_krw,
      billed_krw = p_billed_krw,
      billed_source = p_source,
      billed_event_id = case when p_source = 'sms' then v_billed_event else null end,
      fx_merge = jsonb_build_object(
        'version', 1,
        'kind', v_kind,
        'before', v_before,
        'market_krw', v_market_krw,
        'trigger_event_id', coalesce(p_event_id::text, v_row.fx_merge->>'trigger_event_id'),
        'merged_at', now()
      ),
      agent_reasons = coalesce(agent_reasons, '{}'::jsonb)
        || jsonb_build_object(
          'billed_merge',
          jsonb_build_object('source', p_source, 'event_id', p_event_id, 'at', now())
        ),
      updated_at = now()
    where id = p_expense_id;
  else
    -- K 를 외화 지출로 바꾸기
    if upper(coalesce(v_row.currency, '')) <> 'KRW' then
      raise exception 'not-billed-krw';
    end if;
    if p_billed_krw <> v_row.krw_amount then
      raise exception 'billed-mismatch';
    end if;

    v_currency := upper(coalesce(p_foreign->>'currency', ''));
    v_f_amount := nullif(p_foreign->>'amount', '')::numeric;
    v_f_rate := nullif(p_foreign->>'fx_rate', '')::numeric;
    v_f_base := nullif(p_foreign->>'krw_base', '')::bigint;
    if v_currency !~ '^[A-Z]{3}$' or v_currency = 'KRW'
       or v_f_amount is null or v_f_amount <= 0
       or v_f_rate is null or v_f_rate <= 0
       or v_f_base is null or v_f_base <= 0 then
      raise exception 'bad-foreign';
    end if;

    v_market_krw := v_f_base;
    v_has_items := v_row.items is not null
      and jsonb_typeof(v_row.items) = 'array'
      and jsonb_array_length(v_row.items) > 0;

    update public.trip_expenses
    set
      amount = v_f_amount,
      currency = v_currency,
      fx_rate = v_f_rate,
      fx_rate_to_krw = v_f_rate,
      fx_rate_date = nullif(p_foreign->>'fx_rate_date', '')::date,
      fx_source = 'auto_daily',
      fx_is_fallback = coalesce((p_foreign->>'fx_is_fallback')::boolean, false),
      krw_base = v_f_base,
      fee_krw = 0,
      krw_amount = p_billed_krw,
      items = case
        when v_has_items then items
        when p_foreign->'items' is not null and jsonb_typeof(p_foreign->'items') = 'array'
          then p_foreign->'items'
        else coalesce(items, '[]'::jsonb)
      end,
      merchant_ko = coalesce(nullif(merchant_ko, ''), nullif(p_foreign->>'merchant_ko', '')),
      billed_krw = p_billed_krw,
      billed_source = p_source,
      billed_event_id = v_billed_event,
      fx_merge = jsonb_build_object(
        'version', 1,
        'kind', 'foreign_on_billed',
        'before', v_before,
        'market_krw', v_market_krw,
        'trigger_event_id', p_event_id,
        'merged_at', now()
      ),
      agent_reasons = coalesce(agent_reasons, '{}'::jsonb)
        || jsonb_build_object(
          'billed_merge',
          jsonb_build_object('source', p_source, 'event_id', p_event_id, 'at', now())
        ),
      updated_at = now()
    where id = p_expense_id;
  end if;

  if p_billed_krw <> v_row.krw_amount then
    perform public._fx_resplit_shares(p_expense_id, p_billed_krw);
  end if;

  update public.trip_settlements
  set status = 'stale'
  where trip_id = v_row.trip_id and status = 'open';

  select exists (
    select 1 from public.trip_settlements s
    where s.trip_id = v_row.trip_id and s.status in ('open', 'stale')
  ) into v_open;

  return jsonb_build_object(
    'ok', true,
    'applied', true,
    'krw_amount', p_billed_krw,
    'market_krw', v_market_krw,
    'settlement_open', v_open
  );
end;
$$;

revoke all on function public.agent_apply_billed_krw(uuid, uuid, bigint, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.agent_apply_billed_krw(uuid, uuid, bigint, text, uuid, jsonb) to service_role;

-- 병합 되돌리기: fx_merge.before 스냅샷으로 복원. 이미 합쳐지지 않았으면 변경 없이 성공 (멱등).
create or replace function public.agent_unmerge_billed_krw(
  p_actor uuid,
  p_expense_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.trip_expenses%rowtype;
  v_before jsonb;
  v_restored_krw bigint;
  v_unmerged jsonb;
  v_open boolean := false;
begin
  if p_actor is null then
    raise exception 'actor-required';
  end if;

  select * into v_row from public.trip_expenses where id = p_expense_id for update;
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

  if v_row.status = 'voided' then
    raise exception 'voided';
  end if;

  if v_row.billed_krw is null and v_row.fx_merge is null then
    return jsonb_build_object('ok', true, 'unmerged', false, 'already', true);
  end if;

  v_before := v_row.fx_merge->'before';
  if v_before is null or jsonb_typeof(v_before) <> 'object' then
    raise exception 'no-snapshot';
  end if;

  v_restored_krw := (v_before->>'krw_amount')::bigint;
  if v_restored_krw is null or v_restored_krw <= 0 then
    raise exception 'no-snapshot';
  end if;

  -- 같은 이벤트가 다시 처리돼도 자동으로 재병합하지 않도록 기록한다.
  v_unmerged := coalesce(v_row.agent_reasons->'fx_unmerged', '[]'::jsonb);
  if jsonb_typeof(v_unmerged) <> 'array' then
    v_unmerged := '[]'::jsonb;
  end if;
  if nullif(v_row.fx_merge->>'trigger_event_id', '') is not null then
    v_unmerged := v_unmerged || to_jsonb(v_row.fx_merge->>'trigger_event_id');
  end if;
  if v_row.billed_event_id is not null then
    v_unmerged := v_unmerged || to_jsonb(v_row.billed_event_id::text);
  end if;

  update public.trip_expenses
  set
    amount = (v_before->>'amount')::numeric,
    currency = v_before->>'currency',
    fx_rate = (v_before->>'fx_rate')::numeric,
    fx_rate_to_krw = (v_before->>'fx_rate_to_krw')::numeric,
    fx_rate_date = nullif(v_before->>'fx_rate_date', '')::date,
    fx_source = coalesce(v_before->>'fx_source', 'auto_daily'),
    fx_is_fallback = coalesce((v_before->>'fx_is_fallback')::boolean, false),
    krw_base = (v_before->>'krw_base')::bigint,
    fee_krw = coalesce((v_before->>'fee_krw')::bigint, 0),
    krw_amount = v_restored_krw,
    items = case
      when v_before->'items' is not null and jsonb_typeof(v_before->'items') = 'array'
        then v_before->'items'
      else items
    end,
    merchant_ko = v_before->>'merchant_ko',
    billed_krw = null,
    billed_source = null,
    billed_event_id = null,
    fx_merge = null,
    agent_reasons = coalesce(agent_reasons, '{}'::jsonb)
      || jsonb_build_object(
        'fx_unmerged', v_unmerged,
        'billed_unmerge',
        jsonb_build_object('reason', coalesce(p_reason, ''), 'by', p_actor, 'at', now())
      ),
    updated_at = now()
  where id = p_expense_id;

  if v_restored_krw <> v_row.krw_amount then
    perform public._fx_resplit_shares(p_expense_id, v_restored_krw);
  end if;

  update public.trip_settlements
  set status = 'stale'
  where trip_id = v_row.trip_id and status = 'open';

  select exists (
    select 1 from public.trip_settlements s
    where s.trip_id = v_row.trip_id and s.status in ('open', 'stale')
  ) into v_open;

  return jsonb_build_object(
    'ok', true,
    'unmerged', true,
    'krw_amount', v_restored_krw,
    'settlement_open', v_open
  );
end;
$$;

revoke all on function public.agent_unmerge_billed_krw(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.agent_unmerge_billed_krw(uuid, uuid, text) to service_role;
