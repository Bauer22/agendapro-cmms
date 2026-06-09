-- ═══════════════════════════════════════════════════════════════
-- AgendaPro CMMS v3 — Tabelas: Pedidos de Compra + Movimentos Estoque
-- Execute no SQL Editor do Supabase
-- ═══════════════════════════════════════════════════════════════

-- ─── PEDIDOS DE COMPRA ──────────────────────────────────────────
create table if not exists public.purchase_orders (
  id             uuid default uuid_generate_v4() primary key,
  part_id        uuid references public.parts(id) on delete set null,
  part_name      text,
  part_code      text,
  supplier_id    uuid references public.suppliers(id) on delete set null,
  quantity       numeric not null,
  unit_value     numeric,
  total_value    numeric,
  status         text default 'pending' check (status in ('pending','approved','ordered','received','cancelled')),
  date_requested date,
  date_expected  date,
  date_received  date,
  notes          text,
  os_id          uuid references public.work_orders(id) on delete set null,
  created_by     text,
  created_at     timestamptz default now()
);
alter table public.purchase_orders enable row level security;
create policy "Authenticated full access po" on public.purchase_orders using (auth.role() = 'authenticated');

-- ─── MOVIMENTOS DE ESTOQUE ──────────────────────────────────────
create table if not exists public.stock_movements (
  id          uuid default uuid_generate_v4() primary key,
  part_id     uuid references public.parts(id) on delete set null,
  part_name   text,
  part_code   text,
  type        text check (type in ('in','out','adjust')),
  quantity    numeric not null,
  stock_after numeric,
  reason      text,
  os_id       uuid references public.work_orders(id) on delete set null,
  po_id       uuid references public.purchase_orders(id) on delete set null,
  date        date,
  created_by  text,
  created_at  timestamptz default now()
);
alter table public.stock_movements enable row level security;
create policy "Authenticated full access stock_mov" on public.stock_movements using (auth.role() = 'authenticated');

-- ─── ADD STATUS + CLOSE_DATE TO MAINTENANCE ─────────────────────
alter table public.maintenance add column if not exists status text default 'open' check (status in ('open','progress','done'));
alter table public.maintenance add column if not exists close_date date;

-- Update existing records without status
update public.maintenance set status = 'done' where result = 'ok' and status is null;
update public.maintenance set status = 'open' where status is null;

-- ─── INDICES ────────────────────────────────────────────────────
create index if not exists idx_po_status on public.purchase_orders(status);
create index if not exists idx_po_part on public.purchase_orders(part_id);
create index if not exists idx_stock_mov_part on public.stock_movements(part_id);
create index if not exists idx_stock_mov_date on public.stock_movements(created_at);
create index if not exists idx_maint_status on public.maintenance(status);

select 'Schema v3 instalado com sucesso! ✅' as resultado;
