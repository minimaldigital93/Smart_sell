-- 0001_demo_data.sql
-- Optional demo data for local development. Idempotent on slug.
-- Run AFTER migrations. Insert through service-role key in SQL editor.

insert into public.products (name, slug, description, price, discount_price, category, images, barcode, sku, featured, on_sale, new_arrival, stock)
values
  ('Rosé Hydrating Toner', 'rose-hydrating-toner', 'Soothing rose-infused toner for sensitive skin.', 18.00, 14.50, 'skincare',
   array['https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800'], '8851234500011', 'SKU-TONER-01', true, true, false, 50),

  ('Velvet Matte Lipstick — Nude', 'velvet-matte-lipstick-nude', 'Long-wear matte lipstick in warm nude.', 12.50, null, 'makeup',
   array['https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=800'], '8851234500028', 'SKU-LIP-01', true, false, true, 30),

  ('Silk Touch Eau de Parfum', 'silk-touch-edp', '50ml floral musky perfume.', 45.00, 39.00, 'perfume',
   array['https://images.unsplash.com/photo-1541643600914-78b084683601?w=800'], '8851234500035', 'SKU-PERF-01', true, true, false, 20),

  ('Argan Repair Hair Mask', 'argan-repair-hair-mask', 'Deep-conditioning weekly treatment.', 22.00, null, 'haircare',
   array['https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=800'], '8851234500042', 'SKU-HAIR-01', false, false, true, 25),

  ('Coconut Body Butter', 'coconut-body-butter', 'Whipped body butter, 200g.', 16.00, 12.80, 'bodycare',
   array['https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=800'], '8851234500059', 'SKU-BODY-01', true, true, true, 40)
on conflict (slug) do nothing;

-- Bring product_inventory in line with the seeded stock values
update public.product_inventory pi
   set current_stock = p.stock
  from public.products p
 where pi.product_id = p.id
   and pi.current_stock <> p.stock;

-- Broadcast notification
insert into public.notifications (title, message, type)
values
  ('Welcome to Lumière', 'Discover this week''s best sellers.', 'promo')
on conflict do nothing;
