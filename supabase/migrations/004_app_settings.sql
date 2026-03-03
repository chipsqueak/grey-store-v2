-- ─── App Settings ────────────────────────────────────────────────────────────
-- Singleton table for global settings shared across all users and devices.
-- Enforced to have exactly one row via a boolean primary key constrained to true.

create table if not exists app_settings (
  id boolean primary key default true check (id = true),
  inventory_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Insert default row (inventory enabled by default)
insert into app_settings (id, inventory_enabled)
values (true, true)
on conflict (id) do nothing;

-- RLS
alter table app_settings enable row level security;

create policy "Authenticated users can read app_settings" on app_settings
  for select to authenticated using (true);

create policy "Authenticated users can insert app_settings" on app_settings
  for insert to authenticated with check (true);

create policy "Authenticated users can update app_settings" on app_settings
  for update to authenticated using (true) with check (true);
