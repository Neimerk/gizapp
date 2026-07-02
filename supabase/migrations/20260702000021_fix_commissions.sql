-- ============================================================
-- Migration 021 — Corrigir comissões e labels dos planos
-- Fonte única: free=8%, básico=5%, premium=3%, whitelabel=0%
-- ============================================================

UPDATE public.vendor_plans SET
  label           = 'Gratuito',
  monthly_price   = 0.00,
  commission_rate = 0.08,
  features        = ARRAY['Até 30 produtos','8% de comissão por venda','Suporte por e-mail']
WHERE id = 'free';

UPDATE public.vendor_plans SET
  label           = 'Básico',
  monthly_price   = 49.90,
  commission_rate = 0.05,
  features        = ARRAY['Até 200 produtos','5% de comissão por venda','Suporte prioritário']
WHERE id = 'start';

UPDATE public.vendor_plans SET
  label           = 'Premium',
  monthly_price   = 99.90,
  commission_rate = 0.03,
  features        = ARRAY['Produtos ilimitados','3% de comissão por venda','Analytics','Suporte 24h']
WHERE id = 'pro';

UPDATE public.vendor_plans SET
  label           = 'White Label',
  monthly_price   = 199.90,
  commission_rate = 0.00,
  features        = ARRAY['Produtos ilimitados','0% de comissão','Domínio próprio','Acesso à API']
WHERE id = 'whitelabel';

-- Propaga a correção para assinaturas ativas (garante consistência no split futuro)
UPDATE public.subscriptions s
SET
  commission_rate = vp.commission_rate,
  monthly_price   = vp.monthly_price
FROM public.vendor_plans vp
WHERE s.plan = vp.id;
