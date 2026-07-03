-- =====================================================================
-- P0 Race Condition & Financial Integrity Fixes
--
-- ACHADO 1 — TOCTOU em execute_order_split_v2
--   FOR UPDATE ocorria APÓS o EXISTS check: dois webhooks PAYMENT_CONFIRMED
--   simultâneos (Asaas é at-least-once) podiam creditar vendor/courier em dobro.
--   Fix: adquirir o lock ANTES de checar idempotência.
--
-- ACHADO 2 — Double credit de courier (split + release_balance)
--   execute_order_split_v2 inseria 'credit' HELD para o courier;
--   release_balance_after_delivery inseria 'delivery_credit' AVAILABLE — dois
--   créditos para o mesmo pedido.
--   Fix: release_balance libera o HELD existente em vez de inserir novo.
--
-- ACHADO 3 — Platform wallet NULL: receita de plataforma descartada silenciosamente
--   Fix: RAISE EXCEPTION se v_platform_wid IS NULL.
--
-- ACHADO 8 (P0-3) — _get_cron_cfg exposta para PUBLIC
--   REVOKE ALL FROM PUBLIC; pg_cron (superuser) não precisa de GRANT.
--
-- DEFENSE IN DEPTH — UNIQUE index em wallet_transactions
--   Impede double-insert no nível do banco mesmo se o TOCTOU escorregar.
-- =====================================================================

-- ── 0. Remove duplicatas existentes (se o race ocorreu antes do fix) ─

WITH dupes AS (
  SELECT ctid,
         ROW_NUMBER() OVER (
           PARTITION BY wallet_id, order_id, type, direction
           ORDER BY created_at ASC NULLS LAST
         ) AS rn
  FROM public.wallet_transactions
  WHERE direction = 'in'
    AND type IN ('credit', 'fee', 'delivery_credit')
)
DELETE FROM public.wallet_transactions
WHERE ctid IN (SELECT ctid FROM dupes WHERE rn > 1);

-- ── 1. UNIQUE index — defense in depth contra double-credit ──────────

CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_dedup_order_type_idx
  ON public.wallet_transactions (wallet_id, order_id, type)
  WHERE direction = 'in';

-- ── 2. execute_order_split_v2 — TOCTOU fix + platform wallet guard ───

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
  -- FIX P0-1: adquirir o row lock ANTES de checar idempotência.
  -- Antes, o EXISTS ocorria sem lock: dois webhooks simultâneos passavam
  -- pelo check, o segundo bloqueava no FOR UPDATE, desbloqueava e então
  -- inseria wallet_transactions em dobro.
  SELECT o.*, s.owner_id AS store_owner_id
  INTO   v_order
  FROM   public.orders o
  JOIN   public.stores s ON s.id = o.store_id
  WHERE  o.id = p_order_id
  FOR UPDATE OF o;

  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;

  -- Idempotência verificada COM o lock em mãos
  IF EXISTS (
    SELECT 1 FROM public.split_rules
    WHERE order_id = p_order_id AND executed_at IS NOT NULL
  ) THEN
    RETURN jsonb_build_object('status', 'already_executed');
  END IF;

  v_vendor_id   := v_order.store_owner_id;
  v_products    := COALESCE(v_order.subtotal, 0);
  v_delivery    := COALESCE(v_order.delivery_fee, 0);
  v_service_fee := COALESCE(v_order.service_fee, 0);

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

  -- FIX P0-3: falha explícita em vez de descartar receita silenciosamente
  IF v_platform_total > 0 AND v_platform_wid IS NULL THEN
    RAISE EXCEPTION 'PLATFORM_WALLET_NOT_CONFIGURED: nenhuma wallet com wallet_type=platform e owner_id IS NULL encontrada';
  END IF;

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

-- ── 3. release_balance_after_delivery — fix double credit de courier ─
--
-- FIX P0-4: execute_order_split_v2 cria uma transação 'credit' HELD para o
-- courier. Esta função liberava o HELD do vendor corretamente (UPDATE status),
-- mas creditava o courier com um INSERT 'delivery_credit' separado — gerando
-- duplo crédito para o mesmo pedido.
-- Fix: libera o HELD existente (UPDATE); INSERT somente como fallback quando
-- não há HELD (courier atribuído após o split ou modo asaas_native).

CREATE OR REPLACE FUNCTION public.release_balance_after_delivery(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_courier_id  uuid;
  v_earnings    numeric;
  v_courier_wid uuid;
  v_vendor_id   uuid;
  v_vendor_wid  uuid;
BEGIN
  SELECT courier_id, earnings
    INTO v_courier_id, v_earnings
    FROM public.deliveries
   WHERE order_id = p_order_id AND status != 'CANCELLED';

  IF v_courier_id IS NULL THEN
    RAISE EXCEPTION 'Delivery not found for order %', p_order_id;
  END IF;

  IF auth.uid() IS NOT NULL AND v_courier_id != auth.uid() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  UPDATE public.deliveries
     SET status = 'DELIVERED', delivered_at = now(), updated_at = now()
   WHERE order_id = p_order_id AND courier_id = v_courier_id;

  UPDATE public.orders
     SET status = 4, updated_at = now()
   WHERE id = p_order_id;

  -- Libera saldo HELD do vendor → available
  SELECT sr.vendor_id, sr.vendor_wallet_id
    INTO v_vendor_id, v_vendor_wid
    FROM public.split_rules sr
   WHERE sr.order_id = p_order_id AND sr.executed_at IS NOT NULL
   LIMIT 1;

  IF v_vendor_wid IS NOT NULL THEN
    UPDATE public.wallet_transactions
       SET status = 'available'
     WHERE wallet_id = v_vendor_wid
       AND order_id  = p_order_id
       AND status    = 'held'
       AND direction = 'in';
  END IF;

  -- Libera saldo HELD do courier → available
  -- Se não há HELD (courier pós-split ou asaas_native), insere delivery_credit
  v_courier_wid := public.get_or_create_wallet(v_courier_id, 'courier');

  UPDATE public.wallet_transactions
     SET status = 'available'
   WHERE wallet_id = v_courier_wid
     AND order_id  = p_order_id
     AND type      = 'credit'
     AND status    = 'held'
     AND direction = 'in';

  IF NOT FOUND THEN
    INSERT INTO public.wallet_transactions
      (wallet_id, order_id, type, amount, direction, status, description)
    VALUES
      (v_courier_wid, p_order_id, 'delivery_credit',
       COALESCE(v_earnings, 0), 'in', 'available',
       'Ganho de entrega — Pedido #' || UPPER(LEFT(p_order_id::text, 8)));
  END IF;

  PERFORM public.log_financial_event(
    'system', v_courier_id, 'balance_released', 'orders', p_order_id,
    COALESCE(v_earnings, 0),
    'Saldo liberado após entrega',
    jsonb_build_object('courier_id', v_courier_id, 'vendor_id', v_vendor_id)
  );
END;
$function$;

-- ── 4. _get_cron_cfg — revogar acesso público ────────────────────────
-- FIX P0-3: sem REVOKE, qualquer usuário autenticado podia chamar
-- SELECT public._get_cron_cfg('internal_key') via PostgREST e obter a
-- INTERNAL_FUNCTION_KEY. pg_cron roda como superuser e não precisa de GRANT.

REVOKE ALL ON FUNCTION public._get_cron_cfg(text) FROM PUBLIC;
