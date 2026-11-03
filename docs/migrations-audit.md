# Supabase migrations audit

`supabase/migrations` 의 현재 파일 **42개** 기준(2026-11-03). 마이그레이션 파일은 수정하지 않고, 새 변경은 새 파일로만 추가해요.

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
| `20260711210000_drop_unused_tables` | drop `community_posts_with_author` view, `trip_plans`, `budget_insight_logs` |
| `20260713093000_dm_threads_messages` | `dm_threads`, `dm_messages`; RLS |
| `20260713095000_dm_attachments_notifications` | DM storage + notification types |
| `20261029120000_places_cache` | `places` cache; select auth, write service_role only |
| `20261029130000_trip_ledger` | `trip_members/expenses/shares` (owner RLS v1) |
| `20261029140000_trip_ledger_core` | invites, card profiles, FX, settlements; member RLS helpers; `create_trip_invite` · `preview_trip_invite` · `join_trip` |
| `20261029141000_save_trip_expense` | `save_trip_expense` / settlement RPCs |
| `20261030120000_agent_core` | agent tokens/events/steps, push, `ai_usage_log`, agent_* RPCs (service_role) |
| `20261030130000_agent_core_fixes` | agent RPC/policy fixes (storage, RLS, race, sweep, notify dedupe) |
| `20261030140000_api_cache` | `api_cache` RLS on, **no policies** (service_role only) |
| `20261030150000_agent_user_state` | onboarding state + `agent_set_onboarding` (authenticated) |
| `20261030160000_agent_trip_optional` | nullable `trip_id` on tokens/events |
| `20261030170000_agent_unassigned` | `unassigned` status + `agent_attach_unassigned` RPC |
| `20261031120000_agent_events_indexes` | inbox / automation-status / settlement coalesce indexes |
| `20261031140000_rls_initplan_hot` | hot-table RLS rewritten with `(select auth.uid())` (initplan) |
| `20261101120000_agent_attach_receipt` | agent RPC to attach receipt paths to new/existing expenses (P4) |
| `20261101130000_trip_dates_backfill` | trip start/end date backfill for notification → trip matching (P1) |
| `20261101140000_trip_member_read` | shared-trip read for members + shared settlement detail (P3) |
| `20261103100000_fx_billed_merge` | `billed_krw` + foreign/KRW-billed SMS merge RPC (K1) |
| `20261103110000_notif_expense_dcc` | `expense_dcc` notification type; keeps existing type list (K2) |
| `20261103120000_split_patch_history` | `trip_expense_split_history` + `agent_apply_split_patch` / `agent_undo_split_patch` (K7) |
| `20261103140000_guest_permissions` | anonymous `anon_block_*` restrictive policies, `trip_members_guest_guard`, `trip_expense_proposals`, `resolve_expense_proposal`, `set_expense_payer` (S0) |
| `20261103200000_shared_settlement_billed` | `get_shared_settlement_detail` adds server-computed `billedKrw` · `feePct` (K5) |
| `20261103210000_tax_free` | `tax_free` · `tax_excl_amount` columns for JP tax-refund tracker (K6) |
| `20261103220000_guest_claim_trigger` | replaces `trip_members_guest_guard()`: anonymous may claim an empty member slot (null → self) via `join_trip`; `is_owner` change blocked (V0 X1·I3) |

## Findings

- No conflicting duplicate `CREATE TABLE` for the same final schema; ledger is intentionally split (v1 then core).
- Cache tables (`places`, `api_cache`) correctly deny client writes via RLS with no insert policies.
- Agent writes go through `lib/agent/admin.ts` service role or `agent_*` security definer RPCs.
- `pg_cron` in agent_core is **commented only** — schedule in Dashboard if needed.
- Tooling mismatch: CLI `supabase db push` expects timestamp versions; `npm run db:push` records `*.sql` filenames. Align before a second project apply.
- Guest (anonymous) permissions: verify with `supabase/verify/guest_permissions_verify.sql` (blocks A–C; A9 · T19 · T20 need `20261103220000`). Findings and open items are in `docs/audit/baseline-2026-11.md`.
