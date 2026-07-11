-- Allow reading other users' profiles for community author pages.
-- Email is still stored but clients should not display it on public pages.
drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public"
  on public.profiles for select
  using (true);
