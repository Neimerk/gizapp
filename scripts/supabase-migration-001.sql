-- ============================================================
-- BrasUX — Migração 001: Tabelas críticas
-- Execute no Supabase Dashboard → SQL Editor → New query
-- Dependência: supabase-schema.sql já executado
-- ============================================================

-- ── REVIEWS ──────────────────────────────────────────────────
-- Avaliações de produtos por usuário. Públicas para leitura.
create table if not exists reviews (
  id               uuid default gen_random_uuid() primary key,
  store_product_id uuid references store_products(id) on delete cascade not null,
  user_id          uuid references profiles(id) on delete cascade not null,
  stars            smallint not null check (stars between 1 and 5),
  comment          text,
  created_at       timestamptz default now() not null,
  updated_at       timestamptz default now() not null,
  unique(store_product_id, user_id)
);

create trigger reviews_updated_at before update on reviews
  for each row execute function update_updated_at();

-- ── USER_POINTS ───────────────────────────────────────────────
-- Saldo atual de pontos por usuário.
create table if not exists user_points (
  user_id    uuid references profiles(id) on delete cascade primary key,
  balance    int not null default 0 check (balance >= 0),
  updated_at timestamptz default now() not null
);

create trigger user_points_updated_at before update on user_points
  for each row execute function update_updated_at();

-- ── POINT_TRANSACTIONS ────────────────────────────────────────
-- Histórico de ganhos e gastos de pontos.
create table if not exists point_transactions (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references profiles(id) on delete cascade not null,
  amount      int not null,  -- positivo = ganho, negativo = gasto
  description text not null,
  order_id    uuid references orders(id) on delete set null,
  created_at  timestamptz default now() not null
);

create index if not exists idx_point_tx_user_id on point_transactions(user_id);

-- ── COUPONS ───────────────────────────────────────────────────
-- Cupons gerenciados pelo admin.
create table if not exists coupons (
  id         uuid default gen_random_uuid() primary key,
  code       text unique not null,
  type       text not null check (type in ('percent', 'fixed', 'free_delivery')),
  value      numeric(10,2) not null,
  label      text not null,
  min_order  numeric(10,2) not null default 0,
  max_uses   int,     -- null = ilimitado
  uses_count int not null default 0,
  expires_at timestamptz,
  active     boolean not null default true,
  created_at timestamptz default now() not null
);

-- ── USER_COUPONS ──────────────────────────────────────────────
-- Rastreia uso de cupons por usuário (evita reutilização).
create table if not exists user_coupons (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references profiles(id) on delete cascade not null,
  coupon_id  uuid references coupons(id) on delete cascade not null,
  order_id   uuid references orders(id) on delete set null,
  used_at    timestamptz default now() not null,
  unique(user_id, coupon_id)
);

-- ── SAVED_ADDRESSES ───────────────────────────────────────────
-- Endereços de entrega salvos por usuário.
create table if not exists saved_addresses (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references profiles(id) on delete cascade not null,
  label        text not null default 'Casa',
  phone        text,
  cep          text,
  address      text not null,
  number       text not null,
  complement   text,
  neighborhood text not null,
  city         text,
  state        text,
  created_at   timestamptz default now() not null,
  updated_at   timestamptz default now() not null
);

create index if not exists idx_saved_addresses_user_id on saved_addresses(user_id);

create trigger saved_addresses_updated_at before update on saved_addresses
  for each row execute function update_updated_at();

-- ── FAVORITES ─────────────────────────────────────────────────
-- Produtos e lojas favoritados por usuário.
create table if not exists favorites (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references profiles(id) on delete cascade not null,
  item_type  text not null check (item_type in ('product', 'store')),
  item_id    uuid not null,
  created_at timestamptz default now() not null,
  unique(user_id, item_type, item_id)
);

create index if not exists idx_favorites_user_id on favorites(user_id);

