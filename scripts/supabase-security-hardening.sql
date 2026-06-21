-- ============================================================
-- BrasUX — Security Hardening Migration
-- Execute no Dashboard → SQL Editor → New query
-- Ordem: executar após todos os migrations existentes
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. CORRIGIR handle_new_user — Impede privilege escalation
--    Usuário não pode escolher seu próprio role no signup
-- ─────────────────────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    'customer'  -- sempre 'customer', nunca do metadata
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;


-- ─────────────────────────────────────────────────────────────
-- 2. RPC accept_delivery_safe — Calcula earnings no servidor
--    Impede que entregador manipule seus próprios ganhos
-- ─────────────────────────────────────────────────────────────
create or replace function accept_delivery_safe(p_order_id uuid, p_courier_id uuid)
returns deliveries as $$
declare
  v_delivery_fee numeric;
  v_earnings     numeric;
  v_result       deliveries;
  v_courier_role text;
begin
  -- Verificar que o caller é de fato um courier
  select role into v_courier_role from profiles where id = p_courier_id;
  if v_courier_role not in ('courier', 'admin') then
    raise exception 'UNAUTHORIZED: apenas entregadores podem aceitar entregas';
  end if;

  -- Buscar taxa de entrega do pedido (não confiar no cliente)
  select delivery_fee into v_delivery_fee from orders where id = p_order_id and status = 2;
  if not found then
    raise exception 'ORDER_NOT_AVAILABLE: pedido não encontrado ou não disponível para entrega';
  end if;

  -- Calcular ganho do entregador server-side: 90% da taxa, mínimo R$7
  v_earnings := greatest(7.00, round(v_delivery_fee * 0.90, 2));

  insert into deliveries (order_id, courier_id, status, earnings)
  values (p_order_id, p_courier_id, 'ACCEPTED', v_earnings)
  returning * into v_result;

  return v_result;
end;
$$ language plpgsql security definer set search_path = public;


-- ─────────────────────────────────────────────────────────────
-- 3. RLS: products_write — Corrigir para verificar ownership
-- ─────────────────────────────────────────────────────────────
drop policy if exists "products_write" on store_products;

