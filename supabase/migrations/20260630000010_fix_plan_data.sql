-- ============================================================
-- BrasUX Migration 010 — Corrige dados de planos
-- ============================================================

-- ── 1. Migra linhas 'premium' → 'pro' antes de alterar o CHECK ──
UPDATE public.subscriptions SET plan = 'pro' WHERE plan = 'premium';

-- ── 2. Recria CHECK constraint sem 'premium' ─────────────────
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_check
    CHECK (plan IN ('free','start','pro','whitelabel'));

-- ── 3. Corrige vendor_plans ───────────────────────────────────
-- Taxas de comissão e limite de produtos estavam inconsistentes
-- com a Edge Function create-subscription e o gating de produto.

UPDATE public.vendor_plans SET
  commission_rate = 0.12,
  max_products    = 50,
  features        = ARRAY['Até 50 produtos','Suporte por e-mail','12% comissão por venda']
WHERE id = 'free';

UPDATE public.vendor_plans SET
  commission_rate = 0.09,
  max_products    = 300,
  monthly_price   = 49.00,
  features        = ARRAY['Até 300 produtos','Suporte prioritário','9% comissão por venda']
WHERE id = 'start';

UPDATE public.vendor_plans SET
  commission_rate = 0.07,
  max_products    = 1000,
  monthly_price   = 99.00,
  features        = ARRAY['Até 1.000 produtos','Analytics','Suporte 24h','7% comissão por venda']
WHERE id = 'pro';

UPDATE public.vendor_plans SET
  commission_rate = 0.05,
  max_products    = NULL,
  features        = ARRAY['Produtos ilimitados','Domínio próprio','Acesso à API','5% comissão por venda']
WHERE id = 'whitelabel';
