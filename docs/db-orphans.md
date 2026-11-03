# DB 고아 보고서 (B3, 2026-11-03 KST)

> **보고만 해요. 아무것도 drop 하지 않았고, drop 하자고 단정하지도 않아요.** 삭제하려면 **새 마이그레이션 + Evan 승인**이 필요해요. 기존 마이그레이션은 수정하지 않아요.

- 기준: `supabase/migrations` 42개(최신 `20261103220000_guest_claim_trigger.sql`)를 파일명 순서로 적용한 **최종 스키마**(create table · alter table add/drop/rename column · drop table · create/drop function, 같은 파일 안은 문장 순서).
- 참조 수: `rg -w` 단어 일치 횟수. 코드 = `app` · `components` · `lib` · `scripts` · `middleware.ts` (테스트 제외), 테스트 = `*.test.*`, SQL = `supabase/**/*.sql` 전체(정의 1회 포함).
- 실 DB 와 다를 수 있어요(대시보드에서 직접 만든 것, 적용 안 된 마이그레이션). 아래 §4 의 읽기 전용 SQL 로 Evan 이 확인해요.

## 1. 요약

| 항목 | 수 |
|---|---|
| 마이그레이션 | 42 |
| 테이블 (남음 / drop 됨) | 31 / 2 |
| 컬럼 (남은 테이블) | 316 |
| 컬럼 — 코드 참조 있음 | 294 |
| 컬럼 — SQL 에서만 참조 (확인 필요) | 20 |
| 컬럼 — 정의 외 참조 없음 (의심) | 2 |
| SQL 함수 (남음 / drop 됨) | 39 / 1 |
| 함수 — 고아 후보 | 1 |

### 고아 후보 (확인 필요)

- 함수 `confirm_transfer_received` (security definer, 정의 `20261029141000_save_trip_expense.sql`): 코드 `.rpc()` 0 · 다른 SQL 호출 0 · 트리거/정책 아님. `authenticated` 에 execute grant 돼 있어요(`20261029141000_save_trip_expense.sql:283`). 앱은 송금 확인을 `mark_transfer_paid` 로 해요.
- 컬럼 `trip_expenses.time_is_estimated` (정의 `20261029140000_trip_ledger_core.sql`): 코드·테스트·다른 SQL 참조 0.
- 컬럼 `trip_expenses.reviewed_at` (정의 `20261030120000_agent_core.sql`): 코드·테스트·다른 SQL 참조 0.

### SQL 에서만 참조되는 컬럼 (대부분 정상)

앱 코드는 이 컬럼 이름을 직접 쓰지 않지만 security definer RPC·트리거 본문이 읽고 써요. 예: `trip_expense_split_history.before_*`/`after_*` 는 `agent_undo_split_patch` 가 되돌릴 때 읽어요. 고아로 보지 않아요.

| 테이블.컬럼 | SQL 참조 | 정의 |
|---|---|---|
| `agent_events.attempts` | 5 | `20261030120000_agent_core.sql` |
| `trip_expense_proposals.resolved_by` | 4 | `20261103140000_guest_permissions.sql` |
| `trip_expense_proposals.resolved_at` | 4 | `20261103140000_guest_permissions.sql` |
| `trip_expense_split_history.patch_kind` | 3 | `20261103120000_split_patch_history.sql` |
| `trip_expense_split_history.before_split_type` | 3 | `20261103120000_split_patch_history.sql` |
| `trip_expense_split_history.before_shares` | 4 | `20261103120000_split_patch_history.sql` |
| `trip_expense_split_history.before_inputs` | 3 | `20261103120000_split_patch_history.sql` |
| `trip_expense_split_history.after_split_type` | 2 | `20261103120000_split_patch_history.sql` |
| `trip_expense_split_history.after_shares` | 3 | `20261103120000_split_patch_history.sql` |
| `trip_expense_split_history.after_inputs` | 2 | `20261103120000_split_patch_history.sql` |
| `trip_expense_split_history.undone_at` | 3 | `20261103120000_split_patch_history.sql` |
| `trip_expense_split_history.undone_by` | 2 | `20261103120000_split_patch_history.sql` |
| `trip_expenses.source_index` | 8 | `20261030120000_agent_core.sql` |
| `trip_expenses.voided_at` | 7 | `20261030120000_agent_core.sql` |
| `trip_expenses.voided_by` | 3 | `20261030120000_agent_core.sql` |
| `trip_invites.claim_member_id` | 5 | `20261029140000_trip_ledger_core.sql` |
| `trip_invites.max_uses` | 5 | `20261029140000_trip_ledger_core.sql` |
| `trip_invites.use_count` | 4 | `20261029140000_trip_ledger_core.sql` |
| `trip_settlement_transfers.confirmed_at` | 2 | `20261029140000_trip_ledger_core.sql` |
| `trip_settlements.completed_at` | 7 | `20261029140000_trip_ledger_core.sql` |

## 2. 테이블별 컬럼

`이름 충돌 가능` = `id`·`status`·`created_at` 처럼 흔한 이름이라 참조 수가 다른 테이블 것까지 섞여 있어요(판정 신뢰 낮음).

