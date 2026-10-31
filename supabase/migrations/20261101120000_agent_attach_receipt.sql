-- P4: 영수증 사진 파이프라인 — 기존/신규 지출에 영수증 경로를 붙이는 에이전트 RPC.
-- - 기존 값은 덮어쓰지 않는다 (receipt_path/items/merchant_ko 는 비어 있을 때만 채움).
-- - 금액·환율·분담은 건드리지 않는다 → 정산 stale 처리 불필요.
-- - service_role 만 실행. p_actor 의 여행 멤버십을 직접 검증한다.
-- - 같은 호출을 두 번 해도 결과가 같다 (멱등).

create or replace function public.agent_attach_receipt(
  p_actor uuid,
  p_expense_id uuid,
  p_receipt_path text,
  p_items jsonb default null,
  p_merchant_ko text default null,
  p_clear_payment_method boolean default false,
  p_event_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.trip_expenses%rowtype;
  v_has_items boolean;
begin
  if p_actor is null then
    raise exception 'actor-required';
  end if;
  if p_receipt_path is null or length(trim(p_receipt_path)) = 0 then
    raise exception 'receipt-path-required';
  end if;

  select * into v_row from public.trip_expenses where id = p_expense_id;
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

  -- 이미 같은 영수증이면 변경 없이 성공 (멱등)
  if v_row.receipt_path is not null and v_row.receipt_path = p_receipt_path then
    return jsonb_build_object('ok', true, 'attached', true, 'already', true);
  end if;

  -- 다른 영수증이 이미 붙어 있으면 덮어쓰지 않는다
  if v_row.receipt_path is not null and length(trim(v_row.receipt_path)) > 0 then
    return jsonb_build_object('ok', true, 'attached', false, 'reason', 'has-receipt');
  end if;

  v_has_items := v_row.items is not null
    and jsonb_typeof(v_row.items) = 'array'
    and jsonb_array_length(v_row.items) > 0;

  update public.trip_expenses
  set
    receipt_path = p_receipt_path,
    items = case
      when v_has_items then items
      when p_items is not null and jsonb_typeof(p_items) = 'array' then p_items
      else coalesce(items, '[]'::jsonb)
    end,
    merchant_ko = coalesce(nullif(merchant_ko, ''), nullif(p_merchant_ko, '')),
    payment_method = case
      when p_clear_payment_method and v_row.source = 'receipt' then null
      else payment_method
    end,
    agent_reasons = coalesce(agent_reasons, '{}'::jsonb)
      || jsonb_build_object(
        'receipt_attached',
        jsonb_build_object('event_id', p_event_id, 'at', now())
      ),
    updated_at = now()
  where id = p_expense_id;

  return jsonb_build_object('ok', true, 'attached', true);
end;
$$;

revoke all on function public.agent_attach_receipt(uuid, uuid, text, jsonb, text, boolean, uuid) from public, anon, authenticated;
grant execute on function public.agent_attach_receipt(uuid, uuid, text, jsonb, text, boolean, uuid) to service_role;
