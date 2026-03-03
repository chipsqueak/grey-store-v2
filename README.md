# Grey Store v2

A mobile-first POS + Inventory + Cash Management web app for a pet supply store, built with React + TypeScript + Supabase.

## Features

- **POS Checkout** — Fast checkout with 0.5kg / 1kg / sack buttons for weight-based items, stock protection to prevent overselling
- **Product Catalog** — Support for piece-tracked and weight-tracked items with sack pricing
- **Inventory Management** — Receive stock, physical counts with variance tracking, full audit trail
- **Cash Management** — Bills/coins buckets, expenses, bill→coin conversion, take-home tracking
- **Daily Close** — End-of-day reconciliation with coins carry-forward
- **Sales Reports** — Daily/weekly/monthly totals, top-selling products
- **PWA** — Installable on iPhone + Android, mobile-first design

## Tech Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS 4 + Vite
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Hosting**: Cloudflare Pages (free tier)

## Getting Started

### 1. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the SQL migration in `supabase/migrations/001_initial_schema.sql` in the Supabase SQL Editor
3. Create user accounts in Supabase Auth (Dashboard → Authentication → Users)

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your Supabase URL and anon key from the Supabase dashboard.

### 3. Install and run

```bash
npm install
npm run dev
```

### 4. Build for production

```bash
npm run build
```

Deploy the `dist/` folder to Cloudflare Pages.

## Project Structure

```
src/
  components/layout/   # App shell, navigation
  hooks/               # Auth hook
  lib/                 # Supabase client, API functions, utilities
  pages/               # POS, Products, Inventory, Cash, Reports
  types/               # TypeScript interfaces
supabase/
  migrations/          # Database schema SQL
public/
  manifest.json        # PWA manifest
  sw.js                # Service worker
```

## Security

- Supabase Row-Level Security (RLS) ensures only authenticated users can access data
- No public signup — users must be manually created in Supabase Auth dashboard
- All data access goes through Supabase with the anon key + JWT auth