### `agent_events` — 컬럼 14개 · 테이블 이름 코드 참조 56 · 생성 `20261030120000_agent_core.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `id` | 1762 | 564 | 317 | 사용 · 이름 충돌 가능 |
| `user_id` | 161 | 52 | 237 | 사용 · 이름 충돌 가능 |
| `trip_id` | 119 | 35 | 211 | 사용 · 이름 충돌 가능 |
| `source` | 366 | 121 | 14 | 사용 · 이름 충돌 가능 |
| `kind` | 381 | 160 | 10 | 사용 · 이름 충돌 가능 |
| `payload` | 200 | 39 | 15 | 사용 · 이름 충돌 가능 |
| `idempotency_key` | 4 | 3 | 8 | 사용 |
| `status` | 969 | 458 | 145 | 사용 · 이름 충돌 가능 |
| `attempts` | 0 | 0 | 5 | 확인 필요(SQL 에서만 참조) |
| `locked_at` | 4 | 2 | 11 | 사용 |
| `result` | 334 | 167 | 8 | 사용 · 이름 충돌 가능 |
| `error` | 1250 | 345 | 3 | 사용 · 이름 충돌 가능 |
| `created_at` | 100 | 26 | 74 | 사용 · 이름 충돌 가능 |
| `processed_at` | 20 | 6 | 4 | 사용 |

### `agent_ingest_tokens` — 컬럼 8개 · 테이블 이름 코드 참조 7 · 생성 `20261030120000_agent_core.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `id` | 1762 | 564 | 317 | 사용 · 이름 충돌 가능 |
| `user_id` | 161 | 52 | 237 | 사용 · 이름 충돌 가능 |
| `trip_id` | 119 | 35 | 211 | 사용 · 이름 충돌 가능 |
| `label` | 1044 | 124 | 27 | 사용 · 이름 충돌 가능 |
| `token_hash` | 4 | 0 | 7 | 사용 · 이름 충돌 가능 |
| `created_at` | 100 | 26 | 74 | 사용 · 이름 충돌 가능 |
| `last_used_at` | 5 | 0 | 1 | 사용 |
| `revoked_at` | 9 | 0 | 5 | 사용 |

### `agent_steps` — 컬럼 9개 · 테이블 이름 코드 참조 2 · 생성 `20261030120000_agent_core.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `id` | 1762 | 564 | 317 | 사용 · 이름 충돌 가능 |
| `event_id` | 1 | 0 | 5 | 사용 |
| `seq` | 13 | 3 | 1 | 사용 |
| `tool` | 4 | 0 | 1 | 사용 |
| `input` | 482 | 47 | 2 | 사용 |
| `output` | 5 | 2 | 1 | 사용 |
| `ms` | 74 | 5 | 6 | 사용 |
| `ok` | 731 | 344 | 21 | 사용 |
| `created_at` | 100 | 26 | 74 | 사용 · 이름 충돌 가능 |

### `agent_user_state` — 컬럼 9개 · 테이블 이름 코드 참조 5 · 생성 `20261030150000_agent_user_state.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `user_id` | 161 | 52 | 237 | 사용 · 이름 충돌 가능 |
| `onboarding_status` | 3 | 1 | 4 | 사용 |
| `platform` | 130 | 59 | 3 | 사용 |
| `selected_apps` | 3 | 1 | 3 | 사용 |
| `last_notification_at` | 6 | 8 | 1 | 사용 |
| `last_device_test_at` | 6 | 7 | 1 | 사용 |
| `last_server_test_at` | 4 | 1 | 1 | 사용 |
| `last_dropped_app` | 4 | 3 | 1 | 사용 |
| `updated_at` | 5 | 2 | 27 | 사용 · 이름 충돌 가능 |

### `ai_usage_log` — 컬럼 10개 · 테이블 이름 코드 참조 6 · 생성 `20261030120000_agent_core.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `id` | 1762 | 564 | 317 | 사용 · 이름 충돌 가능 |
| `user_id` | 161 | 52 | 237 | 사용 · 이름 충돌 가능 |
| `trip_id` | 119 | 35 | 211 | 사용 · 이름 충돌 가능 |
| `model` | 80 | 7 | 1 | 사용 |
| `purpose` | 23 | 7 | 1 | 사용 |
| `input_tokens` | 1 | 0 | 1 | 사용 |
| `output_tokens` | 1 | 0 | 1 | 사용 |
| `ms` | 74 | 5 | 6 | 사용 |
| `ok` | 731 | 344 | 21 | 사용 |
| `created_at` | 100 | 26 | 74 | 사용 · 이름 충돌 가능 |

### `api_cache` — 컬럼 4개 · 테이블 이름 코드 참조 6 · 생성 `20261030140000_api_cache.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `key` | 493 | 84 | 60 | 사용 |
| `value` | 554 | 79 | 13 | 사용 |
| `fetched_at` | 16 | 3 | 3 | 사용 |
| `expires_at` | 5 | 3 | 9 | 사용 · 이름 충돌 가능 |

### `comment_likes` — 컬럼 3개 · 테이블 이름 코드 참조 1 · 생성 `20260711120000_comment_likes.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `comment_id` | 8 | 0 | 3 | 사용 |
| `user_id` | 161 | 52 | 237 | 사용 · 이름 충돌 가능 |
| `created_at` | 100 | 26 | 74 | 사용 · 이름 충돌 가능 |

### `community_posts` — 컬럼 10개 · 테이블 이름 코드 참조 2 · 생성 `20260709150000_core_app_tables.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `id` | 1762 | 564 | 317 | 사용 · 이름 충돌 가능 |
| `author_id` | 20 | 0 | 47 | 사용 |
| `category` | 168 | 35 | 15 | 사용 · 이름 충돌 가능 |
| `destination` | 407 | 83 | 11 | 사용 · 이름 충돌 가능 |
| `title` | 504 | 53 | 1 | 사용 · 이름 충돌 가능 |
| `body` | 722 | 137 | 1 | 사용 · 이름 충돌 가능 |
| `party_data` | 13 | 0 | 7 | 사용 |
| `created_at` | 100 | 26 | 74 | 사용 · 이름 충돌 가능 |
| `updated_at` | 5 | 2 | 27 | 사용 · 이름 충돌 가능 |
| `image_urls` | 5 | 0 | 1 | 사용 |

