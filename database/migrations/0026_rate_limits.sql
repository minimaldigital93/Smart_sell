-- 0026_rate_limits.sql
--
-- Audit finding #14: the app's rate limiter was an in-process Map, so on a
-- serverless / multi-instance deploy each instance counted independently and
-- the limit never actually held (and reset on every cold start). This moves
-- the counter into Postgres so all instances share one atomic window.
--
-- The app calls check_rate_limit() and falls back to its in-memory limiter
-- only if this RPC is unreachable, so throttling degrades gracefully rather
-- than failing fully open.

create table if not exists public.rate_limits (
  key       text primary key,
  count     integer not null,
  reset_at  timestamptz not null
);

create index if not exists rate_limits_reset_idx on public.rate_limits(reset_at);

-- Only the SECURITY DEFINER function below may read/write this table.
alter table public.rate_limits enable row level security;

-- ----------------------------------------------------------------------------
-- check_rate_limit: atomic fixed-window counter.
--   * First hit in a window (or an expired window) → count = 1, fresh reset_at.
--   * Subsequent hits in-window → count + 1.
-- The whole thing is one INSERT ... ON CONFLICT statement, so concurrent
-- callers across instances serialize on the row and can't overshoot.
--
-- Returns: { allowed: bool, remaining?: int, retry_after?: int }
-- ----------------------------------------------------------------------------
create or replace function public.check_rate_limit(
  p_key        text,
  p_limit      integer,
  p_window_sec integer
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_now   timestamptz := now();
  v_count integer;
  v_reset timestamptz;
begin
  insert into public.rate_limits as r (key, count, reset_at)
  values (p_key, 1, v_now + make_interval(secs => p_window_sec))
  on conflict (key) do update
    set count = case
                  when r.reset_at <= v_now then 1
                  else r.count + 1
                end,
        reset_at = case
                  when r.reset_at <= v_now
                    then v_now + make_interval(secs => p_window_sec)
                  else r.reset_at
                end
  returning r.count, r.reset_at into v_count, v_reset;

  if v_count > p_limit then
    return jsonb_build_object(
      'allowed', false,
      'retry_after', greatest(1, ceil(extract(epoch from (v_reset - v_now)))::int)
    );
  end if;

  return jsonb_build_object('allowed', true, 'remaining', p_limit - v_count);
end $$;

revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer)
  to anon, authenticated;

-- Optional housekeeping: stale rows are harmless (each key is reused via
-- upsert) but accumulate with distinct IPs over time. If you run pg_cron:
--   select cron.schedule('rate-limits-sweep', '0 * * * *',
--     $$delete from public.rate_limits where reset_at < now() - interval '1 day'$$);
