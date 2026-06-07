-- 0030_reset_users_seed_admin.sql
-- Reset accounts for phone-based auth.
--
-- 1) Delete ALL existing auth users so customers re-register with a phone
--    number. Order history is kept (orders.user_id and movements.created_by are
--    `on delete set null`); profiles, per-user notifications and loyalty rows
--    are removed with their users.
-- 2) Seed a single admin that signs in with phone 017552223 / password 12345678.
--    The phone normalizes to 17552223, mapped to 17552223@phone.csms.app.
--
-- IMPORTANT: the synthetic email uses a real TLD (.app) because GoTrue rejects
-- reserved TLDs like `.local`. The token columns are set to '' (NOT null) —
-- GoTrue cannot scan NULL token columns and every auth query 500s otherwise.
--
-- ⚠️  DESTRUCTIVE + one-off. Run in the Supabase SQL editor as `postgres`, on a
--     backed-up database. Re-running wipes users again and recreates the admin.

create extension if not exists pgcrypto;

-- 1) Wipe every existing account (raw DELETE bypasses GoTrue's row scan, so it
--    clears even corrupt rows that the Auth API cannot load).
delete from auth.users;

-- 2) Seed the admin (phone 017552223 / password 12345678).
do $$
declare
  v_id    uuid := gen_random_uuid();
  v_email text := '17552223@phone.csms.app';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id,
    'authenticated', 'authenticated', v_email,
    crypt('12345678', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', 'Admin', 'phone', '17552223'),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email),
    'email', now(), now(), now()
  );

  -- handle_new_user() may have created a 'customer' profile already; make sure
  -- the admin row exists and is promoted regardless.
  insert into public.profiles (id, role, name, phone, email)
  values (v_id, 'admin', 'Admin', '17552223', null)
  on conflict (id) do update
    set role  = 'admin',
        name  = 'Admin',
        phone = '17552223',
        email = null;
end $$;
