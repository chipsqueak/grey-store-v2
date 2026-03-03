-- ─── Categories ──────────────────────────────────────────────────────────────

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null default '🏷️',
  color text not null default 'bg-gray-100 text-gray-700',
  created_at timestamptz not null default now()
);

-- Add category_ids array column to products
alter table products add column if not exists category_ids text[] not null default '{}';

create index if not exists idx_categories_name on categories(name);

-- RLS
alter table categories enable row level security;

create policy "Authenticated users can read categories" on categories
  for select to authenticated using (true);

create policy "Authenticated users can insert categories" on categories
  for insert to authenticated with check (true);

create policy "Authenticated users can update categories" on categories
  for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete categories" on categories
  for delete to authenticated using (true);
