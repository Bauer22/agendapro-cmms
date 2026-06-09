-- ═══════════════════════════════════════════════════════════════
-- AgendaPro CMMS v2 — Tabelas Adicionais
-- Execute este script no SQL Editor do Supabase (após o v1)
-- ═══════════════════════════════════════════════════════════════

-- ─── CLIENTES ───────────────────────────────────────────────────
create table if not exists public.clients (
  id           uuid default uuid_generate_v4() primary key,
  razao_social text not null,
  nome_fantasia text,
  cnpj         text,
  telefone     text,
  email        text,
  cidade       text,
  estado       text,
  created_at   timestamptz default now()
);
alter table public.clients enable row level security;
create policy "Authenticated full access clients" on public.clients using (auth.role() = 'authenticated');

-- ─── MOTORISTAS ─────────────────────────────────────────────────
create table if not exists public.drivers (
  id         uuid default uuid_generate_v4() primary key,
  nome       text not null,
  cpf        text,
  telefone   text,
  ativo      boolean default true,
  created_at timestamptz default now()
);
alter table public.drivers enable row level security;
create policy "Authenticated full access drivers" on public.drivers using (auth.role() = 'authenticated');

-- ─── VEÍCULOS ───────────────────────────────────────────────────
create table if not exists public.vehicles (
  id           uuid default uuid_generate_v4() primary key,
  placa        text not null,
  descricao    text,
  tipo         text,
  motorista_id uuid references public.drivers(id) on delete set null,
  ativo        boolean default true,
  created_at   timestamptz default now()
);
alter table public.vehicles enable row level security;
create policy "Authenticated full access vehicles" on public.vehicles using (auth.role() = 'authenticated');

-- ─── CENTROS DE CUSTO ───────────────────────────────────────────
create table if not exists public.cost_centers (
  id         uuid default uuid_generate_v4() primary key,
  codigo     text,
  descricao  text not null,
  grupo      text,
  active     boolean default true,
  created_at timestamptz default now()
);
alter table public.cost_centers enable row level security;
create policy "Authenticated full access cost_centers" on public.cost_centers using (auth.role() = 'authenticated');

-- Inserir centros padrão
insert into public.cost_centers (codigo, descricao, grupo) values
  ('CC-001','Manutenção Mecânica','Manutenção'),
  ('CC-002','Manutenção Elétrica','Manutenção'),
  ('CC-003','Combustível','Operacional'),
  ('CC-004','Madeira/Matéria-Prima','Produção'),
  ('CC-005','Mão de Obra','RH'),
  ('CC-006','Administrativo','Administração')
on conflict do nothing;

-- ─── CONTAS A PAGAR ─────────────────────────────────────────────
create table if not exists public.accounts_payable (
  id               uuid default uuid_generate_v4() primary key,
  fornecedor_id    uuid references public.suppliers(id) on delete set null,
  centro_custo_id  uuid references public.cost_centers(id) on delete set null,
  numero_documento text,
  data_emissao     date,
  due_date         date,
  data_recebimento date,
  valor            numeric not null,
  status           text default 'pending' check (status in ('pending','paid','overdue','cancelled')),
  observacao       text,
  xml_url          text,
  created_by       text,
  created_at       timestamptz default now()
);
alter table public.accounts_payable enable row level security;
create policy "Authenticated full access accounts" on public.accounts_payable using (auth.role() = 'authenticated');

-- ─── PÁTIO DE TORAS ─────────────────────────────────────────────
create table if not exists public.wood_entries (
  id             uuid default uuid_generate_v4() primary key,
  data_entrada   date not null,
  fornecedor_id  uuid references public.suppliers(id) on delete set null,
  motorista_id   uuid references public.drivers(id) on delete set null,
  veiculo_id     uuid references public.vehicles(id) on delete set null,
  classe         text,
  peso_liquido   numeric,
  altura_media   numeric,
  comprimento    numeric,
  largura        numeric,
  volume_estereo numeric,
  peso_estimado  numeric,
  observacao     text,
  created_by     text,
  created_at     timestamptz default now()
);
alter table public.wood_entries enable row level security;
create policy "Authenticated full access wood" on public.wood_entries using (auth.role() = 'authenticated');

