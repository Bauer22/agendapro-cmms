-- ═══════════════════════════════════════════════════════════════
-- AgendaPro CMMS — Supabase Schema
-- Execute este script no SQL Editor do Supabase
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── PROFILES (extends auth.users) ─────────────────────────────
create table if not exists public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text,
  display_name text,
  role        text default 'operator' check (role in ('admin','supervisor','operator','viewer')),
  shift       text,
  sector      text,
  code        text,
  blocked     boolean default false,
  created_at  timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Users can read all profiles" on public.profiles for select using (auth.role() = 'authenticated');
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Admins can do all on profiles" on public.profiles using (
  (select role from public.profiles where id = auth.uid()) = 'admin'
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    case when (select count(*) from public.profiles) = 0 then 'admin' else 'operator' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── CONFIG ─────────────────────────────────────────────────────
create table if not exists public.config (
  id         text primary key,
  name       text,
  sector     text,
  logo       text,
  updated_at timestamptz default now()
);
alter table public.config enable row level security;
create policy "Authenticated can read config" on public.config for select using (auth.role() = 'authenticated');
create policy "Authenticated can write config" on public.config for all using (auth.role() = 'authenticated');

-- ─── MACHINES ───────────────────────────────────────────────────
create table if not exists public.machines (
  id              uuid default uuid_generate_v4() primary key,
  code            text,
  name            text not null,
  sector          text,
  category        text default 'production',
  brand           text,
  model           text,
  year            integer,
  serial          text,
  location        text,
  power           text,
  icon            text default '⚙️',
  notes           text,
  current_hours   numeric default 0,
  oil_interval    numeric,
  last_oil_hours  numeric default 0,
  last_oil_date   date,
  components      jsonb default '[]',
  parts           jsonb default '[]',
  pm_plan         jsonb default '[]',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table public.machines enable row level security;
create policy "Authenticated full access machines" on public.machines using (auth.role() = 'authenticated');

-- ─── WORK ORDERS (OS) ───────────────────────────────────────────
create table if not exists public.work_orders (
  id           uuid default uuid_generate_v4() primary key,
  number       text,
  title        text not null,
  description  text,
  machine_id   uuid references public.machines(id) on delete set null,
  machine_name text,
  machine_code text,
  resp_id      uuid references public.profiles(id) on delete set null,
  resp_name    text,
  sector       text,
  type         text,
  priority     text default 'medium' check (priority in ('low','medium','high','critical')),
  status       text default 'open' check (status in ('open','progress','done','cancelled')),
  open_date    date,
  due_date     date,
  close_date   date,
  est_hours    numeric,
  actual_hours numeric,
  parts_used   text,
  solution     text,
  cost         numeric,
  created_by   text,
  created_at   timestamptz default now()
);
alter table public.work_orders enable row level security;
create policy "Authenticated full access OS" on public.work_orders using (auth.role() = 'authenticated');

-- OS Counter
create table if not exists public.os_counter (
  id   integer primary key default 1,
  val  integer default 0
);
alter table public.os_counter enable row level security;
create policy "Authenticated full access counter" on public.os_counter using (auth.role() = 'authenticated');
insert into public.os_counter (id, val) values (1, 0) on conflict do nothing;

-- ─── MAINTENANCE ────────────────────────────────────────────────
create table if not exists public.maintenance (
  id           uuid default uuid_generate_v4() primary key,
  machine_id   uuid references public.machines(id) on delete set null,
  machine_name text,
  type         text not null,
  resp         text not null,
  date         date not null,
  duration     numeric,
  parts        text,
  description  text,
  result       text default 'ok',
  pm_task      text,
  cost         numeric,
  created_by   text,
  created_at   timestamptz default now()
);
alter table public.maintenance enable row level security;
create policy "Authenticated full access maint" on public.maintenance using (auth.role() = 'authenticated');

-- ─── PM REPORTS ─────────────────────────────────────────────────
create table if not exists public.pm_reports (
  id              uuid default uuid_generate_v4() primary key,
  machine_id      uuid references public.machines(id) on delete set null,
  machine_name    text,
  operator        text not null,
  period          text not null,
  date            date not null,
  hours_reading   numeric,
  checklist       jsonb default '{}',
  notes           text,
  status          text default 'ok',
  signature       text,
  created_by      text,
  created_at      timestamptz default now()
);
alter table public.pm_reports enable row level security;
create policy "Authenticated full access pm" on public.pm_reports using (auth.role() = 'authenticated');

-- ─── TASKS ──────────────────────────────────────────────────────
create table if not exists public.tasks (
  id          uuid default uuid_generate_v4() primary key,
  title       text not null,
  date        date not null,
  time        text,
  priority    text default 'medium',
  owner_id    uuid references public.profiles(id) on delete set null,
  owner_name  text,
  notes       text,
  done        boolean default false,
  created_by  text,
  created_at  timestamptz default now()
);
alter table public.tasks enable row level security;
create policy "Authenticated full access tasks" on public.tasks using (auth.role() = 'authenticated');

-- ─── PARTS ──────────────────────────────────────────────────────
create table if not exists public.parts (
  id          uuid default uuid_generate_v4() primary key,
  code        text not null,
  name        text not null,
  category    text,
  unit        text default 'un',
  stock       numeric default 0,
  min_stock   numeric default 1,
  unit_value  numeric,
  location    text,
  supplier    text,
  created_at  timestamptz default now()
);
alter table public.parts enable row level security;
create policy "Authenticated full access parts" on public.parts using (auth.role() = 'authenticated');

-- ─── SUPPLIERS ──────────────────────────────────────────────────
create table if not exists public.suppliers (
  id         uuid default uuid_generate_v4() primary key,
  name       text not null,
  cnpj       text,
  phone      text,
  whatsapp   text,
  email      text,
  city       text,
  created_at timestamptz default now()
);
alter table public.suppliers enable row level security;
create policy "Authenticated full access suppliers" on public.suppliers using (auth.role() = 'authenticated');

-- ─── ACCESS LOGS ────────────────────────────────────────────────
create table if not exists public.access_logs (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid,
  email      text,
  name       text,
  role       text,
  action     text,
  created_at timestamptz default now()
);
alter table public.access_logs enable row level security;
create policy "Authenticated can insert logs" on public.access_logs for insert with check (auth.role() = 'authenticated');
create policy "Admins can read logs" on public.access_logs for select using (
  (select role from public.profiles where id = auth.uid()) = 'admin'
);

select 'Schema instalado com sucesso! ✅' as resultado;
