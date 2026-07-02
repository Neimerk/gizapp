-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 024: Depreca modelo de comissão por venda
--
-- Decisão de negócio (Etapa 1 — 2026-07-02):
--   A receita da BrasUX passa a ser EXCLUSIVAMENTE mensalidade fixa.
--   A comissão percentual sobre vendas (commission_rate) é zerada para todos
--   os planos e futuras assinaturas não terão esse campo como fonte de receita.
--
-- Planos canônicos migrados (ver migration 021 em brasux-entregas):
--   free/start → basico   (R$ 49,90/mês)
--   pro        → premium  (R$ 99,90/mês)
--   premium    → premium  (mantém)
--   whitelabel → whitelabel (mantém)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Zera commission_rate para todos os assinantes ativos
UPDATE public.subscriptions
   SET commission_rate = 0
 WHERE commission_rate != 0;

-- 2. Remove o CHECK antigo que permitia até 100% e adiciona constraint de zero
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_commission_rate_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_commission_rate_zero
    CHECK (commission_rate = 0);

-- 3. Atualiza default para 0 (novas assinaturas não herdam o 0.08 antigo)
ALTER TABLE public.subscriptions
  ALTER COLUMN commission_rate SET DEFAULT 0;

-- 4. Atualiza a função que calcula comissão nas ordens para retornar 0
--    (mantida para compatibilidade, mas nunca deve ser chamada com valor > 0)
CREATE OR REPLACE FUNCTION public.get_vendor_commission_rate(p_vendor_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Modelo pure-subscription: comissão = 0 sempre.
  -- Taxa fixa por pedido também = 0 para assinantes.
  -- Receita da BrasUX vem exclusivamente da mensalidade.
  SELECT 0::numeric;
$$;

REVOKE ALL ON FUNCTION public.get_vendor_commission_rate(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vendor_commission_rate(uuid) TO authenticated, service_role;