### `dm_messages` — 컬럼 5개 · 테이블 이름 코드 참조 1 · 생성 `20260713093000_dm_threads_messages.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `id` | 1762 | 564 | 317 | 사용 · 이름 충돌 가능 |
| `thread_id` | 6 | 0 | 5 | 사용 |
| `sender_id` | 8 | 0 | 10 | 사용 |
| `message` | 418 | 81 | 3 | 사용 |
| `created_at` | 100 | 26 | 74 | 사용 · 이름 충돌 가능 |

### `dm_threads` — 컬럼 5개 · 테이블 이름 코드 참조 1 · 생성 `20260713093000_dm_threads_messages.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `id` | 1762 | 564 | 317 | 사용 · 이름 충돌 가능 |
| `user_low` | 8 | 0 | 12 | 사용 |
| `user_high` | 8 | 0 | 12 | 사용 |
| `created_at` | 100 | 26 | 74 | 사용 · 이름 충돌 가능 |
| `last_message_at` | 5 | 0 | 3 | 사용 |

### `friendships` — 컬럼 5개 · 테이블 이름 코드 참조 14 · 생성 `20260711160000_friendships.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `id` | 1762 | 564 | 317 | 사용 · 이름 충돌 가능 |
| `user_id` | 161 | 52 | 237 | 사용 · 이름 충돌 가능 |
| `friend_id` | 15 | 0 | 28 | 사용 |
| `created_at` | 100 | 26 | 74 | 사용 · 이름 충돌 가능 |
| `status` | 969 | 458 | 145 | 사용 · 이름 충돌 가능 |

### `fx_rates` — 컬럼 6개 · 테이블 이름 코드 참조 9 · 생성 `20261029140000_trip_ledger_core.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `rate_date` | 13 | 1 | 2 | 사용 |
| `base` | 201 | 109 | 2 | 사용 |
| `quote` | 15 | 2 | 2 | 사용 |
| `rate` | 157 | 64 | 1 | 사용 |
| `provider` | 187 | 36 | 9 | 사용 |
| `fetched_at` | 16 | 3 | 3 | 사용 |

### `ledger_card_profiles` — 컬럼 8개 · 테이블 이름 코드 참조 1 · 생성 `20261029140000_trip_ledger_core.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `id` | 1762 | 564 | 317 | 사용 · 이름 충돌 가능 |
| `user_id` | 161 | 52 | 237 | 사용 · 이름 충돌 가능 |
| `label` | 1044 | 124 | 27 | 사용 · 이름 충돌 가능 |
| `kind` | 381 | 160 | 10 | 사용 · 이름 충돌 가능 |
| `fee_rate` | 22 | 0 | 6 | 사용 |
| `fee_flat_krw` | 16 | 0 | 5 | 사용 |
| `note` | 70 | 8 | 7 | 사용 · 이름 충돌 가능 |
| `created_at` | 100 | 26 | 74 | 사용 · 이름 충돌 가능 |

### `notifications` — 컬럼 8개 · 테이블 이름 코드 참조 22 · 생성 `20260710220000_party_join_approval.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `id` | 1762 | 564 | 317 | 사용 · 이름 충돌 가능 |
| `user_id` | 161 | 52 | 237 | 사용 · 이름 충돌 가능 |
| `type` | 1593 | 217 | 41 | 사용 · 이름 충돌 가능 |
| `post_id` | 49 | 0 | 57 | 사용 · 이름 충돌 가능 |
| `actor_id` | 6 | 0 | 12 | 사용 |
| `payload` | 200 | 39 | 15 | 사용 · 이름 충돌 가능 |
| `read_at` | 8 | 0 | 2 | 사용 |
| `created_at` | 100 | 26 | 74 | 사용 · 이름 충돌 가능 |

### `party_chat_messages` — 컬럼 5개 · 테이블 이름 코드 참조 2 · 생성 `20260709162000_party_chat_messages.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `id` | 1762 | 564 | 317 | 사용 · 이름 충돌 가능 |
| `post_id` | 49 | 0 | 57 | 사용 · 이름 충돌 가능 |
| `sender_id` | 8 | 0 | 10 | 사용 |
| `message` | 418 | 81 | 3 | 사용 |
| `created_at` | 100 | 26 | 74 | 사용 · 이름 충돌 가능 |

### `party_members` — 컬럼 5개 · 테이블 이름 코드 참조 2 · 생성 `20260709150100_party_members.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `post_id` | 49 | 0 | 57 | 사용 · 이름 충돌 가능 |
| `user_id` | 161 | 52 | 237 | 사용 · 이름 충돌 가능 |
| `joined_at` | 4 | 0 | 1 | 사용 |
| `is_host` | 15 | 0 | 16 | 사용 |
| `status` | 969 | 458 | 145 | 사용 · 이름 충돌 가능 |

