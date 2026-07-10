alter table public.trips
  add column if not exists share_token text unique;

create index if not exists trips_share_token_idx
  on public.trips (share_token)
  where share_token is not null;

create or replace function public.get_shared_trip(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return null;
  end if;

  select to_jsonb(t.*) - 'user_id' - 'share_token'
  into result
  from public.trips t
  where t.share_token = p_token
  limit 1;

  return result;
end;
$$;

revoke all on function public.get_shared_trip(text) from public;
grant execute on function public.get_shared_trip(text) to anon, authenticated;
