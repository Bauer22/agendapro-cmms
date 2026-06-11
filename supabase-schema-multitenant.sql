-- ═══════════════════════════════════════════════════════════════
-- AgendaPro CMMS — Multi-Tenant Schema
-- ATENÇÃO: Execute este script em um projeto Supabase NOVO e limpo
-- Substitui todos os schemas anteriores
-- ═══════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ─── COMPANIES (Empresas clientes) ──────────────────────────────
create table if not exists public.companies (
  id           uuid default uuid_generate_v4() primary key,
  name         text not null,
  slug         text unique not null, -- URL-friendly name: "laminadora-abc"
  cnpj         text,
  phone        text,
  email        text,
  plan         text default 'basic' check (plan in ('trial','basic','pro','enterprise')),
  plan_expires date,
  active       boolean default true,
  logo_url     text,
  created_at   timestamptz default now()
);
alter table public.companies enable row level security;
-- Only super admin can see all companies
create policy "Super admin sees all companies" on public.companies
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin')
  );
-- Company members see own company
create policy "Members see own company" on public.companies
  for select using (
    id in (select company_id from public.profiles where id = auth.uid())
  );

-- ─── PROFILES (with company_id) ─────────────────────────────────
create table if not exists public.profiles (
  id           uuid references auth.users(id) on delete cascade primary key,
  company_id   uuid references public.companies(id) on delete cascade,
  email        text,
  display_name text,
  role         text default 'operator' check (role in ('superadmin','admin','supervisor','operator','viewer')),
  shift        text,
  sector       text,
  code         text,
  blocked      boolean default false,
  created_at   timestamptz default now()
);
alter table public.profiles enable row level security;
-- Users see only profiles from same company
create policy "Users see company profiles" on public.profiles
  for select using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    or role = 'superadmin'
  );
create policy "Admins manage company profiles" on public.profiles
  for all using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) in ('superadmin','admin')
  );
create policy "Users update own profile" on public.profiles
  for update using (id = auth.uid());

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  v_company_id uuid;
  v_role text;
  v_name text;
begin
  -- Get company from metadata (set during invite)
  v_company_id := (new.raw_user_meta_data->>'company_id')::uuid;
  v_role := coalesce(new.raw_user_meta_data->>'role', 'operator');
  v_name := coalesce(
    new.raw_user_meta_data->>'display_name',
    split_part(new.email,'@',1)
  );
  -- First user of a company = admin
  if v_company_id is not null then
    if not exists (select 1 from public.profiles where company_id = v_company_id) then
      v_role := 'admin';
    end if;
  end if;
  insert into public.profiles (id, company_id, email, display_name, role)
  values (new.id, v_company_id, new.email, v_name, v_role)
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── HELPER FUNCTION ────────────────────────────────────────────
-- Returns company_id of current user
create or replace function public.my_company_id()
returns uuid language sql security definer stable as $$
  select company_id from public.profiles where id = auth.uid()
$$;

-- ─── CONFIG ─────────────────────────────────────────────────────
create table if not exists public.config (
  id         text,
  company_id uuid references public.companies(id) on delete cascade,
  name       text,
  sector     text,
  logo       text,
  updated_at timestamptz default now(),
  primary key (id, company_id)
);
alter table public.config enable row level security;
create policy "Company config" on public.config
  for all using (company_id = public.my_company_id());

-- ─── MACHINES ───────────────────────────────────────────────────
create table if not exists public.machines (
  id              uuid default uuid_generate_v4() primary key,
  company_id      uuid references public.companies(id) on delete cascade not null,
  code            text, name text not null, sector text, category text default 'production',
  brand text, model text, year integer, serial text, location text, power text,
  icon text default '⚙️', notes text,
  current_hours   numeric default 0, oil_interval numeric,
  last_oil_hours  numeric default 0, last_oil_date date,
  components      jsonb default '[]', parts jsonb default '[]', pm_plan jsonb default '[]',
  created_at      timestamptz default now(), updated_at timestamptz default now()
);
alter table public.machines enable row level security;
create policy "Company machines" on public.machines
  for all using (company_id = public.my_company_id());

-- ─── WORK ORDERS ────────────────────────────────────────────────
create table if not exists public.work_orders (
  id           uuid default uuid_generate_v4() primary key,
  company_id   uuid references public.companies(id) on delete cascade not null,
  number text, title text not null, description text,
  machine_id uuid, machine_name text, machine_code text,
  resp_id uuid, resp_name text, sector text, type text,
  priority text default 'medium', status text default 'open',
  open_date date, due_date date, close_date date,
  est_hours numeric, actual_hours numeric,
  parts_used text, solution text, cost numeric,
  created_by text, created_at timestamptz default now()
);
alter table public.work_orders enable row level security;
create policy "Company work_orders" on public.work_orders
  for all using (company_id = public.my_company_id());

-- OS Counter per company
create table if not exists public.os_counter (
  company_id uuid references public.companies(id) on delete cascade,
  val integer default 0,
  primary key (company_id)
);
alter table public.os_counter enable row level security;
create policy "Company os_counter" on public.os_counter
  for all using (company_id = public.my_company_id());

