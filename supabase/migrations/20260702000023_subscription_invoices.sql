-- ============================================================
-- Migration 023 — Tabela subscription_invoices
--
-- Substitui o uso de subscription_events como proxy de faturas.
-- Cada ciclo de cobrança de plano gera uma linha aqui, vinculada
-- ao pagamento Asaas correspondente para reconciliação.
--
-- brasux-loja (gizApi.ts getInvoices) lê desta tabela.
-- subscriptions-webhook insere/atualiza ao receber eventos Asaas.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.subscription_invoices (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id             uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id       uuid          NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  plan                  text          NOT NULL REFERENCES public.vendor_plans(id),
  period_start          date          NOT NULL,
  period_end            date          NOT NULL,
  amount                numeric(12,2) NOT NULL DEFAULT 0,
  status                text          NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','paid','overdue','cancelled','refunded')),
  asaas_payment_id      text,
  asaas_subscription_id text,
  gateway_response      jsonb,
  paid_at               timestamptz,
  due_date              date,
  description           text,
  idempotency_key       text UNIQUE,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now()
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS si_vendor_idx      ON public.subscription_invoices (vendor_id);
CREATE INDEX IF NOT EXISTS si_sub_idx         ON public.subscription_invoices (subscription_id);
CREATE INDEX IF NOT EXISTS si_status_idx      ON public.subscription_invoices (status)
  WHERE status IN ('pending', 'overdue');
CREATE INDEX IF NOT EXISTS si_asaas_pay_idx   ON public.subscription_invoices (asaas_payment_id)
  WHERE asaas_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS si_created_idx     ON public.subscription_invoices (created_at DESC);

-- ── updated_at automático ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS si_updated_at ON public.subscription_invoices;
CREATE TRIGGER si_updated_at
  BEFORE UPDATE ON public.subscription_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "si_vendor_own" ON public.subscription_invoices
  FOR SELECT USING (vendor_id = auth.uid());

CREATE POLICY "si_admin_all" ON public.subscription_invoices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── Permissões ────────────────────────────────────────────────
GRANT ALL    ON public.subscription_invoices TO service_role;
GRANT SELECT ON public.subscription_invoices TO authenticated;

-- ── Backfill a partir de subscription_events ─────────────────
-- Cria uma fatura por evento de pagamento de plano pago
-- (eventos sem valor de amount no metadata são ignorados)
INSERT INTO public.subscription_invoices (
  id, vendor_id, subscription_id, plan,
  period_start, period_end, amount, status,
  description, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  se.vendor_id,
  s.id AS subscription_id,
  se.to_plan,
  (se.created_at::date)                                       AS period_start,
  (se.created_at::date + interval '1 month')::date            AS period_end,
  COALESCE((se.metadata->>'amount')::numeric, 0)              AS amount,
  'paid'                                                       AS status,
  'Plano ' || se.to_plan || ' — ciclo ' || to_char(se.created_at, 'MM/YYYY') AS description,
  se.created_at,
  se.created_at
FROM public.subscription_events se
JOIN public.subscriptions s ON s.vendor_id = se.vendor_id
WHERE (se.metadata->>'amount')::numeric > 0
ON CONFLICT (idempotency_key) DO NOTHING;

-- ── Função: create_subscription_invoice ──────────────────────
-- Chamada pelo subscriptions-webhook ao registrar pagamento de plano
CREATE OR REPLACE FUNCTION public.create_subscription_invoice(
  p_vendor_id           uuid,
  p_plan                text,
  p_amount              numeric(12,2),
  p_asaas_payment_id    text    DEFAULT NULL,
  p_asaas_sub_id        text    DEFAULT NULL,
  p_due_date            date    DEFAULT NULL,
  p_description         text    DEFAULT NULL,
  p_gateway_response    jsonb   DEFAULT NULL,
  p_idempotency_key     text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sub_id  uuid;
  v_inv_id  uuid;
BEGIN
  SELECT id INTO v_sub_id
  FROM public.subscriptions
  WHERE vendor_id = p_vendor_id;

  IF v_sub_id IS NULL THEN
    RAISE EXCEPTION 'Subscription not found for vendor %', p_vendor_id;
  END IF;

  INSERT INTO public.subscription_invoices (
    vendor_id, subscription_id, plan,
    period_start, period_end, amount, status,
    asaas_payment_id, asaas_subscription_id,
    gateway_response, due_date, paid_at, description, idempotency_key
  ) VALUES (
    p_vendor_id, v_sub_id, p_plan,
    CURRENT_DATE, (CURRENT_DATE + interval '1 month')::date,
    p_amount, 'pending',
    p_asaas_payment_id, p_asaas_sub_id,
    p_gateway_response, p_due_date, NULL, p_description, p_idempotency_key
  )
  ON CONFLICT (idempotency_key) DO UPDATE SET
    asaas_payment_id   = EXCLUDED.asaas_payment_id,
    gateway_response   = EXCLUDED.gateway_response,
    updated_at         = now()
  RETURNING id INTO v_inv_id;

  RETURN v_inv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_subscription_invoice TO service_role;

-- ── Função: mark_subscription_invoice_paid ───────────────────
CREATE OR REPLACE FUNCTION public.mark_subscription_invoice_paid(
  p_asaas_payment_id text,
  p_paid_at          timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.subscription_invoices SET
    status   = 'paid',
    paid_at  = p_paid_at,
    updated_at = now()
  WHERE asaas_payment_id = p_asaas_payment_id
    AND status IN ('pending', 'overdue');
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_subscription_invoice_paid TO service_role;
