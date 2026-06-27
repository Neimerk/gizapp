-- ============================================================
-- BrasUX Migration 012 — RPC de pedido (fecha H-1) + agregação financeira
-- IDEMPOTENTE. Rodar após a migration-011.
--
-- Resolve:
--   H-1  (definitivo): criação de pedido com total arbitrário via insert direto.
--        Agora o pedido só é criado por create_order_atomic (SECURITY DEFINER),
--        que recalcula preços/subtotal/total no servidor a partir de
--        store_products. INSERT direto em orders é bloqueado por RLS.
--   MÉDIO: adminGetFinancialSummary fazia reduce de TODOS os pedidos no cliente.
--        Agora admin_financial_summary agrega no Postgres.
-- ============================================================

-- ── 1. Agregação financeira no servidor ─────────────────────
CREATE OR REPLACE FUNCTION public.admin_financial_summary(
  p_start timestamptz,
  p_end   timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_admin boolean;
  v_total_orders   int := 0;
  v_paid_orders    int := 0;
  v_total_revenue  numeric(14,2) := 0;
  v_platform_rev   numeric(14,2) := 0;
  v_split_executed int := 0;
  v_total_refunds  numeric(14,2) := 0;
  v_pending_wd     numeric(14,2) := 0;
BEGIN
  -- Só admin pode agregar dados globais
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE payment_status IN ('CONFIRMED','RECEIVED')),
    COALESCE(SUM(total) FILTER (WHERE payment_status IN ('CONFIRMED','RECEIVED')), 0)
  INTO v_total_orders, v_paid_orders, v_total_revenue
  FROM public.orders
  WHERE created_at >= p_start AND created_at <= p_end;

  SELECT
    COALESCE(SUM(commission_amount + service_fee), 0),
    COUNT(*)
  INTO v_platform_rev, v_split_executed
  FROM public.split_rules
  WHERE executed_at IS NOT NULL
    AND created_at >= p_start AND created_at <= p_end;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_refunds
  FROM public.refunds
  WHERE created_at >= p_start AND created_at <= p_end;

  SELECT COALESCE(SUM(amount_gross), 0) INTO v_pending_wd
  FROM public.withdrawals
  WHERE status = 'pending'
    AND created_at >= p_start AND created_at <= p_end;

  RETURN jsonb_build_object(
    'totalRevenue',       v_total_revenue,
    'platformRevenue',    v_platform_rev,
    'totalOrders',        v_total_orders,
    'paidOrders',         v_paid_orders,
    'splitExecuted',      v_split_executed,
    'totalRefunds',       v_total_refunds,
    'pendingWithdrawals', v_pending_wd
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_financial_summary(timestamptz, timestamptz) TO authenticated, service_role;

-- ── 2. Criação de pedido atômica e server-side (fecha H-1) ──
-- Recalcula preços a partir de store_products; cliente NÃO dita valores.
-- Espelha exatamente a lógica anterior do createOrder (preço promocional,
-- clamp da taxa de entrega, cupom via use_coupon_atomic, pontos via spend_points).
CREATE OR REPLACE FUNCTION public.create_order_atomic(
  p_store_id              uuid,
  p_items                 jsonb,   -- [{ "store_product_id": uuid, "quantity": int }]
  p_customer_name         text,
  p_customer_phone        text,
  p_delivery_address      text,
  p_delivery_neighborhood text,
  p_payment_method        text,
  p_delivery_number       text    DEFAULT NULL,
  p_delivery_complement   text    DEFAULT NULL,
  p_delivery_fee_override numeric DEFAULT NULL,
  p_coupon_code           text    DEFAULT NULL,
  p_points_discount       int     DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_store     record;
  v_item      jsonb;
  v_pid       uuid;
  v_qty       int;
  v_prod      record;
  v_unit      numeric(12,2);
  v_subtotal  numeric(12,2) := 0;
  v_delivery  numeric(12,2);
  v_coupon    jsonb;
  v_cdisc     numeric(12,2) := 0;
  v_points    int := GREATEST(0, COALESCE(p_points_discount, 0));
  v_total     numeric(12,2);
  v_order_id  uuid;
  v_items_out jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF p_store_id IS NULL THEN RAISE EXCEPTION 'INVALID_STORE'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'INVALID_ITEMS';
  END IF;

  SELECT id, name, delivery_fee INTO v_store FROM public.stores WHERE id = p_store_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'STORE_NOT_FOUND'; END IF;

  -- Taxa de entrega: nunca abaixo da mínima da loja, nunca acima de R$500
  IF p_delivery_fee_override IS NULL THEN
    v_delivery := v_store.delivery_fee;
  ELSE
    IF p_delivery_fee_override < 0 THEN RAISE EXCEPTION 'INVALID_DELIVERY_FEE'; END IF;
    v_delivery := GREATEST(v_store.delivery_fee, LEAST(500, p_delivery_fee_override));
  END IF;

  INSERT INTO public.orders (
    store_id, customer_id, customer_name, customer_phone,
    delivery_address, delivery_number, delivery_complement, delivery_neighborhood,
    payment_method, delivery_fee, subtotal, total, status
  ) VALUES (
    p_store_id, v_uid, p_customer_name, p_customer_phone,
    p_delivery_address, p_delivery_number, p_delivery_complement, p_delivery_neighborhood,
    p_payment_method, v_delivery, 0, 0.01, 0
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_pid := (v_item->>'store_product_id')::uuid;
    v_qty := (v_item->>'quantity')::int;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 99 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;

    SELECT id, name, price, promotional_price, image_url INTO v_prod
    FROM public.store_products
    WHERE id = v_pid AND store_id = p_store_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND'; END IF;

    v_unit     := COALESCE(v_prod.promotional_price, v_prod.price);
    v_subtotal := v_subtotal + v_unit * v_qty;

    INSERT INTO public.order_items (
      order_id, store_product_id, product_name, image_url, unit_price, quantity, total_price
    ) VALUES (
      v_order_id, v_pid, v_prod.name, v_prod.image_url, v_unit, v_qty, v_unit * v_qty
    );

    v_items_out := v_items_out || jsonb_build_object(
      'store_product_id', v_pid,
      'product_name',     v_prod.name,
      'image_url',        v_prod.image_url,
      'unit_price',       v_unit,
      'quantity',         v_qty,
      'total_price',      v_unit * v_qty
    );
  END LOOP;

  -- Cupom (validação/uso atômico já existente)
  IF p_coupon_code IS NOT NULL AND length(trim(p_coupon_code)) > 0 THEN
    v_coupon := public.use_coupon_atomic(trim(p_coupon_code), v_uid);
    IF (v_coupon->>'type') = 'percent' THEN
      v_cdisc := ROUND(v_subtotal * (v_coupon->>'value')::numeric / 100, 2);
    ELSIF (v_coupon->>'type') = 'fixed' THEN
      v_cdisc := LEAST((v_coupon->>'value')::numeric, v_subtotal);
    ELSIF (v_coupon->>'type') = 'free_delivery' THEN
      v_cdisc := v_delivery;
    END IF;
  END IF;

  -- Pontos (débito atômico já existente)
  IF v_points > 0 THEN
    IF NOT public.spend_points(v_uid, v_points, 'Desconto em pedido', v_order_id) THEN
      RAISE EXCEPTION 'INSUFFICIENT_POINTS';
    END IF;
  END IF;

  v_total := GREATEST(0.01, v_subtotal + v_delivery - v_cdisc - v_points);

  UPDATE public.orders SET subtotal = v_subtotal, total = v_total WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'id',           v_order_id,
    'store_id',     p_store_id,
    'store_name',   v_store.name,
    'subtotal',     v_subtotal,
    'delivery_fee', v_delivery,
    'total',        v_total,
    'coupon_discount', v_cdisc,
    'points_discount', v_points,
    'items',        v_items_out
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_atomic TO authenticated, service_role;

-- ── 3. Bloqueia INSERT direto em orders (força a RPC) ───────
-- A RPC é SECURITY DEFINER e ignora RLS; o cliente não insere mais direto,
-- então não há como forjar total/subtotal via REST.
DROP POLICY IF EXISTS "orders_insert" ON public.orders;
CREATE POLICY "orders_insert" ON public.orders
  FOR INSERT
  WITH CHECK (false);

-- ============================================================
-- FIM da migration 012
-- ============================================================
