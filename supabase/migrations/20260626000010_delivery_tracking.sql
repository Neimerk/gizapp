-- ============================================================
-- Migração 010 — Rastreamento de entregas "nível iFood"
-- ============================================================

-- 1. Coordenadas de destino do pedido (geocodadas 1x, cacheadas)
alter table orders   add column if not exists dest_lat numeric(10, 7);
alter table orders   add column if not exists dest_lng numeric(10, 7);

-- 2. Foto do entregador (e demais perfis)
alter table profiles add column if not exists avatar_url text;

-- 3. Avaliações do entregador
create table if not exists courier_ratings (
  id          uuid default gen_random_uuid() primary key,
  delivery_id uuid references deliveries(id) on delete cascade not null,
  order_id    uuid references orders(id)     on delete cascade not null,
  courier_id  uuid references profiles(id)   on delete cascade not null,
  customer_id uuid references profiles(id)   on delete cascade not null,
  stars       int  not null check (stars between 1 and 5),
  comment     text,
  created_at  timestamptz default now() not null,
  unique (delivery_id)              -- uma avaliação por entrega (idempotente)
);

create index if not exists idx_courier_ratings_courier on courier_ratings(courier_id);

alter table courier_ratings enable row level security;

-- Cliente vê/insere a própria avaliação; entregador/admin podem ler as suas
create policy "ratings_select" on courier_ratings
  for select using (
    customer_id = auth.uid() or courier_id = auth.uid() or is_admin()
  );

-- 4. Média de notas por entregador
create or replace view courier_rating_stats as
  select courier_id,
         round(avg(stars)::numeric, 2) as avg_stars,
         count(*)::int                 as ratings_count
  from courier_ratings
  group by courier_id;

-- 5. RPC segura para avaliar (valida posse do pedido e que foi entregue)
create or replace function rate_courier(
  p_order_id uuid, p_stars int, p_comment text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_delivery deliveries%rowtype;
  v_order    orders%rowtype;
begin
  if p_stars < 1 or p_stars > 5 then
    raise exception 'stars_out_of_range';
  end if;

  select * into v_order from orders where id = p_order_id;
  if not found or v_order.customer_id <> auth.uid() then
    raise exception 'not_order_owner';
  end if;
  if v_order.status <> 4 then
    raise exception 'order_not_delivered';
  end if;

  select * into v_delivery from deliveries
    where order_id = p_order_id and status <> 'CANCELLED'
    order by created_at desc limit 1;
  if not found then
    raise exception 'no_delivery';
  end if;

  insert into courier_ratings (delivery_id, order_id, courier_id, customer_id, stars, comment)
  values (v_delivery.id, p_order_id, v_delivery.courier_id, auth.uid(), p_stars, nullif(trim(p_comment), ''))
  on conflict (delivery_id) do update
    set stars = excluded.stars, comment = excluded.comment, created_at = now();
end; $$;

grant execute on function rate_courier(uuid, int, text) to authenticated;

-- 6. Realtime: garantir que orders está na publicação
do $$ begin
  alter publication supabase_realtime add table orders;
exception when duplicate_object then null; end $$;
