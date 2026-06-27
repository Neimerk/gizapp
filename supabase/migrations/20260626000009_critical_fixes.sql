-- ============================================================
-- BrasUX Migration 009 — Correções críticas (auditoria CTO)
-- IDEMPOTENTE. Rodar após a migration-008 no SQL Editor.
--
-- Resolve:
--   C-1  check_rate_limit / rate_limits inexistentes
--   C-2  request_withdrawal sem lock (saque duplo)
--   C-3  execute_order_split sem lock (split duplicado)
--   H-1  orders_insert sem amarração de customer_id
--   H-2  reverse_split_on_refund reverte saldo já sacado
--   M    is_admin()/is_courier() sem search_path
--   M    índices de FK faltando (caminhos quentes)
--   H-3  audit_logs.extra inexistente
-- ============================================================

-- ── C-1. RATE LIMITING (tabela + função atômica) ────────────
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key          text        PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  count        integer     NOT NULL DEFAULT 0
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- Sem policies: apenas service_role (que ignora RLS) acessa esta tabela.

-- Janela deslizante atômica via UPSERT. Retorna TRUE se dentro do limite.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key            text,
  p_max_requests   integer,
  p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now   timestamptz := now();
  v_count integer;
BEGIN
  INSERT INTO public.rate_limits AS rl (key, window_start, count)
  VALUES (p_key, v_now, 1)
  ON CONFLICT (key) DO UPDATE
    SET count = CASE
                  WHEN rl.window_start < v_now - make_interval(secs => p_window_seconds)
                  THEN 1
                  ELSE rl.count + 1
                END,
        window_start = CASE
                  WHEN rl.window_start < v_now - make_interval(secs => p_window_seconds)
                  THEN v_now
                  ELSE rl.window_start
                END
  RETURNING rl.count INTO v_count;

  RETURN v_count <= p_max_requests;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;

-- Limpeza opcional (chamar por cron): remove janelas antigas
CREATE OR REPLACE FUNCTION public.purge_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 day';
$$;
GRANT EXECUTE ON FUNCTION public.purge_rate_limits() TO service_role;

-- ── C-2. request_withdrawal COM LOCK (anti saque-duplo) ─────
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_wallet_id    uuid,
  p_owner_id     uuid,
  p_owner_type   text,
  p_amount       numeric,
  p_pix_key      text,
  p_pix_key_type text DEFAULT 'cpf'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance       jsonb;
  v_available     numeric(12,2);
  v_withdrawal_id uuid;
  v_debit_id      uuid;
BEGIN
  -- Serializa todas as operações sobre ESTA carteira na transação atual.
  -- Dois saques simultâneos da mesma carteira passam a ser sequenciais.
  PERFORM pg_advisory_xact_lock(hashtext(p_wallet_id::text));

  -- Valida dono da carteira
  IF NOT EXISTS (SELECT 1 FROM public.wallets WHERE id = p_wallet_id AND owner_id = p_owner_id) THEN
    RAISE EXCEPTION 'WALLET_NOT_OWNED';
  END IF;

  IF p_amount < 10 THEN
    RAISE EXCEPTION 'MINIMUM_AMOUNT: mínimo R$ 10,00';
  END IF;

  -- Verifica saldo disponível (já sob lock — leitura consistente)
  v_balance   := public.get_wallet_balance(p_wallet_id);
  v_available := (v_balance->>'available')::numeric;

  IF v_available < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: disponível=%, solicitado=%', v_available, p_amount;
  END IF;

  -- Insere withdrawal
  INSERT INTO public.withdrawals (
    wallet_id, owner_id, owner_type,
    amount_gross, withdrawal_fee, amount_net,
    pix_key, pix_key_type, status
  ) VALUES (
    p_wallet_id, p_owner_id, p_owner_type,
    p_amount, 0, p_amount,
    p_pix_key, p_pix_key_type, 'pending'
  ) RETURNING id INTO v_withdrawal_id;

  -- Cria transação de débito (bloqueia o saldo imediatamente)
  INSERT INTO public.wallet_transactions (
    wallet_id, withdrawal_id, type, amount, direction, status, description
  ) VALUES (
    p_wallet_id, v_withdrawal_id,
    'withdrawal', p_amount, 'out', 'completed',
    'Saque Pix solicitado'
  ) RETURNING id INTO v_debit_id;

  UPDATE public.withdrawals SET wt_debit_id = v_debit_id WHERE id = v_withdrawal_id;

  RETURN v_withdrawal_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_withdrawal(uuid, uuid, text, numeric, text, text)
  TO authenticated, service_role;

