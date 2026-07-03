-- =====================================================================
-- Melhorias de integridade financeira: cupons + pontos
--
-- 1. Adiciona coupon_id + points_discount à tabela orders para rastreamento
--    e possibilitar estorno de reserva sem estado externo.
--
-- 2. release_coupon_for_order — libera reserva de cupom quando o pagamento
--    falha/expira (decrementa uses_count + remove de user_coupons).
--
-- 3. spend_points_for_order — debita pontos de forma idempotente quando o
--    pagamento é confirmado pelo webhook (não mais no create-order).
--
-- 4. expire_stale_orders — expira pedidos pendentes sem pagamento:
--    PIX (>35min), Boleto (>4 dias), Cartão (>30min). Libera cupom.
--
-- 5. Concede EXECUTE de service_role para as funções acima.
-- =====================================================================

-- ── 1. Colunas em orders ─────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_id        uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS points_discount  numeric(12,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS orders_coupon_id_idx ON public.orders(coupon_id)
  WHERE coupon_id IS NOT NULL;

-- ── 2. release_coupon_for_order ──────────────────────────────────────
-- Chamada quando um pedido não é pago (recusado, vencido, expirado, deletado).
-- Desfaz a reserva do cupom para que o usuário possa reutilizá-lo.
CREATE OR REPLACE FUNCTION public.release_coupon_for_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_coupon_id   uuid;
  v_customer_id uuid;
BEGIN
  SELECT coupon_id, customer_id
  INTO   v_coupon_id, v_customer_id
  FROM   public.orders
  WHERE  id = p_order_id;

  IF NOT FOUND OR v_coupon_id IS NULL THEN RETURN; END IF;

  -- Decrementa uses_count (idempotente — nunca cai abaixo de 0)
  UPDATE public.coupons
  SET    uses_count = GREATEST(0, uses_count - 1),
         updated_at = now()
  WHERE  id = v_coupon_id;

  -- Remove rastreamento individual de uso (permite reutilizar em novo pedido)
  IF v_customer_id IS NOT NULL THEN
    DELETE FROM public.user_coupons
    WHERE  user_id   = v_customer_id
      AND  coupon_id = v_coupon_id;
  END IF;

  -- Zera coupon_id para evitar dupla liberação
  UPDATE public.orders SET coupon_id = NULL WHERE id = p_order_id;
END;
$$;

-- ── 3. spend_points_for_order ────────────────────────────────────────
-- Debita pontos de fidelidade quando o pagamento é confirmado.
-- Idempotente: não debita se já existe transação de saída para este pedido.
-- Chamada pelo marketplace-webhook (PAYMENT_CONFIRMED) e reconcile-payments.
CREATE OR REPLACE FUNCTION public.spend_points_for_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_customer_id    uuid;
  v_points         numeric;
BEGIN
  SELECT customer_id, points_discount
  INTO   v_customer_id, v_points
  FROM   public.orders
  WHERE  id = p_order_id;

  IF NOT FOUND OR v_customer_id IS NULL OR v_points <= 0 THEN RETURN; END IF;

  -- Não debita se já existe transação de débito para este pedido (idempotência)
  IF EXISTS (
    SELECT 1 FROM public.point_transactions
    WHERE  order_id = p_order_id AND amount < 0
  ) THEN RETURN; END IF;

  PERFORM public.spend_points(
    p_user_id     := v_customer_id,
    p_amount      := v_points::int,
    p_description := 'Desconto em pedido #' || UPPER(LEFT(p_order_id::text, 8)),
    p_order_id    := p_order_id
  );
END;
$$;

-- ── 4. expire_stale_orders ───────────────────────────────────────────
-- Expira pedidos pendentes de pagamento após o vencimento de cada método:
--   PIX:         >35 min  (PIX expira em 30 min + buffer)
--   Boleto:      >4 dias  (vence em 3 dias + buffer)
--   Cartão:      >30 min  (cobrança é instantânea; se ficou pendente, falhou)
-- Para cada pedido: libera o cupom e marca como expirado (status=5).
-- Retorna o número de pedidos expirados.
CREATE OR REPLACE FUNCTION public.expire_stale_orders()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order  record;
  v_count  integer := 0;
BEGIN
  FOR v_order IN
    SELECT id, coupon_id
    FROM   public.orders
    WHERE  status = 0
      AND  payment_status IN ('pending', 'PENDING')
      AND  (
        (payment_method = 'pix'         AND created_at < now() - interval '35 minutes')
        OR (payment_method = 'boleto'   AND created_at < now() - interval '4 days')
        OR (payment_method = 'credit_card' AND created_at < now() - interval '30 minutes')
      )
  LOOP
    IF v_order.coupon_id IS NOT NULL THEN
      PERFORM public.release_coupon_for_order(v_order.id);
    END IF;

    UPDATE public.orders
    SET    status         = 5,
           payment_status = 'EXPIRED',
           updated_at     = now()
    WHERE  id = v_order.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ── 5. Grants para service_role ──────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.release_coupon_for_order  TO service_role;
GRANT EXECUTE ON FUNCTION public.spend_points_for_order    TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_stale_orders       TO service_role;
-- spend_points foi definido sem grant para service_role na migration original
GRANT EXECUTE ON FUNCTION public.spend_points              TO service_role;

-- ── 6. pg_cron: expirar pedidos estagnados a cada 15 minutos ─────────
-- Garante que PIX expirado (>35min), boleto vencido (>4 dias) e
-- cartão sem resposta (>30min) sejam finalizados e cupons liberados.
-- Remove job anterior se existir (idempotente).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-stale-orders') THEN
      PERFORM cron.unschedule('expire-stale-orders');
    END IF;
    PERFORM cron.schedule(
      'expire-stale-orders',
      '*/15 * * * *',
      'SELECT public.expire_stale_orders()'
    );
  END IF;
END;
$$;
