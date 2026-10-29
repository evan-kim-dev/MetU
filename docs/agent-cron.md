# Agent cron (Vercel + optional Supabase)

## Vercel Cron

`vercel.json` schedules a daily hit on `/api/agent/cron/daily` (UTC `0 11 * * *`).

Set **`CRON_SECRET`** on Vercel. Cron sends:

```http
Authorization: Bearer <CRON_SECRET>
```

Implementations use `requireCronSecret()` in `lib/security/guard.ts` — same pattern as `/api/agent/sweep`.

## Optional: Supabase pg_cron + pg_net

Use this when you want the database to trigger HTTP without Vercel Cron. **Do not commit secrets** — store URL and bearer token in Supabase Vault or SQL variables configured in the dashboard.

```sql
-- Requires extensions: pg_cron, pg_net (enable in Supabase Dashboard → Database → Extensions)

-- Example: daily agent job (replace placeholders in Dashboard SQL editor)
/*
select cron.schedule(
  'metu_agent_daily',
  '0 11 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PRODUCTION_HOST/api/agent/cron/daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
*/

-- Store CRON_SECRET once (run manually; not in repo migrations):
-- alter database postgres set app.cron_secret = 'generate-a-long-random-string';
```

Sweep backlog separately if needed:

```sql
/*
select cron.schedule(
  'metu_agent_sweep',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PRODUCTION_HOST/api/agent/sweep',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
*/
```

## `api_cache` cleanup tip

Serverless cache rows in `api_cache` can grow over time. Periodic delete keeps table size bounded:

```sql
-- delete expired rows (safe to run daily)
delete from public.api_cache
where expires_at < now() - interval '1 day';

-- optional: hard cap very old rows even if TTL was long
delete from public.api_cache
where fetched_at < now() - interval '30 days';
```

Schedule the cleanup with pg_cron or run from the daily cron route after agent work.
