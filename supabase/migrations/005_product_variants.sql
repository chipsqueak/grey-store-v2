-- Product Variants
-- Supports named size/weight variants per product (e.g. S/M/L for accessories,
-- 1/4 sack / 1/2 sack for poultry feeds).

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,           -- e.g. "Small", "Medium", "Large", "1/4 Sack"
  price numeric not null,       -- selling price for this variant
  cost numeric,                 -- optional cost for this variant
  weight_kg numeric,            -- for weight products: kg deducted from stock per unit sold
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_variants_product_id on product_variants(product_id);

alter table product_variants enable row level security;

create policy "Authenticated users can read product_variants"
  on product_variants for select to authenticated using (true);

create policy "Authenticated users can insert product_variants"
  on product_variants for insert to authenticated with check (true);

create policy "Authenticated users can update product_variants"
  on product_variants for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete product_variants"
  on product_variants for delete to authenticated using (true);
