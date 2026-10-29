# Supabase migrations audit (feat/agent-v2)

## Apply on a **dev** project only (do not run from CI blindly)

```bash
npx supabase link --project-ref <DEV_PROJECT_REF>
npx supabase db push
```

Remote history may use `filename.sql` as `schema_migrations.version` (custom `npm run db:push`). Prefer one tooling path.

## File summary (date order)

| File | Creates / changes |
|------|-------------------|
| `20260709100400_create_profiles_and_avatars` | `profiles` + trigger on signup; RLS |
| `20260709150000_core_app_tables` | `trips`, community/posts/likes, `trip_plans`, `budget_insight_logs`; RLS |
| `20260709150100_party_members` | `party_members`; RLS |
| `20260709162000_party_chat_messages` | `party_chat_messages`; RLS |
| `20260710120000_party_chat_realtime` | realtime publication for party chat |
| `20260710150000_party_chat_attachments` | storage policies for chat attachments |
| `20260710160000_trip_share_token` | `trips.share_token` + `get_shared_trip` |
| `20260710170000_community_post_images` | post image columns + storage policies |
| `20260710180000_checklist_docs_storage` | checklist docs storage policies |
| `20260710220000_party_join_approval` | `notifications` + party join columns; RLS |
| `20260710221000_notifications_realtime` | realtime for notifications |
| `20260711120000_comment_likes` | `comment_likes`; RLS |
| `20260711140000_profiles_public_read` | public profile select policy |
| `20260711150000_community_chat_category` | community category column |
| `20260711160000_friendships` | `friendships`; RLS |
| `20260711170000_friend_requests` | friend request columns/policies |
| `20260711200000_normalize_user_fks` | UUID FKs + policy rewrite |
| `20260711210000_drop_unused_tables` | drop unused legacy tables |
| `20260713093000_dm_threads_messages` | `dm_threads`, `dm_messages`; RLS |
| `20260713095000_dm_attachments_notifications` | DM storage + notification types |
| `20261029120000_places_cache` | `places` cache; select auth, write service_role only |
| `20261029130000_trip_ledger` | `trip_members/expenses/shares` (owner RLS v1) |
| `20261029140000_trip_ledger_core` | invites, card profiles, FX, settlements; member RLS helpers |
| `20261029141000_save_trip_expense` | `save_trip_expense` / settlement RPCs |
| `20261030120000_agent_core` | agent tokens/events/steps, push, `ai_usage_log`, agent_* RPCs (service_role) |
| `20261030130000_agent_core_fixes` | agent RPC/policy fixes |
| `20261030140000_api_cache` | `api_cache` RLS on, **no policies** (service_role only) |
| `20261030150000_agent_user_state` | onboarding state + `agent_set_onboarding` (authenticated) |
| `20261030160000_agent_trip_optional` | nullable `trip_id` on tokens/events |

## Findings

- No conflicting duplicate `CREATE TABLE` for the same final schema; ledger is intentionally split (v1 then core).
- Cache tables (`places`, `api_cache`) correctly deny client writes via RLS with no insert policies.
- Agent writes go through `lib/agent/admin.ts` service role or `agent_*` security definer RPCs.
- `pg_cron` in agent_core is **commented only** — schedule in Dashboard if needed.
- Tooling mismatch: CLI `supabase db push` expects timestamp versions; `npm run db:push` records `*.sql` filenames. Align before a second project apply.
