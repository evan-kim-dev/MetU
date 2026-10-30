-- Hot-table RLS: wrap auth.uid() in (select auth.uid()) so Postgres
-- evaluates once per statement (initplan) instead of per row.
-- Policy names / commands / roles unchanged; meaning identical.

create or replace function public.is_trip_owner(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id and t.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_trip_member(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_trip_owner(p_trip_id)
      or exists (
        select 1 from public.trip_members m
        where m.trip_id = p_trip_id and m.user_id = (select auth.uid())
      );
$$;

-- agent_events
drop policy if exists "agent_events_owner_select" on public.agent_events;
create policy "agent_events_owner_select"
  on public.agent_events for select
  using (user_id = (select auth.uid()));

-- trip_members
drop policy if exists "trip_members_select" on public.trip_members;
drop policy if exists "trip_members_insert" on public.trip_members;
drop policy if exists "trip_members_update" on public.trip_members;
drop policy if exists "trip_members_delete" on public.trip_members;
create policy "trip_members_select"
  on public.trip_members for select
  using (public.is_trip_member(trip_id));
create policy "trip_members_insert"
  on public.trip_members for insert
  with check (public.is_trip_owner(trip_id));
create policy "trip_members_update"
  on public.trip_members for update
  using (public.is_trip_owner(trip_id) or user_id = (select auth.uid()));
create policy "trip_members_delete"
  on public.trip_members for delete
  using (public.is_trip_owner(trip_id) and role <> 'owner');

-- trip_expenses
drop policy if exists "trip_expenses_select" on public.trip_expenses;
drop policy if exists "trip_expenses_insert" on public.trip_expenses;
drop policy if exists "trip_expenses_update" on public.trip_expenses;
drop policy if exists "trip_expenses_delete" on public.trip_expenses;
create policy "trip_expenses_select"
  on public.trip_expenses for select
  using (public.is_trip_member(trip_id));
create policy "trip_expenses_insert"
  on public.trip_expenses for insert
  with check (
    public.is_trip_member(trip_id)
    and created_by = (select auth.uid())
  );
create policy "trip_expenses_update"
  on public.trip_expenses for update
  using (created_by = (select auth.uid()) or public.is_trip_owner(trip_id));
create policy "trip_expenses_delete"
  on public.trip_expenses for delete
  using (created_by = (select auth.uid()) or public.is_trip_owner(trip_id));

-- trip_expense_shares
drop policy if exists "trip_expense_shares_select" on public.trip_expense_shares;
drop policy if exists "trip_expense_shares_write" on public.trip_expense_shares;
create policy "trip_expense_shares_select"
  on public.trip_expense_shares for select
  using (public.is_trip_member(trip_id));
create policy "trip_expense_shares_write"
  on public.trip_expense_shares for all
  using (
    public.is_trip_owner(trip_id)
    or exists (
      select 1 from public.trip_expenses e
      where e.id = expense_id and e.created_by = (select auth.uid())
    )
  )
  with check (
    public.is_trip_owner(trip_id)
    or exists (
      select 1 from public.trip_expenses e
      where e.id = expense_id and e.created_by = (select auth.uid())
    )
  );

-- notifications (select/update; insert policy keeps related-party checks)
drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
drop policy if exists "notifications_insert_related" on public.notifications;

create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "notifications_insert_related"
  on public.notifications for insert
  to authenticated
  with check (
    actor_id = (select auth.uid())
    and (
      (
        type = 'party_join_request'
        and exists (
          select 1 from public.community_posts cp
          where cp.id = notifications.post_id
            and cp.author_id = notifications.user_id
        )
        and exists (
          select 1 from public.party_members pm
          where pm.post_id = notifications.post_id
            and pm.user_id = (select auth.uid())
            and pm.status = 'pending'
        )
      )
      or (
        type in ('party_join_accepted', 'party_join_rejected')
        and exists (
          select 1 from public.community_posts cp
          where cp.id = notifications.post_id
            and cp.author_id = (select auth.uid())
        )
        and exists (
          select 1 from public.party_members pm
          where pm.post_id = notifications.post_id
            and pm.user_id = notifications.user_id
            and pm.is_host = false
        )
      )
      or (
        type = 'friend_request'
        and notifications.post_id is null
        and exists (
          select 1 from public.friendships f
          where f.user_id = (select auth.uid())
            and f.friend_id = notifications.user_id
            and f.status = 'pending'
        )
      )
      or (
        type in ('friend_accepted', 'friend_rejected')
        and notifications.post_id is null
        and exists (
          select 1 from public.friendships f
          where f.friend_id = (select auth.uid())
            and f.user_id = notifications.user_id
        )
      )
      or (
        type = 'dm_message'
        and notifications.post_id is null
        and notifications.user_id <> (select auth.uid())
        and public.dm_are_accepted_friends(
          (select auth.uid()),
          notifications.user_id
        )
      )
    )
  );
