-- K2: DCC 경고 알림 타입 추가. 기존 notifications_type_check 목록을 모두 유지한다.
-- 멱등: drop + recreate. 데이터 삭제 없음.

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'party_join_request',
      'party_join_accepted',
      'party_join_rejected',
      'friend_request',
      'friend_accepted',
      'friend_rejected',
      'dm_message',
      'expense_added',
      'expense_review',
      'expense_voided',
      'expense_dcc',
      'settlement_ready',
      'settlement_stale',
      'transfer_marked_paid',
      'transfer_reminder',
      'agent_digest'
    )
  );
