-- 0006_notifications.sql
-- Notifications: per-user or broadcast (user_id null). Read tracking is per-user.

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  title       text not null,
  message     text not null,
  type        public.notification_type not null default 'system',
  metadata    jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_id_idx
  on public.notifications(user_id, created_at desc);
create index if not exists notifications_broadcast_idx
  on public.notifications(created_at desc) where user_id is null;
create index if not exists notifications_unread_idx
  on public.notifications(user_id) where read_at is null;
