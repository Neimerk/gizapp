-- =====================================================================
-- Migration 043 — Correções de produção
--
-- BUG-03: reverse_split_on_refund — estorno parcial revertia 100% das
--   transações HELD, independente do valor do estorno. Corrigido para
--   calcular a proporção e debitar apenas o valor correspondente.
--
--   Comportamento anterior (errado):
--     Estorno de R$50 em pedido R$200 → reverte R$200 de HELD do vendor
--
--   Comportamento correto:
--     Estorno total (ratio ≥ 99.9%): marca HELD como 'reversed' (sem mover saldo)
--     Estorno parcial              : insere débito proporcional + mantém HELD restante
--
-- Nota: chargebacks pós-entrega (status='available') continuam absorvidos
-- pela plataforma por design — vendor/courier não são debitados retroativamente.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.reverse_split_on_refund(
  p_order_id    uuid,
  p_refund_id   uuid,
  p_absorbed_by text DEFAULT 'brasux'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sr           record;
  v_refund_amt   numeric(12,2);
  v_order_total  numeric(12,2);
  v_ratio        numeric(10,6) := 1.0;
  v_reversed     int           := 0;
  v_absorbed     numeric(12,2) := 0;
BEGIN
  SELECT * INTO v_sr FROM public.split_rules WHERE order_id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'no_split_found'); END IF;

  -- Busca valor do estorno e total do pedido para calcular proporção
  SELECT r.amount, o.total
  INTO   v_refund_amt, v_order_total
  FROM   public.refunds r
  JOIN   public.orders  o ON o.id = r.order_id
  WHERE  r.id = p_refund_id;

  IF v_order_total > 0 THEN
    v_ratio := LEAST(1.0, v_refund_amt / v_order_total);
  END IF;

  IF v_ratio >= 0.999 THEN
    -- Estorno total: marca transações HELD como 'reversed'
    -- (não cria débito — saldo HELD já não era disponível ao vendor/courier)
    UPDATE public.wallet_transactions
    SET    status   = 'reversed',
           metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('refund_id', p_refund_id)
    WHERE  order_id  = p_order_id
      AND  direction = 'in'
      AND  status    = 'held';

    GET DIAGNOSTICS v_reversed = ROW_COUNT;
  ELSE
    -- Estorno parcial: insere débito proporcional nas wallets que ainda têm HELD
    -- O registro HELD original é mantido; o débito parcial reduz o saldo efetivo
    INSERT INTO public.wallet_transactions
      (wallet_id, order_id, refund_id, type, amount, direction, status, description)
    SELECT
      wallet_id,
      p_order_id,
      p_refund_id,
      'refund',
      ROUND(amount * v_ratio, 2),
      'out',
      'completed',
      'Estorno parcial (' || ROUND(v_ratio * 100, 1) || '%) — Pedido #' || UPPER(LEFT(p_order_id::text, 8))
    FROM public.wallet_transactions
    WHERE order_id  = p_order_id
      AND direction = 'in'
      AND status    = 'held'
      AND ROUND(amount * v_ratio, 2) > 0;

    GET DIAGNOSTICS v_reversed = ROW_COUNT;
  END IF;

  -- Absorção pela plataforma proporcional ao valor do estorno
  IF p_absorbed_by = 'brasux' AND v_sr.platform_wallet_id IS NOT NULL THEN
    v_absorbed := ROUND(
      (COALESCE(v_sr.vendor_net, 0)
     + COALESCE(v_sr.delivery_amount, 0)
     + COALESCE(v_sr.service_fee, 0)) * v_ratio,
      2
    );

    IF v_absorbed > 0 THEN
      INSERT INTO public.wallet_transactions (
        wallet_id, order_id, refund_id, type, amount, direction, status, description
      ) VALUES (
        v_sr.platform_wallet_id, p_order_id, p_refund_id,
        'refund', v_absorbed, 'out', 'completed',
        'Absorção estorno ' || ROUND(v_ratio * 100, 1) || '% — Pedido #' || UPPER(LEFT(p_order_id::text, 8))
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'status',   'reversed',
    'rows',     v_reversed,
    'absorbed', v_absorbed,
    'ratio',    ROUND(v_ratio, 4)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reverse_split_on_refund(uuid, uuid, text) TO service_role;
