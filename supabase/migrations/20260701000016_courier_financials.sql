-- ============================================================
-- Migration 016 — Financeiro dos entregadores
-- courier_earnings: log formal de ganhos (compatível com gizApi existente)
-- courier_incentives: campanhas de bonificação
-- ============================================================

-- ── 1. COURIER_EARNINGS ──────────────────────────────────────
-- Compatível com inserts existentes em gizApi.ts (courier_id, delivery_id, amount, description)
CREATE TABLE IF NOT EXISTS public.courier_earnings (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id    uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delivery_id   uuid,                    -- sem FK: deliveries pode não estar migrada
  order_id      uuid          REFERENCES public.orders(id) ON DELETE SET NULL,
  amount        numeric(12,2) NOT NULL CHECK (amount >= 0),
  description   text          NOT NULL DEFAULT '',
  -- Campos estendidos (usados pelo novo sistema)
  platform_fee  numeric(12,2) NOT NULL DEFAULT 0,
  bonus_amount  numeric(12,2) NOT NULL DEFAULT 0,
  type          text          NOT NULL DEFAULT 'delivery'
                  CHECK (type IN ('delivery','bonus','incentive','cashback','adjustment')),
  status        text          NOT NULL DEFAULT 'available'
                  CHECK (status IN ('held','available','paid','reversed')),
  paid_at       timestamptz,
  metadata      jsonb,
  created_at    timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.courier_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ce_courier_own"  ON public.courier_earnings
  FOR SELECT USING (courier_id = auth.uid());

CREATE POLICY "ce_courier_insert" ON public.courier_earnings
  FOR INSERT WITH CHECK (courier_id = auth.uid());

CREATE POLICY "ce_admin_all" ON public.courier_earnings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS ce_courier_idx    ON public.courier_earnings(courier_id);
CREATE INDEX IF NOT EXISTS ce_delivery_idx   ON public.courier_earnings(delivery_id);
CREATE INDEX IF NOT EXISTS ce_order_idx      ON public.courier_earnings(order_id);
CREATE INDEX IF NOT EXISTS ce_status_idx     ON public.courier_earnings(status);
CREATE INDEX IF NOT EXISTS ce_created_at_idx ON public.courier_earnings(created_at DESC);

GRANT ALL    ON public.courier_earnings TO service_role;
GRANT SELECT, INSERT ON public.courier_earnings TO authenticated;

-- ── 2. COURIER_INCENTIVES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.courier_incentives (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text          NOT NULL,
  description     text,
  type            text          NOT NULL
                    CHECK (type IN ('per_delivery','daily_target','weekly_target','peak_hours','bonus')),
  bonus_amount    numeric(12,2) NOT NULL DEFAULT 0 CHECK (bonus_amount >= 0),
  bonus_percent   numeric(5,4)  NOT NULL DEFAULT 0 CHECK (bonus_percent BETWEEN 0 AND 1),
  min_deliveries  int,
  active          bool          NOT NULL DEFAULT true,
  starts_at       timestamptz   NOT NULL DEFAULT now(),
  ends_at         timestamptz,
  metadata        jsonb,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.courier_incentives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ci_courier_read" ON public.courier_incentives
  FOR SELECT USING (
    active = true AND (ends_at IS NULL OR ends_at > now())
  );

CREATE POLICY "ci_admin_all" ON public.courier_incentives
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS ci_active_idx ON public.courier_incentives(active, starts_at, ends_at);

GRANT ALL    ON public.courier_incentives TO service_role;
GRANT SELECT ON public.courier_incentives TO authenticated;

-- ── 3. COURIER_INCENTIVE_GRANTS ──────────────────────────────
-- Registra bônus concedidos a entregadores
CREATE TABLE IF NOT EXISTS public.courier_incentive_grants (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id    uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  incentive_id  uuid          NOT NULL REFERENCES public.courier_incentives(id),
  earning_id    uuid          REFERENCES public.courier_earnings(id),
  amount        numeric(12,2) NOT NULL,
  description   text,
  granted_at    timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.courier_incentive_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cig_courier_own" ON public.courier_incentive_grants
  FOR SELECT USING (courier_id = auth.uid());

CREATE POLICY "cig_admin_all" ON public.courier_incentive_grants
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

GRANT ALL ON public.courier_incentive_grants TO service_role;
GRANT SELECT ON public.courier_incentive_grants TO authenticated;

-- ── 4. Função: crédito de entregador após delivery ───────────
CREATE OR REPLACE FUNCTION public.credit_courier_earning(
  p_courier_id   uuid,
  p_delivery_id  uuid,
  p_order_id     uuid,
  p_amount       numeric,
  p_description  text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_earning_id  uuid;
  v_wallet_id   uuid;
BEGIN
  -- Registra earning
  INSERT INTO public.courier_earnings (
    courier_id, delivery_id, order_id, amount, description, status
  ) VALUES (
    p_courier_id, p_delivery_id, p_order_id, p_amount, p_description, 'available'
  ) RETURNING id INTO v_earning_id;

  -- Tenta creditar na carteira (se existir)
  SELECT id INTO v_wallet_id
  FROM public.wallets
  WHERE owner_id = p_courier_id AND wallet_type = 'courier';

  IF v_wallet_id IS NOT NULL THEN
    INSERT INTO public.wallet_transactions (
      wallet_id, order_id, type, amount, direction, status, description
    ) VALUES (
      v_wallet_id, p_order_id, 'credit', p_amount, 'in', 'available',
      COALESCE(NULLIF(p_description,''), 'Entrega #' || UPPER(LEFT(p_order_id::text, 8)))
    );
  END IF;

  RETURN v_earning_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_courier_earning TO service_role;