-- ─── COMBUSTÍVEL ENTRADAS ───────────────────────────────────────
create table if not exists public.fuel_entries (
  id            uuid default uuid_generate_v4() primary key,
  fornecedor_id uuid references public.suppliers(id) on delete set null,
  litros        numeric not null,
  valor_litro   numeric,
  valor_total   numeric,
  vencimento    date,
  created_at    timestamptz default now()
);
alter table public.fuel_entries enable row level security;
create policy "Authenticated full access fuel_in" on public.fuel_entries using (auth.role() = 'authenticated');

-- ─── COMBUSTÍVEL SAÍDAS ─────────────────────────────────────────
create table if not exists public.fuel_outputs (
  id                  uuid default uuid_generate_v4() primary key,
  motorista_id        uuid references public.drivers(id) on delete set null,
  veiculo_id          uuid references public.vehicles(id) on delete set null,
  litros              numeric not null,
  data_abastecimento  date,
  observacao          text,
  created_at          timestamptz default now()
);
alter table public.fuel_outputs enable row level security;
create policy "Authenticated full access fuel_out" on public.fuel_outputs using (auth.role() = 'authenticated');

-- ─── CARREGAMENTOS CHIPS ────────────────────────────────────────
create table if not exists public.chip_loads (
  id               uuid default uuid_generate_v4() primary key,
  tipo_produto     text,
  cliente_id       uuid references public.clients(id) on delete set null,
  transportador_id uuid,
  motorista_id     uuid references public.drivers(id) on delete set null,
  veiculo_id       uuid references public.vehicles(id) on delete set null,
  peso             numeric,
  valor_tonelada   numeric,
  valor_total      numeric,
  data_saida       date,
  created_at       timestamptz default now()
);
alter table public.chip_loads enable row level security;
create policy "Authenticated full access chip_loads" on public.chip_loads using (auth.role() = 'authenticated');

-- ─── CARREGAMENTOS LÂMINAS ──────────────────────────────────────
create table if not exists public.veneer_loads (
  id               uuid default uuid_generate_v4() primary key,
  cliente_id       uuid references public.clients(id) on delete set null,
  motorista_id     uuid references public.drivers(id) on delete set null,
  veiculo_id       uuid references public.vehicles(id) on delete set null,
  bitola           numeric,
  quantidade_folhas integer,
  comprimento      numeric,
  largura          numeric,
  metros_cubicos   numeric,
  valor_m3         numeric,
  valor_total      numeric,
  data_saida       date,
  created_at       timestamptz default now()
);
alter table public.veneer_loads enable row level security;
create policy "Authenticated full access veneer_loads" on public.veneer_loads using (auth.role() = 'authenticated');

-- ─── ÍNDICES DE PERFORMANCE ─────────────────────────────────────
create index if not exists idx_accounts_due_date on public.accounts_payable(due_date);
create index if not exists idx_accounts_status on public.accounts_payable(status);
create index if not exists idx_wood_entries_data on public.wood_entries(data_entrada);
create index if not exists idx_veneer_loads_data on public.veneer_loads(data_saida);
create index if not exists idx_chip_loads_data on public.chip_loads(data_saida);
create index if not exists idx_fuel_entries_date on public.fuel_entries(created_at);
create index if not exists idx_fuel_outputs_date on public.fuel_outputs(data_abastecimento);

-- Adicionar campos de endereço para suppliers (se não existirem)
alter table public.suppliers add column if not exists razao_social text;
alter table public.suppliers add column if not exists nome_fantasia text;
alter table public.suppliers add column if not exists estado text;

select 'Schema v2 instalado com sucesso! ✅' as resultado;