-- ─── MAINTENANCE ────────────────────────────────────────────────
create table if not exists public.maintenance (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  machine_id uuid, machine_name text, type text not null, resp text not null,
  date date not null, duration numeric, parts text, description text,
  result text default 'ok', pm_task text, cost numeric,
  status text default 'open', close_date date,
  created_by text, created_at timestamptz default now()
);
alter table public.maintenance enable row level security;
create policy "Company maintenance" on public.maintenance
  for all using (company_id = public.my_company_id());

-- ─── PM REPORTS ─────────────────────────────────────────────────
create table if not exists public.pm_reports (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  machine_id uuid, machine_name text, operator text not null, operator_id uuid,
  period text not null, date date not null, hours_reading numeric,
  checklist jsonb default '{}', notes text, status text default 'ok',
  pm_status text default 'open', close_date date,
  created_by text, created_at timestamptz default now()
);
alter table public.pm_reports enable row level security;
create policy "Company pm_reports" on public.pm_reports
  for all using (company_id = public.my_company_id());

-- ─── REPAIR ORDERS ──────────────────────────────────────────────
create table if not exists public.repair_orders (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  machine_id uuid, machine_name text, item_name text not null,
  description text not null, status text default 'open',
  supplier_name text, cost numeric, created_date date,
  sent_date date, return_date date, solution text,
  parts_list jsonb default '[]', operator text, operator_id uuid,
  created_by text, created_at timestamptz default now()
);
alter table public.repair_orders enable row level security;
create policy "Company repair_orders" on public.repair_orders
  for all using (company_id = public.my_company_id());

-- ─── TASKS ──────────────────────────────────────────────────────
create table if not exists public.tasks (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  title text not null, date date not null, time text, priority text default 'medium',
  owner_id uuid, owner_name text, notes text, done boolean default false,
  created_by text, created_at timestamptz default now()
);
alter table public.tasks enable row level security;
create policy "Company tasks" on public.tasks
  for all using (company_id = public.my_company_id());

-- ─── PARTS ──────────────────────────────────────────────────────
create table if not exists public.parts (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  code text not null, name text not null, category text, unit text default 'un',
  stock numeric default 0, min_stock numeric default 1,
  unit_value numeric, location text, supplier text,
  created_at timestamptz default now()
);
alter table public.parts enable row level security;
create policy "Company parts" on public.parts
  for all using (company_id = public.my_company_id());

-- ─── PURCHASE ORDERS ────────────────────────────────────────────
create table if not exists public.purchase_orders (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  part_id uuid, part_name text, part_code text,
  supplier_id uuid, quantity numeric not null, unit_value numeric,
  status text default 'pending', date_requested date, date_expected date,
  notes text, created_by text, created_at timestamptz default now()
);
alter table public.purchase_orders enable row level security;
create policy "Company purchase_orders" on public.purchase_orders
  for all using (company_id = public.my_company_id());

-- ─── STOCK MOVEMENTS ────────────────────────────────────────────
create table if not exists public.stock_movements (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  part_id uuid, part_name text, part_code text,
  type text, quantity numeric not null, stock_after numeric,
  reason text, os_id uuid, date date,
  created_by text, created_at timestamptz default now()
);
alter table public.stock_movements enable row level security;
create policy "Company stock_movements" on public.stock_movements
  for all using (company_id = public.my_company_id());

-- ─── SUPPLIERS ──────────────────────────────────────────────────
create table if not exists public.suppliers (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  name text, razao_social text, cnpj text,
  phone text, whatsapp text, email text, city text,
  created_at timestamptz default now()
);
alter table public.suppliers enable row level security;
create policy "Company suppliers" on public.suppliers
  for all using (company_id = public.my_company_id());

-- ─── DOWNTIME RECORDS ───────────────────────────────────────────
create table if not exists public.downtime_records (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade not null,
  machine_id uuid, machine_name text, type text, cause text not null,
  start_time timestamptz not null, end_time timestamptz,
  duration_min numeric, status text default 'open',
  description text, resp text,
  created_by text, created_at timestamptz default now()
);
alter table public.downtime_records enable row level security;
create policy "Company downtime" on public.downtime_records
  for all using (company_id = public.my_company_id());

-- ─── ACCESS LOGS ────────────────────────────────────────────────
create table if not exists public.access_logs (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references public.companies(id) on delete cascade,
  user_id uuid, email text, name text, role text, action text,
  created_at timestamptz default now()
);
alter table public.access_logs enable row level security;
create policy "Company logs" on public.access_logs
  for all using (company_id = public.my_company_id());

-- ─── INDICES ────────────────────────────────────────────────────
create index if not exists idx_profiles_company on public.profiles(company_id);
create index if not exists idx_machines_company on public.machines(company_id);
create index if not exists idx_work_orders_company on public.work_orders(company_id);
create index if not exists idx_maintenance_company on public.maintenance(company_id);
create index if not exists idx_parts_company on public.parts(company_id);
create index if not exists idx_tasks_company on public.tasks(company_id);
create index if not exists idx_downtime_company on public.downtime_records(company_id);

select 'Multi-tenant schema instalado! ✅' as resultado;
