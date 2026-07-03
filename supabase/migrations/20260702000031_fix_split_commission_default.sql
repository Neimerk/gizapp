-- =====================================================================
-- Corrige o default de commission_rate em execute_order_split_v2.
-- A migration 024 zera commission_rate em subscriptions via CHECK,
-- mas a função ainda usava 0.08 como fallback quando não há assinatura.
-- O modelo é 100% SaaS (receita por mensalidade), não por comissão.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.execute_order_split_v2(
  p_order_id   uuid,
  p_payment_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  v_order            record;
  v_sub              record;
  v_commission_rate  numeric(5,4)  := 0.00; -- era 0.08, corrigido para 0
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

  SELECT commission_rate, courier_fee_fixed, courier_modality
  INTO   v_sub
  FROM   public.subscriptions
  WHERE  vendor_id = v_vendor_id AND status IN ('trial','active')
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