### `places` — 컬럼 20개 · 테이블 이름 코드 참조 216 · 생성 `20261029120000_places_cache.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `id` | 1762 | 564 | 317 | 사용 · 이름 충돌 가능 |
| `provider` | 187 | 36 | 9 | 사용 |
| `provider_place_id` | 4 | 0 | 2 | 사용 |
| `name` | 549 | 425 | 30 | 사용 · 이름 충돌 가능 |
| `lat` | 149 | 47 | 2 | 사용 |
| `lng` | 140 | 49 | 2 | 사용 |
| `address` | 20 | 1 | 1 | 사용 |
| `kind` | 381 | 160 | 10 | 사용 · 이름 충돌 가능 |
| `types` | 200 | 18 | 4 | 사용 |
| `rating` | 20 | 8 | 1 | 사용 |
| `user_rating_count` | 4 | 0 | 1 | 사용 |
| `price_level` | 3 | 0 | 1 | 사용 |
| `opening_hours` | 3 | 0 | 3 | 사용 |
| `utc_offset_minutes` | 4 | 0 | 1 | 사용 |
| `maps_uri` | 3 | 0 | 1 | 사용 |
| `phone` | 8 | 2 | 1 | 사용 |
| `category_name` | 7 | 4 | 1 | 사용 |
| `city` | 380 | 18 | 2 | 사용 |
| `country_code` | 15 | 1 | 1 | 사용 |
| `fetched_at` | 16 | 3 | 3 | 사용 |

### `post_comments` — 컬럼 5개 · 테이블 이름 코드 참조 2 · 생성 `20260709150000_core_app_tables.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `id` | 1762 | 564 | 317 | 사용 · 이름 충돌 가능 |
| `post_id` | 49 | 0 | 57 | 사용 · 이름 충돌 가능 |
| `author_id` | 20 | 0 | 47 | 사용 |
| `content` | 163 | 13 | 1 | 사용 · 이름 충돌 가능 |
| `created_at` | 100 | 26 | 74 | 사용 · 이름 충돌 가능 |

### `post_likes` — 컬럼 3개 · 테이블 이름 코드 참조 2 · 생성 `20260709150000_core_app_tables.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `post_id` | 49 | 0 | 57 | 사용 · 이름 충돌 가능 |
| `user_id` | 161 | 52 | 237 | 사용 · 이름 충돌 가능 |
| `created_at` | 100 | 26 | 74 | 사용 · 이름 충돌 가능 |

### `profiles` — 컬럼 10개 · 테이블 이름 코드 참조 52 · 생성 `20260709100400_create_profiles_and_avatars.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `id` | 1762 | 564 | 317 | 사용 · 이름 충돌 가능 |
| `display_name` | 35 | 14 | 26 | 사용 |
| `email` | 55 | 14 | 9 | 사용 · 이름 충돌 가능 |
| `avatar_url` | 25 | 0 | 4 | 사용 · 이름 충돌 가능 |
| `bio` | 36 | 0 | 1 | 사용 · 이름 충돌 가능 |
| `home_city` | 8 | 0 | 1 | 사용 |
| `travel_styles` | 10 | 0 | 1 | 사용 |
| `membership_label` | 8 | 0 | 2 | 사용 |
| `created_at` | 100 | 26 | 74 | 사용 · 이름 충돌 가능 |
| `updated_at` | 5 | 2 | 27 | 사용 · 이름 충돌 가능 |

### `push_subscriptions` — 컬럼 8개 · 테이블 이름 코드 참조 5 · 생성 `20261030120000_agent_core.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `id` | 1762 | 564 | 317 | 사용 · 이름 충돌 가능 |
| `user_id` | 161 | 52 | 237 | 사용 · 이름 충돌 가능 |
| `endpoint` | 9 | 0 | 1 | 사용 |
| `p256dh` | 5 | 0 | 1 | 사용 |
| `auth` | 156 | 43 | 241 | 사용 |
| `user_agent` | 1 | 0 | 1 | 사용 |
| `created_at` | 100 | 26 | 74 | 사용 · 이름 충돌 가능 |
| `last_ok_at` | 1 | 0 | 1 | 사용 |

### `trip_cash_rates` — 컬럼 6개 · 테이블 이름 코드 참조 1 · 생성 `20261029140000_trip_ledger_core.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `trip_id` | 119 | 35 | 211 | 사용 · 이름 충돌 가능 |
| `member_id` | 14 | 6 | 24 | 사용 · 이름 충돌 가능 |
| `currency` | 340 | 186 | 31 | 사용 · 이름 충돌 가능 |
| `krw_per_unit` | 4 | 0 | 1 | 사용 |
| `note` | 70 | 8 | 7 | 사용 · 이름 충돌 가능 |
| `updated_at` | 5 | 2 | 27 | 사용 · 이름 충돌 가능 |

### `trip_expense_proposals` — 컬럼 18개 · 테이블 이름 코드 참조 2 · 생성 `20261103140000_guest_permissions.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `id` | 1762 | 564 | 317 | 사용 · 이름 충돌 가능 |
| `trip_id` | 119 | 35 | 211 | 사용 · 이름 충돌 가능 |
| `proposed_by` | 6 | 0 | 14 | 사용 |
| `proposer_member_id` | 6 | 0 | 10 | 사용 |
| `label` | 1044 | 124 | 27 | 사용 · 이름 충돌 가능 |
| `amount` | 353 | 171 | 26 | 사용 · 이름 충돌 가능 |
| `currency` | 340 | 186 | 31 | 사용 · 이름 충돌 가능 |
| `category` | 168 | 35 | 15 | 사용 · 이름 충돌 가능 |
| `spent_on` | 17 | 1 | 17 | 사용 |
| `note` | 70 | 8 | 7 | 사용 · 이름 충돌 가능 |
| `items` | 928 | 143 | 27 | 사용 · 이름 충돌 가능 |
| `source` | 366 | 121 | 14 | 사용 · 이름 충돌 가능 |
| `status` | 969 | 458 | 145 | 사용 · 이름 충돌 가능 |
| `resolved_by` | 0 | 0 | 4 | 확인 필요(SQL 에서만 참조) |
| `resolved_at` | 0 | 0 | 4 | 확인 필요(SQL 에서만 참조) |
| `resolved_expense_id` | 5 | 0 | 4 | 사용 |
| `reject_reason` | 5 | 0 | 4 | 사용 |
| `created_at` | 100 | 26 | 74 | 사용 · 이름 충돌 가능 |

