-- ═══════════════════════════════════════════════════════════════
-- AgendaPro CMMS v4 — Tabela Repair Orders + PM Status
-- Execute no SQL Editor do Supabase
-- ═══════════════════════════════════════════════════════════════

-- ─── ADD PM_STATUS + CLOSE_DATE TO PM_REPORTS ───────────────────
alter table public.pm_reports add column if not exists pm_status text default 'open' check (pm_status in ('open','progress','done'));
alter table public.pm_reports add column if not exists close_date date;

-- Update existing records
update public.pm_reports set pm_status = 'done' where status = 'ok' and pm_status is null;
update public.pm_reports set pm_status = 'open' where pm_status is null;

-- ─── REPAIR ORDERS ──────────────────────────────────────────────
create table if not exists public.repair_orders (
  id            uuid default uuid_generate_v4() primary key,
  machine_id    uuid references public.machines(id) on delete set null,
  machine_name  text,
  item_name     text not null,
  description   text not null,
  status        text default 'open' check (status in ('open','sent','returned','done')),
  supplier_name text,
  cost          numeric,
  created_date  date,
  sent_date     date,
  return_date   date,
  solution      text,
  parts_list    jsonb default '[]',
  created_by    text,
  created_at    timestamptz default now()
);
alter table public.repair_orders enable row level security;
create policy "Authenticated full access repair" on public.repair_orders using (auth.role() = 'authenticated');

-- Índices
create index if not exists idx_repair_status on public.repair_orders(status);
create index if not exists idx_pm_pm_status on public.pm_reports(pm_status);

select 'Schema v4 instalado com sucesso! ✅' as resultado;
