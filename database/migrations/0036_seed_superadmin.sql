-- 0036_seed_superadmin.sql
-- Seed the platform owner (superadmin). Runs as its own migration so the
-- 'superadmin' enum value added in 0033 is already committed and safe to use.
--
-- Credentials (CHANGE THESE after first login):
--   phone:    010552223   (normalizes to 10552223 -> 10552223@phone.csms.app)
--   password: 12345678
--
-- The superadmin has store_id = NULL and sits above every store.

create extension if not exists pgcrypto;

do $$
declare
  v_id    uuid := gen_random_uuid();
  v_email text := '10552223@phone.csms.app';
begin
  -- Skip if this superadmin email already exists.
  if exists (select 1 from auth.users where email = v_email) then
    return;
  end if;

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
    jsonb_build_object('name', 'Super Admin', 'phone', '10552223'),
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

  -- handle_new_user() may have created a 'customer' profile; promote it.
  insert into public.profiles (id, role, name, phone, email, store_id)
  values (v_id, 'superadmin', 'Super Admin', '10552223', null, null)
  on conflict (id) do update
    set role     = 'superadmin',
        name     = 'Super Admin',
        phone    = '10552223',
        store_id = null;
end $$;
