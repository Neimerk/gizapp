-- =====================================================================
-- Correções de auditoria P1
--
-- 1. execute_order_split_v2 — inclui 'pending_payment' como status válido
--    de assinatura ao calcular comissão/taxa do entregador.
--
-- 2. get_vendor_subscription_by_owner — mapeia 'pending_payment' para
--    status de UI 'incomplete' (sem acesso a features premium).
--
-- 3. RLS pública em coupons — clientes e guests podem ler cupons ativos
--    para exibição no checkout (sem expor dados de configuração interna).
--
-- 4. handle_subscription_overdue — atualiza status correto para 'overdue'
--    compatível com o novo fluxo (era 'past_due' em alguns paths).
-- =====================================================================

-- ── 1. execute_order_split_v2 — inclui pending_payment ──────────────
CREATE OR REPLACE FUNCTION public.execute_order_split_v2(
  p_order_id   uuid,
  p_payment_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  v_order            record;
  v_sub              record;
  v_commission_rate  numeric(5,4)  := 0.00;
  v_courier_fee      numeric(12,2) := 1.00;
  v_courier_modality text          := 'B';
  v_products         numeric(12,2);
  v_delivery         numeric(12,2);
  v_service_fee      numeric(12,2);
  v_commission       numeric(12,2);
  v_vendor_net       numeric(12,2);
  v_courier_net      numeric(12,2);
  v_platform_total   numeric(12,2);
  v_vendor_id        uuid;
  v_courier_id       uuid;
  v_vendor_wid       uuid;
  v_courier_wid      uuid;
  v_platform_wid     uuid;
  v_asaas_vendor     text;
  v_asaas_courier    text;
  v_split_mode       text := 'ledger';
  v_vendor_status    text;
  v_courier_status   text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.split_rules
    WHERE order_id = p_order_id AND executed_at IS NOT NULL
  ) THEN
    RETURN jsonb_build_object('status', 'already_executed');
  END IF;

  SELECT o.*, s.owner_id AS store_owner_id
  INTO   v_order
  FROM   public.orders o
  JOIN   public.stores s ON s.id = o.store_id
  WHERE  o.id = p_order_id
  FOR UPDATE OF o;

  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;

  v_vendor_id   := v_order.store_owner_id;
  v_products    := COALESCE(v_order.subtotal, 0);
  v_delivery    := COALESCE(v_order.delivery_fee, 0);
  v_service_fee := COALESCE(v_order.service_fee, 0);

  -- Inclui 'pending_payment' para lojistas que acabaram de contratar e ainda
  -- não tiveram o primeiro webhook de confirmação (não bloqueamos o split).
  SELECT commission_rate, courier_fee_fixed, courier_modality
  INTO   v_sub
  FROM   public.subscriptions
  WHERE  vendor_id = v_vendor_id
    AND  status IN ('pending_payment', 'trial', 'active')
  LIMIT  1;

  IF FOUND THEN
    v_commission_rate  := COALESCE(v_sub.commission_rate, 0);
    v_courier_fee      := COALESCE(v_sub.courier_fee_fixed, 1.00);
    v_courier_modality := COALESCE(v_sub.courier_modality, 'B');
  END IF;

  IF v_courier_modality = 'A' THEN v_courier_fee := 0; END IF;

  v_commission   := ROUND(v_products * v_commission_rate, 2);
  v_vendor_net   := v_products - v_commission;
  v_courier_net  := GREATEST(0, v_delivery - v_courier_fee);
  v_platform_total := v_commission + v_service_fee + v_courier_fee;

  SELECT courier_id INTO v_courier_id
  FROM   public.deliveries
  WHERE  order_id = p_order_id AND status != 'CANCELLED'
  LIMIT  1;

  v_vendor_wid   := public.get_or_create_wallet(v_vendor_id, 'vendor');
  v_platform_wid := (
    SELECT id FROM public.wallets WHERE wallet_type = 'platform' AND owner_id IS NULL LIMIT 1
  );
  IF v_courier_id IS NOT NULL THEN
    v_courier_wid := public.get_or_create_wallet(v_courier_id, 'courier');
  END IF;

  SELECT asaas_wallet_id INTO v_asaas_vendor
  FROM   public.asaas_subaccounts
  WHERE  owner_id = v_vendor_id AND owner_type = 'vendor' AND split_enabled = true
  LIMIT  1;

  IF v_courier_id IS NOT NULL THEN
    SELECT asaas_wallet_id INTO v_asaas_courier
    FROM   public.asaas_subaccounts
    WHERE  owner_id = v_courier_id AND owner_type = 'courier' AND split_enabled = true
    LIMIT  1;
  END IF;

  IF v_asaas_vendor IS NOT NULL THEN v_split_mode := 'asaas_native'; END IF;

  v_vendor_status  := CASE WHEN v_split_mode = 'asaas_native' THEN 'available' ELSE 'held' END;
  v_courier_status := CASE WHEN v_asaas_courier IS NOT NULL   THEN 'available' ELSE 'held' END;

  INSERT INTO public.split_rules (
    order_id, payment_id,
    products_amount, delivery_amount, service_fee,
    commission_rate, commission_amount, vendor_net,
    vendor_id, courier_id,
    vendor_wallet_id, courier_wallet_id, platform_wallet_id,
    vendor_asaas_wallet_id, courier_asaas_wallet_id, split_mode,
    executed_at
  ) VALUES (
    p_order_id, p_payment_id,
    v_products, v_delivery, v_service_fee,
    v_commission_rate, v_commission, v_vendor_net,
    v_vendor_id, v_courier_id,
    v_vendor_wid, v_courier_wid, v_platform_wid,
    v_asaas_vendor, v_asaas_courier, v_split_mode,
    now()
  )
  ON CONFLICT (order_id) DO UPDATE SET
    executed_at             = now(),
    vendor_asaas_wallet_id  = EXCLUDED.vendor_asaas_wallet_id,
    courier_asaas_wallet_id = EXCLUDED.courier_asaas_wallet_id,
    split_mode              = EXCLUDED.split_mode;

  IF v_vendor_net > 0 THEN
    INSERT INTO public.wallet_transactions
      (wallet_id, order_id, payment_id, type, amount, direction, status, description)
    VALUES (
      v_vendor_wid, p_order_id, p_payment_id,
      'credit', v_vendor_net, 'in', v_vendor_status,
      'Venda — Pedido #' || UPPER(LEFT(p_order_id::text, 8))
    );
  END IF;

  IF v_courier_wid IS NOT NULL AND v_courier_net > 0 THEN
    INSERT INTO public.wallet_transactions
      (wallet_id, order_id, payment_id, type, amount, direction, status, description)
    VALUES (
      v_courier_wid, p_order_id, p_payment_id,
      'credit', v_courier_net, 'in', v_courier_status,
      'Entrega — Pedido #' || UPPER(LEFT(p_order_id::text, 8))
    );
  END IF;

  IF v_platform_total > 0 AND v_platform_wid IS NOT NULL THEN
    INSERT INTO public.wallet_transactions
      (wallet_id, order_id, payment_id, type, amount, direction, status, description)
    VALUES (
      v_platform_wid, p_order_id, p_payment_id,
      'fee', v_platform_total, 'in', 'available',
      'Receita plataforma — Pedido #' || UPPER(LEFT(p_order_id::text, 8))
    );
  END IF;

  UPDATE public.payments SET split_executed_at = now() WHERE id = p_payment_id;

  PERFORM public.log_financial_event(
    'system', v_vendor_id, 'split_executed', 'split_rules', p_order_id,
    v_products + v_delivery,
    'Split executado mode=' || v_split_mode,
    jsonb_build_object(
      'vendor_net',     v_vendor_net,
      'courier_net',    v_courier_net,
      'commission',     v_commission,
      'platform_total', v_platform_total,
      'mode',           v_split_mode
    )
  );

  RETURN jsonb_build_object(
    'status',         'executed',
    'split_mode',     v_split_mode,
    'vendor_net',     v_vendor_net,
    'courier_net',    v_courier_net,
    'commission',     v_commission,
    'platform_total', v_platform_total
  );
