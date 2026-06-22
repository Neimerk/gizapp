-- ============================================================
-- BrasUX — Migração 003: Fluxo do Entregador
-- Execute no Supabase Dashboard → SQL Editor
-- Dependência: migration-001.sql e migration-002.sql já executados
-- ============================================================

-- ── 1. Helper: verifica se usuário é entregador ───────────────
create or replace function is_courier()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'courier'
  );
$$ language sql security definer;

-- ── 2. DELIVERIES ─────────────────────────────────────────────
-- Criada ANTES da policy que a referencia.
create table if not exists deliveries (
  id           uuid default gen_random_uuid() primary key,
  order_id     uuid references orders(id) on delete cascade not null unique,
  courier_id   uuid references profiles(id) on delete set null not null,
  status       text not null default 'ACCEPTED'
               check (status in ('ACCEPTED', 'PICKED_UP', 'DELIVERED', 'CANCELLED')),
  earnings     numeric(10,2) not null default 0,
  accepted_at  timestamptz default now() not null,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  created_at   timestamptz default now() not null,
  updated_at   timestamptz default now() not null
);

create trigger deliveries_updated_at before update on deliveries
  for each row execute function update_updated_at();

create index if not exists idx_deliveries_courier_id on deliveries(courier_id);
create index if not exists idx_deliveries_status     on deliveries(status);

-- ── 3. Demais tabelas ─────────────────────────────────────────

create table if not exists courier_locations (
  courier_id uuid references profiles(id) on delete cascade primary key,
  lat        numeric(10, 7) not null,
  lng        numeric(10, 7) not null,
  heading    numeric(5, 2),
  updated_at timestamptz default now() not null
);

create table if not exists courier_earnings (
  id          uuid default gen_random_uuid() primary key,
  courier_id  uuid references profiles(id) on delete cascade not null,
  delivery_id uuid references deliveries(id) on delete set null,
  amount      numeric(10, 2) not null,
  description text not null,
  created_at  timestamptz default now() not null
);

create index if not exists idx_courier_earnings_courier_id on courier_earnings(courier_id);

create table if not exists courier_withdrawals (
  id         uuid default gen_random_uuid() primary key,
  courier_id uuid references profiles(id) on delete cascade not null,
  amount     numeric(10, 2) not null check (amount > 0),
  pix_key    text not null,
  status     text not null default 'PENDING'
             check (status in ('PENDING', 'PAID', 'REJECTED')),
  note       text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create trigger courier_withdrawals_updated_at before update on courier_withdrawals
  for each row execute function update_updated_at();

-- ── 4. Policy para entregadores verem pedidos disponíveis ─────
-- Só criada AGORA, depois que deliveries existe.
create policy "orders_courier_view" on orders
  for select using (
    is_courier()
    and (
      status = 2
      or exists (
        select 1 from deliveries
        where deliveries.order_id = orders.id
          and deliveries.courier_id = auth.uid()
      )
    )
  );

-- ── 5. RLS ────────────────────────────────────────────────────

alter table deliveries          enable row level security;
alter table courier_locations   enable row level security;
alter table courier_earnings    enable row level security;
alter table courier_withdrawals enable row level security;

-- DELIVERIES
create policy "deliveries_select" on deliveries
  for select using (courier_id = auth.uid() or is_admin());

create policy "deliveries_insert" on deliveries
  for insert with check (auth.uid() = courier_id and is_courier());

create policy "deliveries_update" on deliveries
  for update using (courier_id = auth.uid() or is_admin());

-- COURIER_LOCATIONS
create policy "locations_all" on courier_locations
  for all using (courier_id = auth.uid() or is_admin());

-- COURIER_EARNINGS
create policy "earnings_select" on courier_earnings
  for select using (courier_id = auth.uid() or is_admin());

create policy "earnings_insert" on courier_earnings
  for insert with check (courier_id = auth.uid());

-- COURIER_WITHDRAWALS
create policy "withdrawals_select" on courier_withdrawals
  for select using (courier_id = auth.uid() or is_admin());

create policy "withdrawals_insert" on courier_withdrawals
  for insert with check (courier_id = auth.uid());

create policy "withdrawals_admin_update" on courier_withdrawals
  for update using (is_admin());
