-- ============================================================
-- BrasUX — Migração 002: Integração Asaas
-- Execute no Supabase Dashboard → SQL Editor
-- Dependência: migration-001.sql já executado
-- ============================================================

-- Adiciona ID do cliente Asaas ao perfil
alter table profiles
  add column if not exists asaas_customer_id text;

-- Adiciona rastreamento de pagamento aos pedidos
alter table orders
  add column if not exists asaas_charge_id text,
  add column if not exists payment_status text not null default 'PENDING';
-- payment_status: PENDING | CONFIRMED | RECEIVED | OVERDUE | REFUNDED | DECLINED

-- Índice para webhook encontrar o pedido pelo charge_id rapidamente
create index if not exists idx_orders_asaas_charge_id
  on orders(asaas_charge_id)
  where asaas_charge_id is not null;

-- ============================================================
-- FUNÇÃO: earn_points_on_payment
-- Chamada pelo webhook do Asaas quando pagamento é confirmado.
-- Garante idempotência: não credita pontos duas vezes no mesmo pedido.
-- ============================================================
create or replace function earn_points_on_payment(p_order_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_customer_id uuid;
  v_total       numeric;
  v_already     boolean;
begin
  select customer_id, total
  into v_customer_id, v_total
  from orders
  where id = p_order_id;

  if v_customer_id is null then return; end if;

  -- Verifica se já creditou pontos para este pedido
  select exists(
    select 1 from point_transactions
    where order_id = p_order_id and amount > 0
  ) into v_already;

  if v_already then return; end if;

  perform earn_points(
    v_customer_id,
    floor(v_total)::int,
    'Pedido #' || upper(left(p_order_id::text, 8)),
    p_order_id
  );
end;
$$;

grant execute on function earn_points_on_payment to service_role;
