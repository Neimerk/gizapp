-- ============================================================
-- BrasUX — Schema Supabase (PostgreSQL)
-- Execute no Dashboard → SQL Editor → New query
-- ============================================================

-- PROFILES (estende auth.users do Supabase Auth)
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null default '',
  role text not null default 'customer' check (role in ('admin', 'customer', 'seller', 'courier')),
  phone text,
  cpf text,
  zip_code text,
  address text,
  address_number text,
  address_complement text,
  neighborhood text,
  store_id uuid,
  active boolean not null default true,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- STORES
create table if not exists stores (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text unique not null,
  category text not null,
  description text,
  logo_url text,
  banner_url text,
  phone text,
  whatsapp text,
  email text,
  address text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  zip_code text,
  delivery_fee numeric(10,2) not null default 0,
  delivery_time_min int not null default 30,
  delivery_time_max int not null default 60,
  rating numeric(3,2) not null default 5.0,
  is_open boolean not null default true,
  active boolean not null default true,
  featured boolean not null default false,
  owner_id uuid references profiles(id),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- STORE_PRODUCTS (catálogo de produtos por loja)
create table if not exists store_products (
  id uuid default gen_random_uuid() primary key,
  store_id uuid references stores(id) on delete cascade not null,
  name text not null,
  slug text not null,
  category text not null,
  sub_category text,
  brand text,
  description text,
  seo_title text,
  seo_description text,
  keywords text,
  image_url text,
  image_alt text,
  price numeric(10,2) not null,
  promotional_price numeric(10,2),
  stock int not null default 0,
  available boolean not null default true,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(store_id, slug)
);

-- ORDERS
create table if not exists orders (
  id uuid default gen_random_uuid() primary key,
  store_id uuid references stores(id) not null,
  customer_id uuid references profiles(id),
  customer_name text not null,
  customer_phone text not null,
  delivery_address text not null,
  delivery_number text,
  delivery_complement text,
  delivery_neighborhood text not null,
  payment_method text not null,
  delivery_fee numeric(10,2) not null default 0,
  subtotal numeric(10,2) not null,
  total numeric(10,2) not null,
  status int not null default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ORDER_ITEMS
create table if not exists order_items (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references orders(id) on delete cascade not null,
  store_product_id uuid references store_products(id) not null,
  product_name text not null,
  image_url text,
  unit_price numeric(10,2) not null,
  quantity int not null,
  total_price numeric(10,2) not null
);

-- ============================================================
-- TRIGGERS: atualiza updated_at automaticamente
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on profiles
  for each row execute function update_updated_at();

create trigger stores_updated_at before update on stores
  for each row execute function update_updated_at();

create trigger store_products_updated_at before update on store_products
  for each row execute function update_updated_at();

create trigger orders_updated_at before update on orders
  for each row execute function update_updated_at();

-- ============================================================
-- TRIGGER: cria profile automaticamente ao registrar usuário
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'customer')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- FUNÇÃO HELPER: verifica se o usuário atual é admin
-- (security definer evita recursão nos policies)
-- ============================================================
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table stores enable row level security;
alter table store_products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

-- PROFILES
create policy "profiles_select" on profiles
  for select using (auth.uid() = id or is_admin());

create policy "profiles_update" on profiles
  for update using (auth.uid() = id or is_admin());

-- STORES
create policy "stores_select" on stores
  for select using (active = true or is_admin());

create policy "stores_write" on stores
  for all using (is_admin() or owner_id = auth.uid());

-- STORE_PRODUCTS
create policy "products_select" on store_products
  for select using (available = true or is_admin());

create policy "products_write" on store_products
  for all using (
    is_admin() or
    exists (
      select 1 from stores
      where stores.id = store_products.store_id
      and stores.owner_id = auth.uid()
    )
  );

-- ORDERS
create policy "orders_insert" on orders
  for insert with check (auth.uid() is not null);

create policy "orders_select" on orders
  for select using (
    customer_id = auth.uid() or
    is_admin() or
    exists (
      select 1 from stores
      where stores.id = orders.store_id
      and stores.owner_id = auth.uid()
    )
  );

create policy "orders_update" on orders
  for update using (
    is_admin() or
    exists (
      select 1 from stores
      where stores.id = orders.store_id
      and stores.owner_id = auth.uid()
    )
  );

-- ORDER_ITEMS
create policy "order_items_insert" on order_items
  for insert with check (
    exists (select 1 from orders where orders.id = order_items.order_id)
  );

create policy "order_items_select" on order_items
  for select using (
    is_admin() or
    exists (
      select 1 from orders
      where orders.id = order_items.order_id
      and orders.customer_id = auth.uid()
    ) or
    exists (
      select 1 from orders
      join stores on stores.id = orders.store_id
      where orders.id = order_items.order_id
      and stores.owner_id = auth.uid()
    )
  );