### `trip_expense_shares` — 컬럼 5개 · 테이블 이름 코드 참조 3 · 생성 `20261029130000_trip_ledger.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `expense_id` | 11 | 2 | 37 | 사용 |
| `member_id` | 14 | 6 | 24 | 사용 · 이름 충돌 가능 |
| `share_krw` | 11 | 6 | 17 | 사용 |
| `trip_id` | 119 | 35 | 211 | 사용 · 이름 충돌 가능 |
| `input_value` | 6 | 0 | 7 | 사용 |

### `trip_expense_split_history` — 컬럼 15개 · 테이블 이름 코드 참조 11 · 생성 `20261103120000_split_patch_history.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `id` | 1762 | 564 | 317 | 사용 · 이름 충돌 가능 |
| `trip_id` | 119 | 35 | 211 | 사용 · 이름 충돌 가능 |
| `expense_id` | 11 | 2 | 37 | 사용 |
| `actor` | 8 | 7 | 15 | 사용 |
| `idempotency_key` | 4 | 3 | 8 | 사용 |
| `patch_kind` | 0 | 0 | 3 | 확인 필요(SQL 에서만 참조) |
| `before_split_type` | 0 | 0 | 3 | 확인 필요(SQL 에서만 참조) |
| `before_shares` | 0 | 0 | 4 | 확인 필요(SQL 에서만 참조) |
| `before_inputs` | 0 | 0 | 3 | 확인 필요(SQL 에서만 참조) |
| `after_split_type` | 0 | 0 | 2 | 확인 필요(SQL 에서만 참조) |
| `after_shares` | 0 | 1 | 3 | 확인 필요(SQL 에서만 참조) |
| `after_inputs` | 0 | 0 | 2 | 확인 필요(SQL 에서만 참조) |
| `applied_at` | 1 | 0 | 2 | 사용 |
| `undone_at` | 0 | 2 | 3 | 확인 필요(SQL 에서만 참조) |
| `undone_by` | 0 | 1 | 2 | 확인 필요(SQL 에서만 참조) |

### `trip_expenses` — 컬럼 50개 · 테이블 이름 코드 참조 31 · 생성 `20261029130000_trip_ledger.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `id` | 1762 | 564 | 317 | 사용 · 이름 충돌 가능 |
| `trip_id` | 119 | 35 | 211 | 사용 · 이름 충돌 가능 |
| `paid_by` | 7 | 0 | 14 | 사용 |
| `label` | 1044 | 124 | 27 | 사용 · 이름 충돌 가능 |
| `category` | 168 | 35 | 15 | 사용 · 이름 충돌 가능 |
| `amount` | 353 | 171 | 26 | 사용 · 이름 충돌 가능 |
| `currency` | 340 | 186 | 31 | 사용 · 이름 충돌 가능 |
| `fx_rate_to_krw` | 7 | 0 | 16 | 사용 |
| `krw_amount` | 24 | 5 | 32 | 사용 |
| `place_id` | 6 | 0 | 5 | 사용 |
| `spent_on` | 17 | 1 | 17 | 사용 |
| `day_index` | 5 | 0 | 5 | 사용 |
| `receipt_path` | 7 | 4 | 5 | 사용 |
| `split_type` | 10 | 2 | 12 | 사용 |
| `created_at` | 100 | 26 | 74 | 사용 · 이름 충돌 가능 |
| `created_by` | 6 | 2 | 26 | 사용 · 이름 충돌 가능 |
| `merchant` | 159 | 90 | 9 | 사용 |
| `merchant_ko` | 16 | 7 | 10 | 사용 |
| `payment_method` | 11 | 10 | 7 | 사용 |
| `card_profile_id` | 5 | 0 | 4 | 사용 |
| `card_label` | 5 | 1 | 4 | 사용 |
| `fx_rate` | 12 | 0 | 16 | 사용 |
| `fx_rate_date` | 11 | 0 | 8 | 사용 |
| `fx_source` | 6 | 0 | 9 | 사용 |
| `fx_is_fallback` | 11 | 0 | 8 | 사용 |
| `fee_rate` | 22 | 0 | 6 | 사용 |
| `fee_flat_krw` | 16 | 0 | 5 | 사용 |
| `krw_base` | 18 | 0 | 19 | 사용 |
| `fee_krw` | 10 | 0 | 9 | 사용 |
| `source` | 366 | 121 | 14 | 사용 · 이름 충돌 가능 |
| `raw_input` | 3 | 1 | 5 | 사용 |
| `items` | 928 | 143 | 27 | 사용 · 이름 충돌 가능 |
| `paid_at` | 12 | 8 | 6 | 사용 |
| `time_is_estimated` | 0 | 0 | 1 | 의심(정의 외 참조 없음) |
| `dedupe_hash` | 7 | 0 | 5 | 사용 |
| `note` | 70 | 8 | 7 | 사용 · 이름 충돌 가능 |
| `updated_at` | 5 | 2 | 27 | 사용 · 이름 충돌 가능 |
| `status` | 969 | 458 | 145 | 사용 · 이름 충돌 가능 |
| `source_event_id` | 2 | 2 | 9 | 사용 |
| `source_index` | 0 | 0 | 8 | 확인 필요(SQL 에서만 참조) |
| `agent_reasons` | 8 | 0 | 10 | 사용 |
| `reviewed_at` | 0 | 0 | 1 | 의심(정의 외 참조 없음) |
| `voided_at` | 0 | 1 | 7 | 확인 필요(SQL 에서만 참조) |
| `voided_by` | 0 | 0 | 3 | 확인 필요(SQL 에서만 참조) |
| `billed_krw` | 22 | 4 | 19 | 사용 |
| `billed_source` | 7 | 0 | 7 | 사용 |
| `billed_event_id` | 8 | 0 | 9 | 사용 |
| `fx_merge` | 7 | 0 | 14 | 사용 |
| `tax_free` | 8 | 12 | 3 | 사용 |
| `tax_excl_amount` | 5 | 0 | 3 | 사용 |

