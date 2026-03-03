-- Add track_inventory column to products
-- When false, the product has no stock monitoring (can be sold indefinitely)
alter table products
  add column if not exists track_inventory boolean not null default true;
