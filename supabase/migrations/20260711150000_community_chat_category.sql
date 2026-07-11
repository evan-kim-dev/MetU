-- Allow community posts in the new "chat" (잡담) category.
alter table public.community_posts
  drop constraint if exists community_posts_category_check;

alter table public.community_posts
  add constraint community_posts_category_check
  check (category in ('party', 'question', 'review', 'tip', 'chat'));
