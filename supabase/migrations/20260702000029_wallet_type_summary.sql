-- =====================================================================
-- Função para resumo de saldos de carteiras por tipo.
-- Usada pelo financial-dashboard (que não pode ler colunas físicas
-- que não existem — wallets tem apenas id/owner_id/wallet_type/currency).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_wallet_type_summary()
RETURNS TABLE (wallet_type text, available numeric, held numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    w.wallet_type,
    COALESCE(SUM(
      CASE
        WHEN wt.direction = 'in'  AND wt.status = 'available' THEN  wt.amount
        WHEN wt.direction = 'out' AND wt.status = 'completed'  THEN -wt.amount
        ELSE 0
      END
    ), 0) AS available,
    COALESCE(SUM(
      CASE
        WHEN wt.direction = 'in' AND wt.status = 'held' THEN wt.amount
        ELSE 0
      END
    ), 0) AS held
  FROM public.wallets w
  LEFT JOIN public.wallet_transactions wt ON wt.wallet_id = w.id
  GROUP BY w.wallet_type;
$$;

GRANT EXECUTE ON FUNCTION public.get_wallet_type_summary() TO service_role;