-- ── BANNERS ───────────────────────────────────────────────────
-- Banners rotativos gerenciados pelo admin.
create table if not exists banners (
  id          uuid default gen_random_uuid() primary key,
  title       text not null,
  description text,
  image_url   text not null,
  link        text,
  link_label  text,
  badge       text,
  active      boolean not null default true,
  sort_order  int not null default 0,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz default now() not null
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table reviews          enable row level security;
alter table user_points      enable row level security;
alter table point_transactions enable row level security;
alter table coupons          enable row level security;
alter table user_coupons     enable row level security;
alter table saved_addresses  enable row level security;
alter table favorites        enable row level security;
alter table banners          enable row level security;

-- REVIEWS: qualquer um lê, dono escreve
create policy "reviews_select" on reviews for select using (true);
create policy "reviews_insert" on reviews for insert with check (auth.uid() = user_id);
create policy "reviews_update" on reviews for update using (auth.uid() = user_id);
create policy "reviews_delete" on reviews for delete using (auth.uid() = user_id);

-- USER_POINTS: apenas o próprio usuário
create policy "points_select" on user_points for select using (auth.uid() = user_id or is_admin());
create policy "points_insert" on user_points for insert with check (auth.uid() = user_id);
create policy "points_update" on user_points for update using (auth.uid() = user_id);

-- POINT_TRANSACTIONS: apenas o próprio usuário
create policy "point_tx_select" on point_transactions for select using (auth.uid() = user_id or is_admin());
create policy "point_tx_insert" on point_transactions for insert with check (auth.uid() = user_id);

-- COUPONS: todos leem ativos, admin escreve
create policy "coupons_select" on coupons for select using (active = true or is_admin());
create policy "coupons_write"  on coupons for all   using (is_admin());

-- USER_COUPONS: owner lê e insere, admin tudo
create policy "user_coupons_select" on user_coupons for select using (auth.uid() = user_id or is_admin());
create policy "user_coupons_insert" on user_coupons for insert with check (auth.uid() = user_id);

-- SAVED_ADDRESSES: apenas o próprio usuário
create policy "addresses_select" on saved_addresses for select using (auth.uid() = user_id);
create policy "addresses_insert" on saved_addresses for insert with check (auth.uid() = user_id);
create policy "addresses_update" on saved_addresses for update using (auth.uid() = user_id);
create policy "addresses_delete" on saved_addresses for delete using (auth.uid() = user_id);

-- FAVORITES: apenas o próprio usuário
create policy "favorites_select" on favorites for select using (auth.uid() = user_id);
create policy "favorites_insert" on favorites for insert with check (auth.uid() = user_id);
create policy "favorites_delete" on favorites for delete using (auth.uid() = user_id);

-- BANNERS: todos leem vigentes, admin escreve
create policy "banners_select" on banners
  for select using (
    (active = true and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()))
    or is_admin()
  );
create policy "banners_write" on banners for all using (is_admin());

-- ============================================================
-- FUNÇÕES ATÔMICAS DE PONTOS (security definer)
-- Evitam race conditions e garantem consistência do saldo.
-- ============================================================

create or replace function earn_points(
  p_user_id    uuid,
  p_amount     int,
  p_description text,
  p_order_id   uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_amount <= 0 then return; end if;

  insert into user_points (user_id, balance)
  values (p_user_id, p_amount)
  on conflict (user_id) do update
    set balance    = user_points.balance + p_amount,
        updated_at = now();

  insert into point_transactions (user_id, amount, description, order_id)
  values (p_user_id, p_amount, p_description, p_order_id);
end;
$$;

create or replace function spend_points(
  p_user_id     uuid,
  p_amount      int,
  p_description text,
  p_order_id    uuid default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_balance int;
begin
  if p_amount <= 0 then return false; end if;

  select balance into v_balance
  from user_points
  where user_id = p_user_id
  for update;  -- lock para evitar race condition

  if v_balance is null or v_balance < p_amount then
    return false;
  end if;

  update user_points
  set balance    = balance - p_amount,
      updated_at = now()
  where user_id = p_user_id;

  insert into point_transactions (user_id, amount, description, order_id)
  values (p_user_id, -p_amount, p_description, p_order_id);

  return true;
end;
$$;

-- Concede execução para usuários autenticados
grant execute on function earn_points  to authenticated;
grant execute on function spend_points to authenticated;

-- ============================================================
-- SEED: cupons iniciais
-- ============================================================
insert into coupons (code, type, value, label, min_order, max_uses, active) values
  ('BRASUX10', 'percent',       10,  '10% de desconto',    0,   null, true),
  ('BRASUX20', 'percent',       20,  '20% de desconto',    50,  null, true),
  ('FRETE0',   'free_delivery', 100, 'Frete grátis',       0,   null, true),
  ('WELCOME',  'fixed',         15,  'R$ 15,00 de desconto', 30, 1,  true)
on conflict (code) do nothing;