create policy "products_write" on store_products
  for all using (
    is_admin() or
    exists (
      select 1 from stores
      where stores.id = store_products.store_id
        and stores.owner_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────────────────────
-- 4. RLS: orders — Seller só pode atualizar pedidos da SUA loja
-- ─────────────────────────────────────────────────────────────
drop policy if exists "seller_orders_update" on orders;

create policy "seller_orders_update" on orders
  for update using (
    is_admin() or
    (
      -- Customer pode "atualizar" apenas os próprios pedidos (para campos permitidos)
      customer_id = auth.uid()
    ) or
    (
      -- Seller pode atualizar apenas pedidos da loja dele
      exists (
        select 1 from stores
        where stores.id = orders.store_id
          and stores.owner_id = auth.uid()
      )
    )
  );


-- ─────────────────────────────────────────────────────────────
-- 5. RLS: deliveries — Courier só vê e atualiza as próprias entregas
-- ─────────────────────────────────────────────────────────────
alter table if exists deliveries enable row level security;

drop policy if exists "deliveries_select" on deliveries;
drop policy if exists "deliveries_insert" on deliveries;
drop policy if exists "deliveries_update" on deliveries;

create policy "deliveries_select" on deliveries
  for select using (
    is_admin() or
    courier_id = auth.uid() or
    exists (
      select 1 from orders o
      join stores s on s.id = o.store_id
      where o.id = deliveries.order_id and s.owner_id = auth.uid()
    )
  );

-- Couriers não podem inserir diretamente — devem usar accept_delivery_safe RPC
create policy "deliveries_insert" on deliveries
  for insert with check (false);

create policy "deliveries_update" on deliveries
  for update using (
    is_admin() or courier_id = auth.uid()
  );


-- ─────────────────────────────────────────────────────────────
-- 6. RLS: courier_earnings — Apenas admin e o próprio courier
-- ─────────────────────────────────────────────────────────────
alter table if exists courier_earnings enable row level security;

drop policy if exists "courier_earnings_select" on courier_earnings;
drop policy if exists "courier_earnings_insert" on courier_earnings;

create policy "courier_earnings_select" on courier_earnings
  for select using (is_admin() or courier_id = auth.uid());

-- Ninguém pode inserir diretamente — apenas via triggers/RPCs seguras
create policy "courier_earnings_insert" on courier_earnings
  for insert with check (false);


-- ─────────────────────────────────────────────────────────────
-- 7. RLS: seller_withdrawals — Seller só vê os próprios saques
-- ─────────────────────────────────────────────────────────────
alter table if exists seller_withdrawals enable row level security;

drop policy if exists "seller_withdrawals_select" on seller_withdrawals;
drop policy if exists "seller_withdrawals_insert" on seller_withdrawals;

create policy "seller_withdrawals_select" on seller_withdrawals
  for select using (is_admin() or seller_id = auth.uid());

create policy "seller_withdrawals_insert" on seller_withdrawals
  for insert with check (
    seller_id = auth.uid() and
    exists (select 1 from profiles where id = auth.uid() and role = 'seller')
  );


-- ─────────────────────────────────────────────────────────────
-- 8. Audit log table para operações sensíveis
-- ─────────────────────────────────────────────────────────────
create table if not exists audit_logs (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references profiles(id) on delete set null,
  action      text not null,
  table_name  text,
  record_id   uuid,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz default now() not null
);

alter table audit_logs enable row level security;

-- Apenas admins podem ler logs de auditoria
create policy "audit_logs_select" on audit_logs
  for select using (is_admin());

-- Ninguém pode inserir diretamente — apenas via triggers
create policy "audit_logs_insert" on audit_logs
  for insert with check (false);


-- ─────────────────────────────────────────────────────────────
-- 9. Função de audit log
-- ─────────────────────────────────────────────────────────────
create or replace function log_sensitive_change()
returns trigger as $$
begin
  insert into audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce(new.id, old.id),
    case when tg_op = 'DELETE' then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$ language plpgsql security definer set search_path = public;

-- Auditar mudanças de role
create or replace trigger audit_profile_role
  after update of role on profiles
  for each row
  when (old.role is distinct from new.role)
  execute function log_sensitive_change();

-- Auditar saques
create or replace trigger audit_withdrawals
  after insert or update on courier_withdrawals
  for each row execute function log_sensitive_change();


-- ─────────────────────────────────────────────────────────────
-- 10. RPC use_coupon atômica com FOR UPDATE (race condition fix)
-- ─────────────────────────────────────────────────────────────
create or replace function use_coupon_atomic(p_code text, p_user_id uuid)
returns jsonb as $$
declare
  v_coupon coupons;
begin
  -- Lock da linha para evitar race condition
  select * into v_coupon
  from coupons
  where code = upper(trim(p_code)) and active = true
  for update;

  if not found then
    raise exception 'INVALID_COUPON';
  end if;

  if v_coupon.expires_at is not null and v_coupon.expires_at < now() then
    raise exception 'EXPIRED_COUPON';
  end if;

  if v_coupon.max_uses is not null and v_coupon.uses_count >= v_coupon.max_uses then
    raise exception 'EXHAUSTED_COUPON';
  end if;

  -- Verificar uso individual
  if v_coupon.max_uses = 1 and p_user_id is not null then
    if exists (select 1 from user_coupons where user_id = p_user_id and coupon_id = v_coupon.id) then
      raise exception 'ALREADY_USED';
    end if;
  end if;

  -- Incrementar contagem atomicamente
  update coupons set uses_count = uses_count + 1 where id = v_coupon.id;

  -- Registrar uso
  if p_user_id is not null then
    insert into user_coupons (user_id, coupon_id) values (p_user_id, v_coupon.id)
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'id', v_coupon.id,
    'code', v_coupon.code,
    'type', v_coupon.type,
    'value', v_coupon.value,
    'label', v_coupon.label,
    'min_order', v_coupon.min_order
  );
end;
$$ language plpgsql security definer set search_path = public;
