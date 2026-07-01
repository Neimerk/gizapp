-- ============================================================
-- Migration 017 — Subscription SaaS com Asaas real
-- Adiciona colunas para rastrear assinatura no gateway,
-- histórico de mudanças de plano e controle de inadimplência
-- ============================================================

-- ── 1. Enriquece subscriptions ───────────────────────────────

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS asaas_subscription_id text,
  ADD COLUMN IF NOT EXISTS asaas_customer_id      text,
  ADD COLUMN IF NOT EXISTS billing_cycle          text NOT NULL DEFAULT 'MONTHLY'
    CHECK (billing_cycle IN ('MONTHLY','YEARLY')),
  ADD COLUMN IF NOT EXISTS last_payment_date      date,
  ADD COLUMN IF NOT EXISTS last_payment_value     numeric(12,2),
  ADD COLUMN IF NOT EXISTS delinquent_since       date,
  ADD COLUMN IF NOT EXISTS cancellation_reason    text,
  ADD COLUMN IF NOT EXISTS cancelled_at           timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_at           timestamptz,
  ADD COLUMN IF NOT EXISTS reactivated_at         timestamptz,
  ADD COLUMN IF NOT EXISTS pending_plan           text;

CREATE INDEX IF NOT EXISTS subs_asaas_sub_idx    ON public.subscriptions(asaas_subscription_id)
  WHERE asaas_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS subs_next_billing_idx ON public.subscriptions(next_billing_date)
  WHERE status IN ('active','overdue');

-- ── 2. SUBSCRIPTION_EVENTS (histórico de planos) ─────────────

CREATE TABLE IF NOT EXISTS public.subscription_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_plan   text,
  to_plan     text        NOT NULL,
  from_status text,
  to_status   text,
  reason      text,
  triggered_by text       NOT NULL DEFAULT 'system'
                CHECK (triggered_by IN ('vendor','admin','system','webhook')),
  asaas_event text,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "se_vendor_own" ON public.subscription_events
  FOR SELECT USING (vendor_id = auth.uid());

CREATE POLICY "se_admin_all" ON public.subscription_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS se_vendor_idx    ON public.subscription_events(vendor_id);
CREATE INDEX IF NOT EXISTS se_created_idx   ON public.subscription_events(created_at DESC);

GRANT ALL    ON public.subscription_events TO service_role;
GRANT SELECT ON public.subscription_events TO authenticated;

-- ── 3. Função: change_subscription_plan ─────────────────────
CREATE OR REPLACE FUNCTION public.change_subscription_plan(
  p_vendor_id   uuid,
  p_to_plan     text,
  p_to_status   text,
  p_reason      text       DEFAULT NULL,
  p_triggered   text       DEFAULT 'system',
  p_asaas_event text       DEFAULT NULL,
  p_metadata    jsonb      DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_current record;
  v_price   numeric(12,2);
  v_rate    numeric(5,4);
BEGIN
  SELECT plan, status INTO v_current
  FROM public.subscriptions WHERE vendor_id = p_vendor_id;

  SELECT monthly_price, commission_rate INTO v_price, v_rate
  FROM public.vendor_plans WHERE id = p_to_plan;

  -- Atualiza subscription
  UPDATE public.subscriptions SET
    plan             = p_to_plan,
    status           = p_to_status,
    monthly_price    = COALESCE(v_price, monthly_price),
    commission_rate  = COALESCE(v_rate, commission_rate),
    cancellation_reason = CASE WHEN p_to_status = 'cancelled' THEN p_reason ELSE cancellation_reason END,
    cancelled_at     = CASE WHEN p_to_status = 'cancelled' THEN now() ELSE cancelled_at END,
    suspended_at     = CASE WHEN p_to_status = 'suspended' THEN now() ELSE suspended_at END,
    reactivated_at   = CASE WHEN p_to_status = 'active' AND status != 'active' THEN now() ELSE reactivated_at END
  WHERE vendor_id = p_vendor_id;

  -- Registra evento
  INSERT INTO public.subscription_events (
    vendor_id, from_plan, to_plan, from_status, to_status,
    reason, triggered_by, asaas_event, metadata
  ) VALUES (
    p_vendor_id, v_current.plan, p_to_plan,
    v_current.status, p_to_status,
    p_reason, p_triggered, p_asaas_event, p_metadata
  );

  -- Log financeiro
  PERFORM public.log_financial_event(
    'system', p_vendor_id, 'subscription_plan_change',
    'subscriptions', NULL,
    v_price,
    'Plano ' || COALESCE(v_current.plan,'?') || ' → ' || p_to_plan,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_subscription_plan TO service_role;

-- ── 4. Função: handle_subscription_overdue ──────────────────
-- Chamada pelo subscriptions-webhook quando PAYMENT_OVERDUE
CREATE OR REPLACE FUNCTION public.handle_subscription_overdue(
  p_vendor_id      uuid,
  p_asaas_sub_id   text,
  p_days_overdue   int DEFAULT 0
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sub record;
BEGIN
  SELECT * INTO v_sub FROM public.subscriptions WHERE vendor_id = p_vendor_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Marca inadimplente
  UPDATE public.subscriptions SET
    status           = CASE WHEN p_days_overdue >= 30 THEN 'suspended' ELSE 'overdue' END,
    delinquent_since = COALESCE(delinquent_since, CURRENT_DATE)
  WHERE vendor_id = p_vendor_id;

  PERFORM public.log_financial_event(
    'system', p_vendor_id, 'subscription_overdue',
    'subscriptions', NULL, NULL,
    'Assinatura inadimplente há ' || p_days_overdue || ' dias',
    jsonb_build_object('asaas_subscription_id', p_asaas_sub_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_subscription_overdue TO service_role;

-- ── 5. Garante subscription free para sellers sem plano ──────
INSERT INTO public.subscriptions (vendor_id, plan, monthly_price, commission_rate, status)
SELECT p.id, 'free', 0.00, 0.12, 'active'
FROM   public.profiles p
WHERE  p.role = 'seller'
ON CONFLICT (vendor_id) DO NOTHING;