-- ── C-3. execute_order_split COM LOCK (anti split-duplo) ────
CREATE OR REPLACE FUNCTION public.execute_order_split(
  p_order_id  uuid,
  p_payment_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order           record;
  v_commission_rate numeric(5,4) := 0.08;
  v_products        numeric(12,2);
  v_delivery        numeric(12,2);
  v_service_fee     numeric(12,2);
  v_commission      numeric(12,2);
  v_vendor_net      numeric(12,2);
  v_vendor_id       uuid;
  v_courier_id      uuid;
  v_vendor_wid      uuid;
  v_courier_wid     uuid;
  v_platform_wid    uuid;
  v_sr_id           uuid;
BEGIN
  -- Serializa o split DESTE pedido: reenvio de webhook do Asaas vira sequencial.
  PERFORM pg_advisory_xact_lock(hashtext(p_order_id::text));

  -- Idempotência: já foi executado? (agora sob lock, sem janela de corrida)
  IF EXISTS (SELECT 1 FROM public.split_rules WHERE order_id = p_order_id AND executed_at IS NOT NULL) THEN
    RETURN jsonb_build_object('status', 'already_executed');
  END IF;

  SELECT o.*, s.owner_id AS store_owner_id
  INTO   v_order
  FROM   public.orders o
  JOIN   public.stores s ON s.id = o.store_id
  WHERE  o.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  v_vendor_id   := v_order.store_owner_id;
  v_products    := COALESCE(v_order.subtotal, 0);
  v_delivery    := COALESCE(v_order.delivery_fee, 0);
  v_service_fee := COALESCE(v_order.service_fee, 0);

  SELECT commission_rate INTO v_commission_rate
  FROM   public.subscriptions
  WHERE  vendor_id = v_vendor_id AND status IN ('trial','active')
  LIMIT  1;

  IF NOT FOUND THEN
    v_commission_rate := 0.08;
  END IF;

  v_commission := ROUND(v_products * v_commission_rate, 2);
  v_vendor_net := v_products - v_commission;

  SELECT courier_id INTO v_courier_id
  FROM   public.deliveries
  WHERE  order_id = p_order_id AND status != 'CANCELLED'
  LIMIT  1;

  v_vendor_wid   := public.get_or_create_wallet(v_vendor_id, 'vendor');
  v_platform_wid := (SELECT id FROM public.wallets WHERE wallet_type = 'platform' AND owner_id IS NULL LIMIT 1);
  IF v_courier_id IS NOT NULL THEN
    v_courier_wid := public.get_or_create_wallet(v_courier_id, 'courier');
  END IF;

  INSERT INTO public.split_rules (
    order_id, payment_id,
    products_amount, delivery_amount, service_fee,
    commission_rate, commission_amount, vendor_net,
    vendor_id, courier_id,
    vendor_wallet_id, courier_wallet_id, platform_wallet_id,
    executed_at
  ) VALUES (
    p_order_id, p_payment_id,
    v_products, v_delivery, v_service_fee,
    v_commission_rate, v_commission, v_vendor_net,
    v_vendor_id, v_courier_id,
    v_vendor_wid, v_courier_wid, v_platform_wid,
    now()
  )
  ON CONFLICT (order_id) DO UPDATE
    SET executed_at = now()
  RETURNING id INTO v_sr_id;

  IF v_vendor_net > 0 THEN
    INSERT INTO public.wallet_transactions (
      wallet_id, order_id, payment_id, type, amount, direction, status, description
    ) VALUES (
      v_vendor_wid, p_order_id, p_payment_id,
      'credit', v_vendor_net, 'in', 'held',
      'Venda — Pedido #' || UPPER(LEFT(p_order_id::text, 8))
    );
  END IF;

  IF v_courier_wid IS NOT NULL AND v_delivery > 0 THEN
    INSERT INTO public.wallet_transactions (
      wallet_id, order_id, payment_id, type, amount, direction, status, description
    ) VALUES (
      v_courier_wid, p_order_id, p_payment_id,
      'credit', v_delivery, 'in', 'held',
      'Entrega — Pedido #' || UPPER(LEFT(p_order_id::text, 8))
    );
  END IF;

  IF v_commission + v_service_fee > 0 THEN
    INSERT INTO public.wallet_transactions (
      wallet_id, order_id, payment_id, type, amount, direction, status, description
    ) VALUES (
      v_platform_wid, p_order_id, p_payment_id,
      'fee', v_commission + v_service_fee, 'in', 'available',
      'Receita plataforma — Pedido #' || UPPER(LEFT(p_order_id::text, 8))
    );
  END IF;

  UPDATE public.payments SET split_executed_at = now() WHERE id = p_payment_id;

  RETURN jsonb_build_object(
    'status',          'executed',
    'vendor_net',      v_vendor_net,
    'delivery',        v_delivery,
    'commission',      v_commission,
    'service_fee',     v_service_fee,
    'platform_total',  v_commission + v_service_fee
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_order_split(uuid, uuid) TO service_role;

-- ── H-2. reverse_split_on_refund SEGURO ─────────────────────
-- Só reverte o que ainda está RETIDO (held). O que já foi liberado
-- (available/sacado) NÃO é marcado como reversed (evita ledger negativo);
-- nesse caso a plataforma absorve a perda com um débito explícito.
CREATE OR REPLACE FUNCTION public.reverse_split_on_refund(
  p_order_id    uuid,
  p_refund_id   uuid,
  p_absorbed_by text DEFAULT 'brasux'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sr              record;
  v_reversed        int := 0;
  v_platform_absorb numeric(12,2) := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_order_id::text));

  SELECT * INTO v_sr FROM public.split_rules WHERE order_id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'no_split_found');
  END IF;

  -- 1) Reverte apenas créditos ainda RETIDOS (dinheiro não saiu) — seguro.
  UPDATE public.wallet_transactions
  SET    status   = 'reversed',
         metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('refund_id', p_refund_id)
  WHERE  order_id  = p_order_id
    AND  direction = 'in'
    AND  status    = 'held';
  GET DIAGNOSTICS v_reversed = ROW_COUNT;

  -- 2) Soma o que já foi liberado (available) — pode já ter sido sacado.
  SELECT COALESCE(SUM(amount), 0) INTO v_platform_absorb
  FROM   public.wallet_transactions
  WHERE  order_id  = p_order_id
    AND  direction = 'in'
    AND  status    = 'available';

  -- 3) Se a plataforma absorve, registra a perda como débito explícito.
  IF p_absorbed_by = 'brasux' AND v_sr.platform_wallet_id IS NOT NULL AND v_platform_absorb > 0 THEN
    INSERT INTO public.wallet_transactions (
      wallet_id, order_id, refund_id, type, amount, direction, status, description
    ) VALUES (
      v_sr.platform_wallet_id, p_order_id, p_refund_id,
      'refund', v_platform_absorb, 'out', 'completed',
      'Absorção de estorno (saldo já liberado) — Pedido #' || UPPER(LEFT(p_order_id::text, 8))
    );
  END IF;

  RETURN jsonb_build_object(
    'status',            'reversed',
    'held_reversed_rows', v_reversed,
    'platform_absorbed',  v_platform_absorb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reverse_split_on_refund(uuid, uuid, text) TO service_role;

-- ── M. is_admin()/is_courier() com search_path fixo + STABLE ─
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_courier()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'courier'
  );
$$;

-- ── H-1. orders_insert: impede criar pedido em nome de OUTRO ─
-- Permite o próprio usuário (customer_id = auth.uid()) ou convidado
-- (customer_id IS NULL). Bloqueia inserir com o id de terceiros.
DROP POLICY IF EXISTS "orders_insert" ON public.orders;
CREATE POLICY "orders_insert" ON public.orders
  FOR INSERT
  WITH CHECK (customer_id = auth.uid() OR customer_id IS NULL);

-- ── M-2. Índices de FK nos caminhos quentes do marketplace ──
CREATE INDEX IF NOT EXISTS orders_store_id_idx          ON public.orders(store_id);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx       ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx      ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS order_items_store_product_idx ON public.order_items(store_product_id);
CREATE INDEX IF NOT EXISTS stores_owner_id_idx           ON public.stores(owner_id);

-- ── H-3. audit_logs.extra (usada pela função refund-payment) ─
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS extra jsonb;
  END IF;
END $$;

-- ============================================================
-- FIM da migration 009
-- ============================================================
