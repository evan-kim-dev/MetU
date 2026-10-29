-- P10-B: per-user automation onboarding state

create table if not exists public.agent_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  onboarding_status text not null default 'pending'
    check (onboarding_status in ('pending', 'partial', 'done', 'skipped')),
  platform text,
  selected_apps jsonb not null default '[]'::jsonb,
  last_notification_at timestamptz,
  last_device_test_at timestamptz,
  last_server_test_at timestamptz,
  last_dropped_app text,
  updated_at timestamptz not null default now()
);

alter table public.agent_user_state enable row level security;

drop policy if exists "agent_user_state_select_own" on public.agent_user_state;
create policy "agent_user_state_select_own"
  on public.agent_user_state for select
  using (user_id = auth.uid());

drop policy if exists "agent_user_state_update_own" on public.agent_user_state;
create policy "agent_user_state_update_own"
  on public.agent_user_state for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.agent_set_onboarding(
  p_status text,
  p_platform text default null,
  p_selected_apps jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := coalesce(nullif(trim(p_status), ''), 'pending');
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if v_status not in ('pending', 'partial', 'done', 'skipped') then
    raise exception 'invalid onboarding status';
  end if;

  insert into public.agent_user_state (
    user_id,
    onboarding_status,
    platform,
    selected_apps,
    updated_at
  )
  values (
    auth.uid(),
    v_status,
    p_platform,
    coalesce(p_selected_apps, '[]'::jsonb),
    now()
  )
  on conflict (user_id) do update set
    onboarding_status = v_status,
    platform = coalesce(p_platform, agent_user_state.platform),
    selected_apps = coalesce(p_selected_apps, agent_user_state.selected_apps),
    updated_at = now();
end;
$$;

revoke all on function public.agent_set_onboarding(text, text, jsonb) from public, anon;
grant execute on function public.agent_set_onboarding(text, text, jsonb) to authenticated;
