-- =============================================================================
-- BUG FIX: expire_stale_orders — 'credit_card' → 'card'
--
-- EVIDÊNCIA:
--   create-order/index.ts linha 96:
--     const ALLOWED_METHODS = new Set(["pix", "card", "boleto"]);
--   CheckoutPage.tsx linha 183:
--     useState<PaymentMethod>(..."card"...)
--
--   Portanto orders.payment_method é armazenado como "card".
--   expire_stale_orders (definida em migrações 039 e 110) checa:
--     payment_method = 'credit_card'
--   → NUNCA casa. Pedidos de cartão com pagamento falhado jamais expiram
--     e o estoque reservado vaza indefinidamente.
-- =============================================================================

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
        -- PIX expira em 30 min; buffer de 5 min
        (payment_method = 'pix'     AND created_at < now() - interval '35 minutes')
        -- Boleto vence em 3 dias; buffer de 1 dia
        OR (payment_method = 'boleto' AND created_at < now() - interval '4 days')
        -- Cartão: cobrança é síncrona; se ficou pending por >30min algo falhou
        -- FIX: era 'credit_card' — o valor armazenado é 'card' (ver create-order)
        OR (payment_method = 'card'   AND created_at < now() - interval '30 minutes')
      )
  LOOP
    -- Libera cupom (idempotente)
    IF v_order.coupon_id IS NOT NULL THEN
      PERFORM public.release_coupon_for_order(v_order.id);
    END IF;

    -- Restaura estoque reservado (idempotente)
    PERFORM public.release_stock_for_order(v_order.id);

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

GRANT EXECUTE ON FUNCTION public.expire_stale_orders() TO service_role;

-- Índice parcial para acelerar o scan de expiração (evita seq scan em orders)
-- Filtra apenas pedidos pendentes de pagamento — cardinalidade baixa em operação normal.
CREATE INDEX IF NOT EXISTS idx_orders_expire_scan
  ON public.orders (payment_method, created_at)
  WHERE status = 0 AND payment_status IN ('pending', 'PENDING');