### `trip_invites` — 컬럼 10개 · 테이블 이름 코드 참조 1 · 생성 `20261029140000_trip_ledger_core.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `id` | 1762 | 564 | 317 | 사용 · 이름 충돌 가능 |
| `trip_id` | 119 | 35 | 211 | 사용 · 이름 충돌 가능 |
| `token_hash` | 4 | 0 | 7 | 사용 · 이름 충돌 가능 |
| `created_by` | 6 | 2 | 26 | 사용 · 이름 충돌 가능 |
| `claim_member_id` | 0 | 0 | 5 | 확인 필요(SQL 에서만 참조) |
| `expires_at` | 5 | 3 | 9 | 사용 · 이름 충돌 가능 |
| `max_uses` | 0 | 0 | 5 | 확인 필요(SQL 에서만 참조) |
| `use_count` | 0 | 0 | 4 | 확인 필요(SQL 에서만 참조) |
| `revoked_at` | 9 | 0 | 5 | 사용 |
| `created_at` | 100 | 26 | 74 | 사용 · 이름 충돌 가능 |

### `trip_members` — 컬럼 8개 · 테이블 이름 코드 참조 30 · 생성 `20261029130000_trip_ledger.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `id` | 1762 | 564 | 317 | 사용 · 이름 충돌 가능 |
| `trip_id` | 119 | 35 | 211 | 사용 · 이름 충돌 가능 |
| `display_name` | 35 | 14 | 26 | 사용 |
| `user_id` | 161 | 52 | 237 | 사용 · 이름 충돌 가능 |
| `is_owner` | 9 | 8 | 18 | 사용 |
| `created_at` | 100 | 26 | 74 | 사용 · 이름 충돌 가능 |
| `role` | 181 | 13 | 48 | 사용 · 이름 충돌 가능 |
| `auto_include` | 3 | 7 | 1 | 사용 |

### `trip_settlement_transfers` — 컬럼 9개 · 테이블 이름 코드 참조 3 · 생성 `20261029140000_trip_ledger_core.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `id` | 1762 | 564 | 317 | 사용 · 이름 충돌 가능 |
| `settlement_id` | 2 | 0 | 10 | 사용 |
| `trip_id` | 119 | 35 | 211 | 사용 · 이름 충돌 가능 |
| `from_member` | 3 | 4 | 10 | 사용 |
| `to_member` | 3 | 4 | 9 | 사용 |
| `krw` | 153 | 88 | 13 | 사용 |
| `status` | 969 | 458 | 145 | 사용 · 이름 충돌 가능 |
| `paid_at` | 12 | 8 | 6 | 사용 |
| `confirmed_at` | 0 | 0 | 2 | 확인 필요(SQL 에서만 참조) |

### `trip_settlements` — 컬럼 10개 · 테이블 이름 코드 참조 8 · 생성 `20261029140000_trip_ledger_core.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `id` | 1762 | 564 | 317 | 사용 · 이름 충돌 가능 |
| `trip_id` | 119 | 35 | 211 | 사용 · 이름 충돌 가능 |
| `version` | 23 | 16 | 16 | 사용 |
| `status` | 969 | 458 | 145 | 사용 · 이름 충돌 가능 |
| `basis_hash` | 5 | 3 | 5 | 사용 |
| `share_token` | 12 | 7 | 12 | 사용 |
| `created_by` | 6 | 2 | 26 | 사용 · 이름 충돌 가능 |
| `created_at` | 100 | 26 | 74 | 사용 · 이름 충돌 가능 |
| `completed_at` | 0 | 0 | 7 | 확인 필요(SQL 에서만 참조) |
| `origin` | 170 | 42 | 8 | 사용 |

### `trips` — 컬럼 25개 · 테이블 이름 코드 참조 499 · 생성 `20260709150000_core_app_tables.sql`

| 컬럼 | 코드 참조 | 테스트 참조 | SQL 참조 | 판정 |
|---|---:|---:|---:|---|
| `id` | 1762 | 564 | 317 | 사용 · 이름 충돌 가능 |
| `user_id` | 161 | 52 | 237 | 사용 · 이름 충돌 가능 |
| `destination` | 407 | 83 | 11 | 사용 · 이름 충돌 가능 |
| `country` | 372 | 36 | 3 | 사용 · 이름 충돌 가능 |
| `origin` | 170 | 42 | 8 | 사용 |
| `date_range` | 14 | 7 | 13 | 사용 |
| `d_day` | 7 | 1 | 1 | 사용 |
| `budget` | 167 | 5 | 4 | 사용 |
| `spent` | 49 | 9 | 1 | 사용 |
| `people` | 130 | 7 | 2 | 사용 |
| `styles` | 106 | 9 | 1 | 사용 |
| `image_url` | 7 | 1 | 1 | 사용 · 이름 충돌 가능 |
| `memo` | 41 | 14 | 1 | 사용 |
| `status` | 969 | 458 | 145 | 사용 · 이름 충돌 가능 |
| `budget_allocation` | 7 | 0 | 2 | 사용 |
| `daily_schedule` | 7 | 0 | 1 | 사용 |
| `tips` | 77 | 2 | 1 | 사용 |
| `expenses` | 200 | 110 | 7 | 사용 |
| `created_at` | 100 | 26 | 74 | 사용 · 이름 충돌 가능 |
| `updated_at` | 5 | 2 | 27 | 사용 · 이름 충돌 가능 |
| `share_token` | 12 | 7 | 12 | 사용 |
| `start_date` | 24 | 33 | 9 | 사용 |
| `end_date` | 26 | 23 | 6 | 사용 |
| `local_currency` | 14 | 12 | 3 | 사용 |
| `auto_settle` | 3 | 1 | 1 | 사용 |

