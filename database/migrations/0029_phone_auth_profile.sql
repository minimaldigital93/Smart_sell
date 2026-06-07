-- 0029_phone_auth_profile.sql
-- Phone-based auth: users sign up/in with a phone number + password. The phone
-- is mapped to a synthetic email (`<digits>@phone.csms.app`) for Supabase auth.
-- Update the new-user trigger to persist the real phone number on the profile
-- and avoid storing the synthetic address in profiles.email.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_phone text := new.raw_user_meta_data->>'phone';
  v_name  text := new.raw_user_meta_data->>'name';
begin
  insert into public.profiles (id, email, phone, name)
  values (
    new.id,
    -- Synthetic phone-login emails are not real addresses; keep email null.
    case when new.email ilike '%@phone.csms.app' then null else new.email end,
    coalesce(v_phone, new.phone),
    coalesce(nullif(v_name, ''), v_phone, split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end $$;
