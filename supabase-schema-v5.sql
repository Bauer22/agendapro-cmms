-- ═══════════════════════════════════════════════════════════════
-- AgendaPro CMMS v5 — Paradas + MTBF/MTTR
-- Execute no SQL Editor do Supabase
-- ═══════════════════════════════════════════════════════════════

-- DOWNTIME RECORDS
create table if not exists public.downtime_records (
  id           uuid default uuid_generate_v4() primary key,
  machine_id   uuid references public.machines(id) on delete set null,
  machine_name text,
  type         text,
  cause        text not null,
  start_time   timestamptz not null,
  end_time     timestamptz,
  duration_min numeric,
  status       text default 'open' check (status in ('open','closed')),
  description  text,
  resp         text,
  created_by   text,
  created_at   timestamptz default now()
);
alter table public.downtime_records enable row level security;
drop policy if exists "Auth full downtime" on public.downtime_records;
create policy "Auth full downtime" on public.downtime_records using (auth.role() = 'authenticated');

create index if not exists idx_downtime_machine on public.downtime_records(machine_id);
create index if not exists idx_downtime_status on public.downtime_records(status);
create index if not exists idx_downtime_date on public.downtime_records(start_time);

select 'Schema v5 instalado com sucesso! ✅' as resultado;