### drop 된 테이블

- `budget_insight_logs` — `20260711210000_drop_unused_tables.sql`
- `trip_plans` — `20260711210000_drop_unused_tables.sql`
- (뷰) `community_posts_with_author` — `20260711210000_drop_unused_tables.sql`

## 3. SQL 함수

| 함수 | security | 정의 | 코드 .rpc() | 테스트 | 다른 SQL 호출 | 트리거 | RLS 정책 | 판정 |
|---|---|---|---:|---:|---:|---|---|---|
| `_fx_resplit_shares` | definer | `20261103100000_fx_billed_merge` | 0 | 0 | 2 |  |  | 다른 SQL 에서 호출 |
| `agent_apply_billed_krw` | definer | `20261103100000_fx_billed_merge` | 2 | 0 | 0 |  |  | 사용(.rpc) |
| `agent_apply_split_patch` | definer | `20261103120000_split_patch_history` | 1 | 3 | 0 |  |  | 사용(.rpc) |
| `agent_attach_receipt` | definer | `20261101120000_agent_attach_receipt` | 1 | 7 | 0 |  |  | 사용(.rpc) |
| `agent_attach_unassigned` | definer | `20261030170000_agent_unassigned`<br>`20261101130000_trip_dates_backfill` | 1 | 5 | 0 |  |  | 사용(.rpc) |
| `agent_claim_event` | definer | `20261030120000_agent_core` | 1 | 4 | 0 |  |  | 사용(.rpc) |
| `agent_create_settlement` | definer | `20261030120000_agent_core` | 1 | 0 | 0 |  |  | 사용(.rpc) |
| `agent_ensure_owner_member` | definer | `20261101130000_trip_dates_backfill` | 1 | 11 | 0 |  |  | 사용(.rpc) |
| `agent_notify` | definer | `20261030120000_agent_core` | 1 | 1 | 0 |  |  | 사용(.rpc) |
| `agent_save_expense` | definer | `20261030120000_agent_core`<br>`20261030130000_agent_core_fixes` | 1 | 23 | 0 |  |  | 사용(.rpc) |
| `agent_set_onboarding` | definer | `20261030150000_agent_user_state` | 1 | 2 | 0 |  |  | 사용(.rpc) |
| `agent_sweep_candidates` | definer | `20261030120000_agent_core`<br>`20261030130000_agent_core_fixes` | 2 | 0 | 0 |  |  | 사용(.rpc) |
| `agent_undo_split_patch` | definer | `20261103120000_split_patch_history` | 1 | 3 | 0 |  |  | 사용(.rpc) |
| `agent_unmerge_billed_krw` | definer | `20261103100000_fx_billed_merge` | 1 | 2 | 0 |  |  | 사용(.rpc) |
| `agent_void_expense` | definer | `20261030120000_agent_core`<br>`20261030130000_agent_core_fixes` | 1 | 0 | 0 |  |  | 사용(.rpc) |
| `confirm_transfer_received` | definer | `20261029141000_save_trip_expense` | 0 | 0 | 0 |  |  | 고아 후보 |
| `create_settlement` | definer | `20261029141000_save_trip_expense` | 1 | 0 | 0 |  |  | 사용(.rpc) |
| `create_trip_invite` | definer | `20261029140000_trip_ledger_core` | 1 | 6 | 0 |  |  | 사용(.rpc) |
| `dm_are_accepted_friends` | invoker | `20260713093000_dm_threads_messages` | 0 | 0 | 6 |  | 예 | RLS 정책 헬퍼 |
| `dm_touch_thread_last_message` | definer | `20260713093000_dm_threads_messages` | 0 | 0 | 0 | 예 |  | 트리거 함수 |
| `ensure_trip_owner_member` | definer | `20261029140000_trip_ledger_core` | 1 | 0 | 0 |  |  | 사용(.rpc) |
| `get_ledger_trip` | definer | `20261029140000_trip_ledger_core` | 3 | 0 | 0 |  |  | 사용(.rpc) |
| `get_shared_ledger` | definer | `20261029130000_trip_ledger` | 1 | 2 | 0 |  |  | 사용(.rpc) |
| `get_shared_settlement` | definer | `20261029140000_trip_ledger_core` | 1 | 13 | 0 |  |  | 사용(.rpc) |
| `get_shared_settlement_detail` | definer | `20261101140000_trip_member_read`<br>`20261103200000_shared_settlement_billed` | 2 | 8 | 0 |  |  | 사용(.rpc) |
| `get_shared_trip` | definer | `20260710160000_trip_share_token` | 1 | 0 | 0 |  |  | 사용(.rpc) |
| `handle_new_user_profile` | definer | `20260709100400_create_profiles_and_avatars` | 0 | 0 | 0 | 예 |  | 트리거 함수 |
| `is_trip_member` | definer | `20261029140000_trip_ledger_core`<br>`20261031140000_rls_initplan_hot` | 0 | 2 | 15 |  | 예 | RLS 정책 헬퍼 |
| `is_trip_owner` | definer | `20261029140000_trip_ledger_core`<br>`20261031140000_rls_initplan_hot` | 0 | 0 | 28 |  | 예 | RLS 정책 헬퍼 |
| `join_trip` | definer | `20261029140000_trip_ledger_core` | 1 | 2 | 0 |  |  | 사용(.rpc) |
| `mark_transfer_paid` | definer | `20261029141000_save_trip_expense` | 1 | 0 | 0 |  |  | 사용(.rpc) |
| `preview_trip_invite` | definer | `20261029140000_trip_ledger_core` | 1 | 3 | 0 |  |  | 사용(.rpc) |
| `resolve_expense_proposal` | definer | `20261103140000_guest_permissions` | 1 | 0 | 0 |  |  | 사용(.rpc) |
| `save_trip_expense` | invoker | `20261029141000_save_trip_expense` | 1 | 0 | 2 |  |  | 사용(.rpc) |
| `set_expense_payer` | definer | `20261103140000_guest_permissions` | 1 | 1 | 0 |  |  | 사용(.rpc) |
| `set_profiles_updated_at` | invoker | `20260709100400_create_profiles_and_avatars` | 0 | 0 | 0 | 예 |  | 트리거 함수 |
| `set_updated_at` | invoker | `20260709150000_core_app_tables` | 0 | 0 | 0 | 예 |  | 트리거 함수 |
| `trip_expense_proposals_pending_cap` | invoker | `20261103140000_guest_permissions` | 0 | 0 | 0 | 예 |  | 트리거 함수 |
| `trip_members_guest_guard` | invoker | `20261103140000_guest_permissions`<br>`20261103220000_guest_claim_trigger` | 0 | 1 | 0 | 예 |  | 트리거 함수 |

