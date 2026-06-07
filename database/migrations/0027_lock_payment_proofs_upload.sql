-- 0027_lock_payment_proofs_upload.sql
--
-- Audit finding #8: anyone (anon) could upload to the payment-proofs bucket via
-- a direct storage API call with the public anon key, bypassing the order
-- action's rate limit — a free way to dump 5 MB files and run up storage.
--
-- The app now writes payment screenshots through the SERVICE-ROLE client
-- (src/lib/supabase/service.ts), which bypasses RLS. So we can drop the
-- "anyone can insert" policy entirely: legitimate uploads go through the
-- service role, and no anon/authenticated client can write to this bucket.
--
-- PREREQUISITE: SUPABASE_SERVICE_ROLE_KEY must be set in the app environment
-- (already present in .env.example). Apply this AFTER deploying the app change,
-- or guest-checkout uploads will fail.

drop policy if exists "payment_proofs_insert_anyone" on storage.objects;

-- No INSERT policy for anon/authenticated remains on payment-proofs. The
-- service-role client bypasses RLS, so server-side uploads still work; staff
-- moderation (delete/replace) continues via payment_proofs_modify_staff.
