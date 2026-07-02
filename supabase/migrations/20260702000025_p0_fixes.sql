-- ============================================================
-- Migration 025 — Correções P0
--
-- 1. Zera vendor_plans.commission_rate para todos os planos.
--    (migration 021 setou free=8%, start=5%, pro=3%; migration 024
--     adicionou CHECK(commission_rate=0) em subscriptions, então
--     change_subscription_plan violaria a constraint ao ler da tabela)
--
-- 2. Recria change_subscription_plan sem atualizar commission_rate.
--
-- 3. Cria get_vendor_subscription_by_owner — função ausente que
--    brasux-loja/wallet.ts precisa para exibir assinatura do lojista.
-- ============================================================

-- ── 1. Zera commission_rate na tabela de planos ──────────────
UPDATE public.vendor_plans SET commission_rate = 0;

-- ── 2. Recria change_subscription_plan (sem commission_rate) ─
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
BEGIN
  SELECT plan, status INTO v_current
  FROM public.subscriptions WHERE vendor_id = p_vendor_id;

  SELECT monthly_price INTO v_price
  FROM public.vendor_plans WHERE id = p_to_plan;

  UPDATE public.subscriptions SET
    plan             = p_to_plan,
    status           = p_to_status,
    monthly_price    = COALESCE(v_price, monthly_price),
    cancellation_reason = CASE WHEN p_to_status = 'cancelled'
                               THEN p_reason ELSE cancellation_reason END,
    cancelled_at     = CASE WHEN p_to_status = 'cancelled'
                            THEN now() ELSE cancelled_at END,
    suspended_at     = CASE WHEN p_to_status = 'suspended'
                            THEN now() ELSE suspended_at END,
    reactivated_at   = CASE WHEN p_to_status = 'active' AND status != 'active'
                            THEN now() ELSE reactivated_at END
  WHERE vendor_id = p_vendor_id;

  INSERT INTO public.subscription_events (
    vendor_id, from_plan, to_plan, from_status, to_status,
    reason, triggered_by, asaas_event, metadata
  ) VALUES (
    p_vendor_id, v_current.plan, p_to_plan,
    v_current.status, p_to_status,
    p_reason, p_triggered, p_asaas_event, p_metadata
  );

  PERFORM public.log_financial_event(
    'system', p_vendor_id, 'subscription_plan_change',
    'subscriptions', NULL,
    v_price,
    'Plano ' || COALESCE(v_current.plan, '?') || ' → ' || p_to_plan,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_subscription_plan TO service_role;

-- ── 3. Cria get_vendor_subscription_by_owner ─────────────────
-- Retorna assinatura do lojista em formato que brasux-loja espera:
--   plan_slug: "basico"|"premium"|"whitelabel"|null
--   status:    "trialing"|"active"|"past_due"|"cancelled"|"incomplete"
--   features:  objeto jsonb com capabilities do plano
CREATE OR REPLACE FUNCTION public.get_vendor_subscription_by_owner(
  p_owner_id uuid
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub    record;
  v_slug   text;
  v_status text;
  v_feat   jsonb;
BEGIN
  SELECT * INTO v_sub
  FROM public.subscriptions
  WHERE vendor_id = p_owner_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- DB slugs (free/start/pro/whitelabel) → UI slugs (basico/premium/whitelabel)
  v_slug := CASE v_sub.plan
    WHEN 'start'      THEN 'basico'
    WHEN 'pro'        THEN 'premium'
    WHEN 'whitelabel' THEN 'whitelabel'
    ELSE NULL
  END;

  -- DB statuses → UI statuses esperados por VendorSubscription
  v_status := CASE v_sub.status
    WHEN 'trial'     THEN 'trialing'
    WHEN 'active'    THEN 'active'
    WHEN 'overdue'   THEN 'past_due'
    WHEN 'suspended' THEN 'cancelled'
    WHEN 'cancelled' THEN 'cancelled'
    WHEN 'inactive'  THEN 'cancelled'
    ELSE 'incomplete'
  END;

  -- Capabilities por plano
  v_feat := CASE v_sub.plan
    WHEN 'start' THEN jsonb_build_object(
      'realtime_tracking', true,
      'chat',              true,
      'analytics',         'basic',
      'api_access',        false,
      'support',           'email',
      'priority_dispatch', false
    )
    WHEN 'pro' THEN jsonb_build_object(
      'realtime_tracking', true,
      'chat',              true,
      'analytics',         'full',
      'api_access',        true,
      'support',           'priority',
      'priority_dispatch', true
    )
    WHEN 'whitelabel' THEN jsonb_build_object(
      'realtime_tracking', true,
      'chat',              true,
      'analytics',         'full',
      'api_access',        true,
      'support',           'dedicated',
      'priority_dispatch', true,
      'custom_reports',    true
    )
    ELSE jsonb_build_object(
      'realtime_tracking', false,
      'chat',              false,
      'analytics',         'basic',
      'api_access',        false,
      'support',           'email',
      'priority_dispatch', false
    )
  END;

  RETURN jsonb_build_object(
    'subscription_id',    v_sub.id,
    'plan_slug',          v_slug,
    'plan_name',          CASE v_sub.plan
                            WHEN 'free'       THEN 'Gratuito'
                            WHEN 'start'      THEN 'Básico'
                            WHEN 'pro'        THEN 'Premium'
                            WHEN 'whitelabel' THEN 'White Label'
                            ELSE v_sub.plan
                          END,
    'status',             v_status,
    'monthly_price',      v_sub.monthly_price,
    'current_period_end', v_sub.next_billing_date,
    'trial_end',          NULL,
    'features',           v_feat
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_vendor_subscription_by_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vendor_subscription_by_owner(uuid) TO authenticated, service_role;
