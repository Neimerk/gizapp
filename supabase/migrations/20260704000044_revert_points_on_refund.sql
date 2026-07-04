-- =====================================================================
-- Migration 044 — revert_points_on_refund
--
-- Problema: quando um pedido é estornado, os pontos de fidelidade
-- ganhos (earn_points_on_payment) e retornados como desconto
-- (spend_points_for_order) não eram revertidos — o comprador
-- ficava com os pontos mesmo após receber o dinheiro de volta.
--
-- Lógica:
--   point_transactions.amount > 0 → pontos ganhos → reverter (debitar)
--   point_transactions.amount < 0 → pontos usados como desconto → reverter (devolver)
--
-- Em ambos os casos: inserir o inverso e atualizar user_points.balance.
-- Idempotente: não reverte se já existir transação de estorno para o pedido.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.revert_points_on_refund(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tx record;
BEGIN
  -- Idempotência: já existem transações de estorno para este pedido?
  IF EXISTS (
    SELECT 1 FROM public.point_transactions
    WHERE  order_id    = p_order_id
      AND  description LIKE 'Estorno pontos%'
  ) THEN RETURN; END IF;

  -- Para cada transação de ponto deste pedido, insere o inverso e ajusta o saldo
  FOR v_tx IN
    SELECT user_id, amount
    FROM   public.point_transactions
    WHERE  order_id = p_order_id
      AND  amount  <> 0
  LOOP
    INSERT INTO public.point_transactions (user_id, order_id, amount, description)
    VALUES (
      v_tx.user_id,
      p_order_id,
      -v_tx.amount,
      'Estorno pontos — Pedido #' || UPPER(LEFT(p_order_id::text, 8))
    );

    -- Atualiza saldo: balance - v_tx.amount
    --   earned (+100) → balance - 100 (debita pontos ganhos)
    --   spent  (- 50) → balance - (-50) = balance + 50 (devolve pontos usados)
    UPDATE public.user_points
    SET    balance = GREATEST(0, balance - v_tx.amount)
    WHERE  user_id = v_tx.user_id;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revert_points_on_refund(uuid) TO service_role;
