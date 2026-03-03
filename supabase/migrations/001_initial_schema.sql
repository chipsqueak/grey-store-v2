-- Grey Store v2 Database Schema
-- Run this in Supabase SQL Editor to set up the database

-- ─── Products ────────────────────────────────────────────────────────────────

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  stock_type text not null check (stock_type in ('piece', 'weight')),
  stock_on_hand numeric not null default 0,
  price_per_unit numeric not null default 0,
  price_per_half_kg numeric,
  sack_size_kg numeric,
  sack_price numeric,
  low_stock_threshold numeric not null default 5,
  cost_per_unit numeric,
  category text,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Sales ───────────────────────────────────────────────────────────────────

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  total numeric not null,
  payment_method text not null default 'cash' check (payment_method in ('cash', 'gcash')),
  notes text,
  user_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid not null references products(id),
  product_name text not null,
  quantity numeric not null,
  unit text not null,
  unit_price numeric not null,
  line_total numeric not null
);

-- ─── Inventory Movements ─────────────────────────────────────────────────────

create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  type text not null check (type in ('sale', 'receive', 'adjust', 'count')),
  qty_delta numeric not null,
  notes text,
  user_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- ─── Cash Buckets ────────────────────────────────────────────────────────────

create table if not exists cash_buckets (
  id uuid primary key default gen_random_uuid(),
  bills numeric not null default 0,
  coins numeric not null default 0,
  updated_at timestamptz not null default now()
);

-- ─── Cash Movements ──────────────────────────────────────────────────────────

create table if not exists cash_movements (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('sale', 'expense', 'conversion', 'take_home', 'adjustment')),
  amount numeric not null,
  from_bucket text check (from_bucket in ('bills', 'coins')),
  to_bucket text check (to_bucket in ('bills', 'coins')),
  category text,
  notes text,
  user_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- ─── Daily Closes ────────────────────────────────────────────────────────────

create table if not exists daily_closes (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  counted_bills numeric not null default 0,
  counted_coins numeric not null default 0,
  take_home_amount numeric not null default 0,
  coins_carried_forward numeric not null default 0,
  notes text,
  user_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index if not exists idx_products_name on products(name);
create index if not exists idx_products_category on products(category);
create index if not exists idx_products_is_favorite on products(is_favorite);
create index if not exists idx_sales_created_at on sales(created_at);
create index if not exists idx_sale_items_sale_id on sale_items(sale_id);
create index if not exists idx_inventory_movements_product_id on inventory_movements(product_id);
create index if not exists idx_inventory_movements_created_at on inventory_movements(created_at);
create index if not exists idx_cash_movements_created_at on cash_movements(created_at);
create index if not exists idx_daily_closes_date on daily_closes(date);

-- ─── Row Level Security ──────────────────────────────────────────────────────

alter table products enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table inventory_movements enable row level security;
alter table cash_buckets enable row level security;
alter table cash_movements enable row level security;
alter table daily_closes enable row level security;

-- Allow authenticated users full access (single-store, allowlisted accounts only)
create policy "Authenticated users can read products" on products for select to authenticated using (true);
create policy "Authenticated users can insert products" on products for insert to authenticated with check (true);
create policy "Authenticated users can update products" on products for update to authenticated using (true) with check (true);

create policy "Authenticated users can read sales" on sales for select to authenticated using (true);
create policy "Authenticated users can insert sales" on sales for insert to authenticated with check (true);

create policy "Authenticated users can read sale_items" on sale_items for select to authenticated using (true);
create policy "Authenticated users can insert sale_items" on sale_items for insert to authenticated with check (true);

create policy "Authenticated users can read inventory_movements" on inventory_movements for select to authenticated using (true);
create policy "Authenticated users can insert inventory_movements" on inventory_movements for insert to authenticated with check (true);

create policy "Authenticated users can read cash_buckets" on cash_buckets for select to authenticated using (true);
create policy "Authenticated users can insert cash_buckets" on cash_buckets for insert to authenticated with check (true);
create policy "Authenticated users can update cash_buckets" on cash_buckets for update to authenticated using (true) with check (true);

create policy "Authenticated users can read cash_movements" on cash_movements for select to authenticated using (true);
create policy "Authenticated users can insert cash_movements" on cash_movements for insert to authenticated with check (true);

create policy "Authenticated users can read daily_closes" on daily_closes for select to authenticated using (true);
create policy "Authenticated users can insert daily_closes" on daily_closes for insert to authenticated with check (true);
