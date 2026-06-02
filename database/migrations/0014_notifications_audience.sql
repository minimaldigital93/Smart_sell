-- 0014_notifications_audience.sql
-- Adds `audience` so we can distinguish broadcast-to-all vs staff-only.
-- Existing rows default to 'all' (matches previous broadcast semantics).

do $$ begin
  create type public.notification_audience as enum ('all', 'staff');
exception when duplicate_object then null; end $$;

alter table public.notifications
  add column if not exists audience public.notification_audience not null default 'all';

create index if not exists notifications_audience_idx
  on public.notifications(audience, created_at desc)
  where user_id is null;

-- Update RLS: a user can see a notification if it targets them, or it's a
-- broadcast to 'all', or it's a staff-only broadcast and they're staff.

drop policy if exists notifications_select_visible on public.notifications;
create policy notifications_select_visible on public.notifications
  for select
  using (
    user_id = auth.uid()
    or (user_id is null and audience = 'all')
    or (user_id is null and audience = 'staff' and public.is_staff())
    or public.is_staff()
  );