drop 된 함수:
- `is_uuid_text` — `20260711200000_normalize_user_fks.sql` (같은 파일에서 만들고 마지막에 drop)

## 4. 실 DB 확인용 읽기 전용 SQL (Evan 이 Supabase SQL Editor 에서 실행)

에이전트는 DB 에 접속하지 않았어요. 아래는 모두 `select` 만 해요. 결과에 실제 데이터 값은 나오지 않아요(이름·개수만).

```sql
-- 4-1) public 스키마의 실제 컬럼 목록 (마이그레이션 최종 상태와 비교)
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- 4-2) 테이블별 행 수(추정치) · 마지막 쓰기 흔적
select relname as table_name,
       n_live_tup as approx_rows,
       n_tup_ins as inserts,
       n_tup_upd as updates,
       n_tup_del as deletes,
       last_autovacuum,
       last_autoanalyze
from pg_stat_user_tables
where schemaname = 'public'
order by relname;

-- 4-3) public 함수 목록 · 인자 · security definer 여부
select p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer,
       l.lanname as language
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname = 'public'
order by p.proname;

-- 4-4) 함수별 호출 통계 (track_functions 가 켜져 있을 때만 값이 있어요)
select funcname, calls, total_time
from pg_stat_user_functions
where schemaname = 'public'
order by funcname;

-- 4-5) 고아 후보 함수의 grant 상태
select grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'confirm_transfer_received';

-- 4-6) 의심 컬럼이 실제로 값을 갖는지 (개수만)
select
  count(*) filter (where time_is_estimated) as time_estimated_true,
  count(*) filter (where reviewed_at is not null) as reviewed_at_set
from public.trip_expenses;

select count(*) filter (where confirmed_at is not null) as transfers_confirmed_at_set
from public.trip_settlement_transfers;
```

비교 방법: 4-1 결과에 §2 에 없는 컬럼이 있으면 대시보드에서 직접 만든 것이고, §2 에 있는데 4-1 에 없으면 그 마이그레이션이 적용되지 않은 거예요.

## 5. 런북과 다른 점

| 런북 기록 | 실제 |
|---|---|
| 참조 0 함수 중 `is_uuid_text` 는 헬퍼라 유지 | `20260711200000_normalize_user_fks.sql` 541행에서 이미 `drop function` — 남아 있지 않아요 |
| 컬럼 단위 고아는 미분석 | 이 문서 §1·§2 에서 분석(의심 2 · SQL 전용 20) |
| `confirm_transfer_received` 만 호출처 0 | 같아요. 추가로 `trip_settlement_transfers.confirmed_at` 은 이 함수만 쓰는 컬럼이에요 |
| create table 33개 중 3개 drop | 테이블 33개(남음 31 · drop 2: `trip_plans`·`budget_insight_logs`) + 뷰 `community_posts_with_author` drop — 같아요 |

## 6. 다음 단계 (Evan 결정)

- [ ] §4 SQL 을 실행해 마이그레이션 최종 상태와 실 DB 가 같은지 확인
- [ ] `confirm_transfer_received` · `trip_expenses.time_is_estimated` · `trip_expenses.reviewed_at` · `trip_settlement_transfers.confirmed_at` 를 남길지 결정
  - 지우기로 하면 **새 마이그레이션 + 승인**으로 별도 세션에서 해요(이 PR 은 아무것도 지우지 않아요).
  - `reviewed_at` 은 `20261030120000_agent_core.sql` 에서 추가됐고 지금 읽거나 쓰는 곳이 없어요. 쓸 계획이 있는지 먼저 확인해요.
