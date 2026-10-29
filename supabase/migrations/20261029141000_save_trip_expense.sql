-- L-1B: atomic expense + shares save (security invoker → RLS applies)
-- plus settlement write RPCs deferred from L-1A

create or replace function public.save_trip_expense(
  p_expense jsonb,
  p_shares jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_trip uuid;
  v_krw bigint;
  v_base bigint;
  v_fee bigint;
  v_sum bigint;
  v_share jsonb;
begin
  v_trip := (p_expense->>'trip_id')::uuid;
  if v_trip is null then
    raise exception 'trip_id-required';
  end if;

  v_krw := (p_expense->>'krw_amount')::bigint;
  v_base := coalesce((p_expense->>'krw_base')::bigint, v_krw);
  v_fee := coalesce((p_expense->>'fee_krw')::bigint, 0);

  if v_krw <> v_base + v_fee then
    raise exception 'krw-breakdown-mismatch';
  end if;

  if p_expense ? 'id' and nullif(p_expense->>'id', '') is not null then
    v_id := (p_expense->>'id')::uuid;
    update public.trip_expenses set
      paid_by = (p_expense->>'paid_by')::uuid,
      label = coalesce(p_expense->>'label', p_expense->>'merchant', ''),
      merchant = coalesce(p_expense->>'merchant', p_expense->>'label', ''),
      merchant_ko = p_expense->>'merchant_ko',
      category = coalesce(p_expense->>'category', '기타'),
      amount = (p_expense->>'amount')::numeric,
      currency = p_expense->>'currency',
      payment_method = coalesce(p_expense->>'payment_method', 'card'),
      card_profile_id = nullif(p_expense->>'card_profile_id', '')::uuid,
      card_label = p_expense->>'card_label',
      fx_rate_to_krw = coalesce((p_expense->>'fx_rate')::numeric, (p_expense->>'fx_rate_to_krw')::numeric, 1),
      fx_rate = coalesce((p_expense->>'fx_rate')::numeric, (p_expense->>'fx_rate_to_krw')::numeric, 1),
      fx_rate_date = nullif(p_expense->>'fx_rate_date', '')::date,
      fx_source = coalesce(p_expense->>'fx_source', 'auto_daily'),
      fx_is_fallback = coalesce((p_expense->>'fx_is_fallback')::boolean, false),
      fee_rate = coalesce((p_expense->>'fee_rate')::numeric, 0),
      fee_flat_krw = coalesce((p_expense->>'fee_flat_krw')::int, 0),
      krw_base = v_base,
      fee_krw = v_fee,
      krw_amount = v_krw,
      source = coalesce(p_expense->>'source', 'manual'),
      raw_input = p_expense->'raw_input',
      items = coalesce(p_expense->'items', '[]'::jsonb),
      place_id = nullif(p_expense->>'place_id', '')::uuid,
      spent_on = coalesce(nullif(p_expense->>'spent_on', '')::date, (now() at time zone 'Asia/Seoul')::date),
      paid_at = nullif(p_expense->>'paid_at', '')::timestamptz,
      day_index = nullif(p_expense->>'day_index', '')::int,
      split_type = coalesce(p_expense->>'split_type', 'equal'),
      dedupe_hash = p_expense->>'dedupe_hash',
      note = p_expense->>'note',
      updated_at = now()
    where id = v_id and trip_id = v_trip;

    if not found then
      raise exception 'expense-not-found';
    end if;

    delete from public.trip_expense_shares where expense_id = v_id;
  else
    insert into public.trip_expenses (
      trip_id, created_by, paid_by, label, merchant, merchant_ko, category,
      amount, currency, payment_method, card_profile_id, card_label,
      fx_rate_to_krw, fx_rate, fx_rate_date, fx_source, fx_is_fallback,
      fee_rate, fee_flat_krw, krw_base, fee_krw, krw_amount,
      source, raw_input, items, place_id, spent_on, paid_at, day_index,
      split_type, dedupe_hash, note
    ) values (
      v_trip,
      coalesce(nullif(p_expense->>'created_by', '')::uuid, auth.uid()),
      (p_expense->>'paid_by')::uuid,
      coalesce(p_expense->>'label', p_expense->>'merchant', ''),
      coalesce(p_expense->>'merchant', p_expense->>'label', ''),
      p_expense->>'merchant_ko',
      coalesce(p_expense->>'category', '기타'),
      (p_expense->>'amount')::numeric,
      p_expense->>'currency',
      coalesce(p_expense->>'payment_method', 'card'),
      nullif(p_expense->>'card_profile_id', '')::uuid,
      p_expense->>'card_label',
      coalesce((p_expense->>'fx_rate')::numeric, (p_expense->>'fx_rate_to_krw')::numeric, 1),
      coalesce((p_expense->>'fx_rate')::numeric, (p_expense->>'fx_rate_to_krw')::numeric, 1),
      nullif(p_expense->>'fx_rate_date', '')::date,
      coalesce(p_expense->>'fx_source', 'auto_daily'),
      coalesce((p_expense->>'fx_is_fallback')::boolean, false),
      coalesce((p_expense->>'fee_rate')::numeric, 0),
      coalesce((p_expense->>'fee_flat_krw')::int, 0),
      v_base,
      v_fee,
      v_krw,
      coalesce(p_expense->>'source', 'manual'),
      p_expense->'raw_input',
      coalesce(p_expense->'items', '[]'::jsonb),
      nullif(p_expense->>'place_id', '')::uuid,
      coalesce(nullif(p_expense->>'spent_on', '')::date, (now() at time zone 'Asia/Seoul')::date),
      nullif(p_expense->>'paid_at', '')::timestamptz,
      nullif(p_expense->>'day_index', '')::int,
      coalesce(p_expense->>'split_type', 'equal'),
      p_expense->>'dedupe_hash',
      p_expense->>'note'
    )
    returning id into v_id;
  end if;

  v_sum := 0;
  for v_share in select * from jsonb_array_elements(coalesce(p_shares, '[]'::jsonb))
  loop
    insert into public.trip_expense_shares (
      expense_id, member_id, trip_id, input_value, share_krw
    ) values (
      v_id,
      (v_share->>'member_id')::uuid,
      v_trip,
      nullif(v_share->>'input_value', '')::numeric,
      (v_share->>'share_krw')::bigint
    );
    v_sum := v_sum + (v_share->>'share_krw')::bigint;
  end loop;

  if v_sum <> v_krw then
    raise exception 'shares-sum-mismatch';
  end if;

  return v_id;
end;
$$;

revoke all on function public.save_trip_expense(jsonb, jsonb) from public;
grant execute on function public.save_trip_expense(jsonb, jsonb) to authenticated;

-- Settlement write RPCs (L-1A remaining)
create or replace function public.create_settlement(
  p_trip_id uuid,
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
begin
  if not public.is_trip_owner(p_trip_id) then
    raise exception 'forbidden';
  end if;

  update public.trip_settlements
  set status = 'superseded'
  where trip_id = p_trip_id and status = 'open';

  select coalesce(max(version), 0) + 1 into v_ver
  from public.trip_settlements where trip_id = p_trip_id;

  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

  insert into public.trip_settlements (
    trip_id, version, status, basis_hash, share_token, created_by
  ) values (
    p_trip_id, v_ver, 'open', p_basis_hash, v_token, auth.uid()
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

create or replace function public.mark_transfer_paid(p_transfer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t public.trip_settlement_transfers%rowtype;
  v_from_uid uuid;
  v_pending int;
begin
  select * into v_t from public.trip_settlement_transfers where id = p_transfer_id;
  if not found then raise exception 'not-found'; end if;

  select user_id into v_from_uid
  from public.trip_members where id = v_t.from_member;

  if not (
    public.is_trip_owner(v_t.trip_id)
    or v_from_uid = auth.uid()
  ) then
    raise exception 'forbidden';
  end if;

  update public.trip_settlement_transfers
  set status = 'paid', paid_at = now()
  where id = p_transfer_id;

  select count(*) into v_pending
  from public.trip_settlement_transfers
  where settlement_id = v_t.settlement_id and status <> 'paid';

  if v_pending = 0 then
    update public.trip_settlements
    set status = 'completed', completed_at = now()
    where id = v_t.settlement_id;
  end if;
end;
$$;

create or replace function public.confirm_transfer_received(p_transfer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t public.trip_settlement_transfers%rowtype;
  v_to_uid uuid;
begin
  select * into v_t from public.trip_settlement_transfers where id = p_transfer_id;
  if not found then raise exception 'not-found'; end if;

  select user_id into v_to_uid
  from public.trip_members where id = v_t.to_member;

  if not (
    public.is_trip_owner(v_t.trip_id)
    or v_to_uid = auth.uid()
  ) then
    raise exception 'forbidden';
  end if;

  update public.trip_settlement_transfers
  set confirmed_at = now()
  where id = p_transfer_id;
end;
$$;

revoke all on function public.create_settlement(uuid, text, jsonb) from public;
revoke all on function public.mark_transfer_paid(uuid) from public;
revoke all on function public.confirm_transfer_received(uuid) from public;
grant execute on function public.create_settlement(uuid, text, jsonb) to authenticated;
grant execute on function public.mark_transfer_paid(uuid) to authenticated;
grant execute on function public.confirm_transfer_received(uuid) to authenticated;
