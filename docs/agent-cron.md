# Agent cron (Vercel + optional Supabase)

## Vercel Cron

`vercel.json` schedules **one** daily hit on `/api/agent/cron/daily` (UTC `0 11 * * *`).
Vercel Cron uses **GET**. The route also accepts POST for manual/pg_net callers.

Hobby plan allows a single cron job per day, so the daily handler also runs an
`agent_sweep_candidates` pass. `/api/agent/sweep` remains for manual drains.

Set **`CRON_SECRET`** on Vercel. Cron sends:

```http
Authorization: Bearer <CRON_SECRET>
```

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://met-u.vercel.app/api/agent/cron/daily"
```

Auth uses `requireCronSecret()` in `lib/security/guard.ts` (timing-safe compare).
Missing `CRON_SECRET` → 503 in production-style configs; wrong bearer → 401.

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
  select net.http_get(
    url := 'https://YOUR_PRODUCTION_HOST/api/agent/cron/daily',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
    )
  ) as request_id;
  $$
);
*/

-- Store CRON_SECRET once (run manually; not in repo migrations):
-- alter database postgres set app.cron_secret = 'generate-a-long-random-string';
```

Manual sweep (optional; daily already sweeps on Hobby):

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://YOUR_PRODUCTION_HOST/api/agent/sweep"
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

## Hobby demo tip (flush / delayed domain events)

Vercel Hobby only runs the daily cron once per day, so coalesce flush / stuck
`received` events may wait until then. Prefer Supabase **pg_cron + pg_net** to
`GET/POST /api/agent/sweep` every 1–5 minutes during demos (put `CRON_SECRET` in
Vault — never commit the secret).
