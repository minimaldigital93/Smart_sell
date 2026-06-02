-- 0021_drop_old_apply_inventory_movement.sql
-- Migration 0017 added a 7-arg overload of apply_inventory_movement (with
-- p_barcode_image_url). Because `create or replace function` only replaces a
-- function when the argument signature matches exactly, the original 6-arg
-- version from migration 0007 was left in place as a second overload.
--
-- Both overloads default all trailing args to NULL, so a 6-arg call (e.g. from
-- apply_order_inventory → on_order_status_change) is ambiguous and Postgres
-- raises:
--   function public.apply_inventory_movement(uuid, movement_type, integer,
--     text, uuid, uuid) is not unique
-- which blocks the admin from advancing an order to "payment_confirmed".
--
-- Drop the stale 6-arg overload so the 7-arg version from 0017 is the only one.

drop function if exists public.apply_inventory_movement(
  uuid,
  public.movement_type,
  integer,
  text,
  uuid,
  uuid
);