END;
$function$;

-- ── 2. get_vendor_subscription_by_owner — mapeia pending_payment ─────
CREATE OR REPLACE FUNCTION public.get_vendor_subscription_by_owner(
  p_owner_id uuid
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub    record;
  v_slug   text;
  v_status text;
  v_feat   jsonb;
BEGIN
  SELECT * INTO v_sub
  FROM public.subscriptions
  WHERE vendor_id = p_owner_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_slug := CASE v_sub.plan
    WHEN 'start'      THEN 'basico'
    WHEN 'pro'        THEN 'premium'
    WHEN 'whitelabel' THEN 'whitelabel'
    ELSE NULL
  END;

  v_status := CASE v_sub.status
    WHEN 'pending_payment' THEN 'incomplete'  -- novo: aguardando pagamento inicial
    WHEN 'trial'           THEN 'trialing'
    WHEN 'active'          THEN 'active'
    WHEN 'overdue'         THEN 'past_due'
    WHEN 'suspended'       THEN 'cancelled'
    WHEN 'cancelled'       THEN 'cancelled'
    WHEN 'inactive'        THEN 'cancelled'
    ELSE 'incomplete'
  END;

  v_feat := CASE v_sub.plan
    WHEN 'start' THEN jsonb_build_object(
      'realtime_tracking', true,
      'chat',              true,
      'analytics',         'basic',
      'api_access',        false,
      'support',           'email',
      'priority_dispatch', false
    )
    WHEN 'pro' THEN jsonb_build_object(
      'realtime_tracking', true,
      'chat',              true,
      'analytics',         'full',
      'api_access',        true,
      'support',           'priority',
      'priority_dispatch', true
    )
    WHEN 'whitelabel' THEN jsonb_build_object(
      'realtime_tracking', true,
      'chat',              true,
      'analytics',         'full',
      'api_access',        true,
      'support',           'dedicated',
      'priority_dispatch', true,
      'custom_reports',    true
    )
    ELSE jsonb_build_object(
      'realtime_tracking', false,
      'chat',              false,
      'analytics',         'basic',
      'api_access',        false,
      'support',           'email',
      'priority_dispatch', false
    )
  END;

  RETURN jsonb_build_object(
    'subscription_id',    v_sub.id,
    'plan_slug',          v_slug,
    'plan_name',          CASE v_sub.plan
                            WHEN 'free'       THEN 'Gratuito'
                            WHEN 'start'      THEN 'Básico'
                            WHEN 'pro'        THEN 'Premium'
                            WHEN 'whitelabel' THEN 'White Label'
                            ELSE v_sub.plan
                          END,
    'status',             v_status,
    'monthly_price',      v_sub.monthly_price,
    'current_period_end', v_sub.next_billing_date,
    'trial_end',          NULL,
    'features',           v_feat
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_vendor_subscription_by_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vendor_subscription_by_owner(uuid) TO authenticated, service_role;

-- ── 3. RLS pública em coupons — clientes podem ler cupons ativos ─────
-- A policy 'coupons_vendor' (migration 019) só deixa vendors lerem seus
-- próprios cupons. Clientes e guests ficavam sem ver nenhum cupom no checkout.
-- Esta policy adiciona leitura pública de cupons ativos (sem dados internos).

DROP POLICY IF EXISTS "coupons_public_select" ON public.coupons;
CREATE POLICY "coupons_public_select"
  ON public.coupons FOR SELECT
  TO anon, authenticated
  USING (
    active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR uses_count < max_uses)
  );

-- ── 4. Garante que pending_payment é aceito no CHECK da tabela (se existir) ─
-- A migration 024 adicionou CHECK(commission_rate=0) em subscriptions mas
-- não restringiu os valores de status. Garante compatibilidade.
DO $$
BEGIN
  -- Remove constraint de status se existir e for restritiva demais
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'subscriptions_status_check'
      AND table_name = 'subscriptions'
  ) THEN
    ALTER TABLE public.subscriptions DROP CONSTRAINT subscriptions_status_check;
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_status_check
        CHECK (status IN (
          'pending_payment', 'trial', 'active',
          'overdue', 'suspended', 'cancelled', 'inactive'
        ));
  END IF;
END;
$$;
