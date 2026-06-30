-- ============================================================
-- BrasUX Migration 009 — Payment Architecture V2 (idempotente)
-- ============================================================

-- ── 1. VENDOR_PLANS ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vendor_plans (
  id              text          PRIMARY KEY,
  label           text          NOT NULL,
  monthly_price   numeric(10,2) NOT NULL DEFAULT 0,
  commission_rate numeric(5,4)  NOT NULL DEFAULT 0.08,
  max_products    int,
  max_stores      int           DEFAULT 1,
  features        text[]        DEFAULT '{}',
  active          bool          NOT NULL DEFAULT true,
  sort_order      int           NOT NULL DEFAULT 0
);

ALTER TABLE public.vendor_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_plans_public_select" ON public.vendor_plans;
CREATE POLICY "vendor_plans_public_select" ON public.vendor_plans
  FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "vendor_plans_admin_all" ON public.vendor_plans;
CREATE POLICY "vendor_plans_admin_all" ON public.vendor_plans
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

INSERT INTO public.vendor_plans (id, label, monthly_price, commission_rate, max_products, features, sort_order)
VALUES
  ('free',       'Gratuito',    0.00,  0.08, 30,   ARRAY['Até 30 produtos','Suporte por e-mail'],                            0),
  ('start',      'Start',      49.90,  0.00, 200,  ARRAY['Até 200 produtos','Suporte prioritário','0% comissão por venda'],  1),
  ('pro',        'Pro',        99.90,  0.00, NULL, ARRAY['Produtos ilimitados','Analytics','Suporte 24h','0% comissão'],     2),
  ('whitelabel', 'White Label',199.90, 0.00, NULL, ARRAY['Tudo do Pro','Domínio próprio','Acesso à API','0% comissão'],      3)
ON CONFLICT (id) DO UPDATE SET
  label           = EXCLUDED.label,
  monthly_price   = EXCLUDED.monthly_price,
  commission_rate = EXCLUDED.commission_rate,
  features        = EXCLUDED.features,
  sort_order      = EXCLUDED.sort_order;

-- ── 2. ASAAS_SUBACCOUNTS ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.asaas_subaccounts (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_type         text        NOT NULL CHECK (owner_type IN ('vendor','courier')),
  asaas_account_id   text        NOT NULL,
  asaas_wallet_id    text        NOT NULL,
  cpf_cnpj           text        NOT NULL,
  account_name       text        NOT NULL,
  email              text        NOT NULL,
  kyc_status         text        NOT NULL DEFAULT 'pending'
                       CHECK (kyc_status IN ('pending','submitted','approved','rejected')),
  kyc_submitted_at   timestamptz,
  kyc_approved_at    timestamptz,
  split_enabled      bool        NOT NULL DEFAULT false,
  pix_key            text,
  pix_key_type       text        CHECK (pix_key_type IN ('cpf','cnpj','email','phone','random')),
  raw_response       jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, owner_type)
);

ALTER TABLE public.asaas_subaccounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asaas_sub_owner_select" ON public.asaas_subaccounts;
CREATE POLICY "asaas_sub_owner_select" ON public.asaas_subaccounts
  FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "asaas_sub_admin_all" ON public.asaas_subaccounts;
CREATE POLICY "asaas_sub_admin_all" ON public.asaas_subaccounts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS asaas_sub_owner_idx  ON public.asaas_subaccounts(owner_id);
CREATE INDEX IF NOT EXISTS asaas_sub_kyc_idx    ON public.asaas_subaccounts(kyc_status);
CREATE INDEX IF NOT EXISTS asaas_sub_wallet_idx ON public.asaas_subaccounts(asaas_wallet_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_asaas_subaccounts_updated_at'
  ) THEN
    CREATE TRIGGER set_asaas_subaccounts_updated_at
      BEFORE UPDATE ON public.asaas_subaccounts
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ── 3. WEBHOOK_EVENTS ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source           text        NOT NULL DEFAULT 'asaas',
  event_id         text        NOT NULL,
  event_type       text        NOT NULL,
  payload          jsonb       NOT NULL DEFAULT '{}',
  status           text        NOT NULL DEFAULT 'received'
                     CHECK (status IN ('received','processing','processed','failed','dead_letter')),
  retry_count      smallint    NOT NULL DEFAULT 0,
  last_error       text,
  processed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- UNIQUE composto no lugar de generated column (mais compatível)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'webhook_events_source_event_id_key'
      AND conrelid = 'public.webhook_events'::regclass
  ) THEN
    ALTER TABLE public.webhook_events ADD CONSTRAINT webhook_events_source_event_id_key
      UNIQUE (source, event_id);
  END IF;
END $$;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_events_admin_only" ON public.webhook_events;
CREATE POLICY "webhook_events_admin_only" ON public.webhook_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS we_status_idx     ON public.webhook_events(status);
CREATE INDEX IF NOT EXISTS we_event_type_idx ON public.webhook_events(event_type);
CREATE INDEX IF NOT EXISTS we_created_at_idx ON public.webhook_events(created_at DESC);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_webhook_events_updated_at'
  ) THEN
    CREATE TRIGGER set_webhook_events_updated_at
      BEFORE UPDATE ON public.webhook_events
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ── 4. FINANCIAL_AUDIT_LOG ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.financial_audit_log (
  id           bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_type   text        NOT NULL
                 CHECK (actor_type IN ('system','vendor','courier','customer','admin')),
  actor_id     uuid,
  action       text        NOT NULL,
  entity_type  text        NOT NULL,
  entity_id    uuid,
  amount       numeric(12,2),
  description  text,
  metadata     jsonb,
  ip_address   inet,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_admin_select" ON public.financial_audit_log;
CREATE POLICY "audit_log_admin_select" ON public.financial_audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS fal_actor_idx   ON public.financial_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS fal_entity_idx  ON public.financial_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS fal_created_idx ON public.financial_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS fal_action_idx  ON public.financial_audit_log(action);

-- ── 5. IDEMPOTENCY_KEYS ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key          text        PRIMARY KEY,
  owner_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint     text        NOT NULL,
  response     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "idem_owner" ON public.idempotency_keys;
CREATE POLICY "idem_owner" ON public.idempotency_keys
  FOR ALL USING (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idem_expires_idx ON public.idempotency_keys(expires_at);

-- ── 6. COURIER_PIX_ACCOUNTS ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.courier_pix_accounts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pix_key      text NOT NULL,
  pix_key_type text NOT NULL DEFAULT 'cpf'
                 CHECK (pix_key_type IN ('cpf','cnpj','email','phone','random')),
  verified     bool NOT NULL DEFAULT false,
  active       bool NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (courier_id)
);

ALTER TABLE public.courier_pix_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "courier_pix_own" ON public.courier_pix_accounts;
CREATE POLICY "courier_pix_own" ON public.courier_pix_accounts
  FOR ALL USING (courier_id = auth.uid());

DROP POLICY IF EXISTS "courier_pix_admin" ON public.courier_pix_accounts;
CREATE POLICY "courier_pix_admin" ON public.courier_pix_accounts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS cpix_courier_idx ON public.courier_pix_accounts(courier_id);

-- ── 7. ENRIQUECE TABELAS EXISTENTES ─────────────────────────

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS courier_modality    text    NOT NULL DEFAULT 'B'
    CHECK (courier_modality IN ('A','B')),
  ADD COLUMN IF NOT EXISTS courier_fee_fixed   numeric(12,2) DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS gateway_customer_id text;

ALTER TABLE public.split_rules
  ADD COLUMN IF NOT EXISTS vendor_asaas_wallet_id  text,
  ADD COLUMN IF NOT EXISTS courier_asaas_wallet_id text,
  ADD COLUMN IF NOT EXISTS split_mode              text NOT NULL DEFAULT 'ledger'
    CHECK (split_mode IN ('ledger','asaas_native'));

-- ── 8. VIEWS FINANCEIRAS ─────────────────────────────────────

CREATE OR REPLACE VIEW public.v_platform_revenue AS
SELECT
  DATE_TRUNC('month', wt.created_at)   AS month,
  COUNT(DISTINCT wt.order_id)           AS orders,
  COALESCE(SUM(wt.amount), 0)           AS gross_revenue,
  COALESCE(SUM(CASE WHEN wt.type = 'fee' THEN wt.amount ELSE 0 END), 0)
                                        AS commission_revenue
FROM   public.wallet_transactions wt
JOIN   public.wallets w ON w.id = wt.wallet_id
WHERE  w.wallet_type = 'platform'
  AND  wt.direction  = 'in'
  AND  wt.status     IN ('available','completed')
GROUP  BY 1
ORDER  BY 1 DESC;

CREATE OR REPLACE VIEW public.v_vendor_balances AS
SELECT
  w.owner_id                          AS vendor_id,
  p.name                              AS vendor_name,
  COALESCE(SUM(
    CASE WHEN wt.direction='in'  AND wt.status='available' THEN  wt.amount
         WHEN wt.direction='out' AND wt.status='completed'  THEN -wt.amount
         ELSE 0 END), 0)              AS available_balance,
  COALESCE(SUM(
    CASE WHEN wt.direction='in' AND wt.status='held' THEN wt.amount
         ELSE 0 END), 0)              AS held_balance,
  COUNT(CASE WHEN wt.type = 'credit' THEN 1 END) AS total_transactions,
  MAX(wt.created_at)                  AS last_activity
FROM   public.wallets w
JOIN   public.wallet_transactions wt ON wt.wallet_id = w.id
JOIN   public.profiles p             ON p.id = w.owner_id
WHERE  w.wallet_type = 'vendor'
GROUP  BY w.owner_id, p.name;

CREATE OR REPLACE VIEW public.v_revenue_by_store AS
SELECT
  o.store_id,
  s.name                                 AS store_name,
  COUNT(*)                               AS order_count,
  COALESCE(SUM(o.total), 0)             AS gmv,
  COALESCE(SUM(sr.commission_amount), 0) AS platform_commission,
  COALESCE(SUM(sr.vendor_net), 0)        AS vendor_revenue,
  COALESCE(AVG(o.total), 0)             AS avg_ticket
FROM   public.orders o
JOIN   public.split_rules sr ON sr.order_id = o.id
JOIN   public.stores s       ON s.id = o.store_id
WHERE  o.payment_status = 'CONFIRMED'
GROUP  BY o.store_id, s.name;

-- ── 9. FUNÇÕES ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_financial_event(
  p_actor_type  text,
  p_actor_id    uuid,
  p_action      text,
  p_entity_type text,
  p_entity_id   uuid,
  p_amount      numeric    DEFAULT NULL,
  p_description text       DEFAULT '',
  p_metadata    jsonb      DEFAULT '{}'
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.financial_audit_log
    (actor_type, actor_id, action, entity_type, entity_id, amount, description, metadata)
  VALUES
    (p_actor_type, p_actor_id, p_action, p_entity_type, p_entity_id,
     p_amount, p_description, p_metadata);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_financial_event TO service_role;

-- Split v2: ledger + asaas_native, com audit trail
CREATE OR REPLACE FUNCTION public.execute_order_split_v2(
  p_order_id   uuid,
  p_payment_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order            record;
  v_sub              record;
  v_commission_rate  numeric(5,4)  := 0.08;
  v_courier_fee      numeric(12,2) := 1.00;
  v_courier_modality text          := 'B';
  v_products         numeric(12,2);
  v_delivery         numeric(12,2);
  v_service_fee      numeric(12,2);
  v_commission       numeric(12,2);
  v_vendor_net       numeric(12,2);
  v_courier_net      numeric(12,2);
  v_platform_total   numeric(12,2);
  v_vendor_id        uuid;
  v_courier_id       uuid;
  v_vendor_wid       uuid;
  v_courier_wid      uuid;
  v_platform_wid     uuid;
  v_asaas_vendor     text;
  v_asaas_courier    text;
  v_split_mode       text := 'ledger';
  v_vendor_status    text;
  v_courier_status   text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.split_rules
    WHERE order_id = p_order_id AND executed_at IS NOT NULL
  ) THEN
    RETURN jsonb_build_object('status', 'already_executed');
  END IF;

  SELECT o.*, s.owner_id AS store_owner_id
  INTO   v_order
  FROM   public.orders o
  JOIN   public.stores s ON s.id = o.store_id
  WHERE  o.id = p_order_id
  FOR UPDATE OF o;

  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;

  v_vendor_id   := v_order.store_owner_id;
  v_products    := COALESCE(v_order.subtotal, 0);
  v_delivery    := COALESCE(v_order.delivery_fee, 0);
  v_service_fee := COALESCE(v_order.service_fee, 0);

  SELECT commission_rate, courier_fee_fixed, courier_modality
  INTO   v_sub
  FROM   public.subscriptions
  WHERE  vendor_id = v_vendor_id AND status IN ('trial','active')
  LIMIT  1;

  IF FOUND THEN
    v_commission_rate  := COALESCE(v_sub.commission_rate, 0.08);
    v_courier_fee      := COALESCE(v_sub.courier_fee_fixed, 1.00);
    v_courier_modality := COALESCE(v_sub.courier_modality, 'B');
  END IF;

  IF v_courier_modality = 'A' THEN v_courier_fee := 0; END IF;

  v_commission   := ROUND(v_products * v_commission_rate, 2);
  v_vendor_net   := v_products - v_commission;
  v_courier_net  := GREATEST(0, v_delivery - v_courier_fee);
  v_platform_total := v_commission + v_service_fee + v_courier_fee;

  SELECT courier_id INTO v_courier_id
  FROM   public.deliveries
  WHERE  order_id = p_order_id AND status != 'CANCELLED'
  LIMIT  1;

  v_vendor_wid   := public.get_or_create_wallet(v_vendor_id, 'vendor');
  v_platform_wid := (
    SELECT id FROM public.wallets WHERE wallet_type = 'platform' AND owner_id IS NULL LIMIT 1
  );
  IF v_courier_id IS NOT NULL THEN
    v_courier_wid := public.get_or_create_wallet(v_courier_id, 'courier');
  END IF;

  SELECT asaas_wallet_id INTO v_asaas_vendor
  FROM   public.asaas_subaccounts
  WHERE  owner_id = v_vendor_id AND owner_type = 'vendor' AND split_enabled = true
  LIMIT  1;

  IF v_courier_id IS NOT NULL THEN
    SELECT asaas_wallet_id INTO v_asaas_courier
    FROM   public.asaas_subaccounts
    WHERE  owner_id = v_courier_id AND owner_type = 'courier' AND split_enabled = true
    LIMIT  1;
  END IF;

  IF v_asaas_vendor IS NOT NULL THEN v_split_mode := 'asaas_native'; END IF;

  v_vendor_status  := CASE WHEN v_split_mode = 'asaas_native' THEN 'available' ELSE 'held' END;
  v_courier_status := CASE WHEN v_asaas_courier IS NOT NULL   THEN 'available' ELSE 'held' END;

  INSERT INTO public.split_rules (
    order_id, payment_id,
    products_amount, delivery_amount, service_fee,
    commission_rate, commission_amount, vendor_net,
    vendor_id, courier_id,
    vendor_wallet_id, courier_wallet_id, platform_wallet_id,
    vendor_asaas_wallet_id, courier_asaas_wallet_id, split_mode,
    executed_at
  ) VALUES (
    p_order_id, p_payment_id,
    v_products, v_delivery, v_service_fee,
    v_commission_rate, v_commission, v_vendor_net,
    v_vendor_id, v_courier_id,
    v_vendor_wid, v_courier_wid, v_platform_wid,
    v_asaas_vendor, v_asaas_courier, v_split_mode,
    now()
  )
  ON CONFLICT (order_id) DO UPDATE SET
    executed_at             = now(),
    vendor_asaas_wallet_id  = EXCLUDED.vendor_asaas_wallet_id,
    courier_asaas_wallet_id = EXCLUDED.courier_asaas_wallet_id,
    split_mode              = EXCLUDED.split_mode;

  IF v_vendor_net > 0 THEN
    INSERT INTO public.wallet_transactions
      (wallet_id, order_id, payment_id, type, amount, direction, status, description)
    VALUES (
      v_vendor_wid, p_order_id, p_payment_id,
      'credit', v_vendor_net, 'in', v_vendor_status,
      'Venda — Pedido #' || UPPER(LEFT(p_order_id::text, 8))
    );
  END IF;

  IF v_courier_wid IS NOT NULL AND v_courier_net > 0 THEN
    INSERT INTO public.wallet_transactions
      (wallet_id, order_id, payment_id, type, amount, direction, status, description)
    VALUES (
      v_courier_wid, p_order_id, p_payment_id,
      'credit', v_courier_net, 'in', v_courier_status,
      'Entrega — Pedido #' || UPPER(LEFT(p_order_id::text, 8))
    );
  END IF;

  IF v_platform_total > 0 AND v_platform_wid IS NOT NULL THEN
    INSERT INTO public.wallet_transactions
      (wallet_id, order_id, payment_id, type, amount, direction, status, description)
    VALUES (
      v_platform_wid, p_order_id, p_payment_id,
      'fee', v_platform_total, 'in', 'available',
      'Receita plataforma — Pedido #' || UPPER(LEFT(p_order_id::text, 8))
    );
  END IF;

  UPDATE public.payments SET split_executed_at = now() WHERE id = p_payment_id;

  PERFORM public.log_financial_event(
    'system', v_vendor_id, 'split_executed', 'split_rules', p_order_id,
    v_products + v_delivery,
    'Split executado mode=' || v_split_mode,
    jsonb_build_object(
      'vendor_net',     v_vendor_net,
      'courier_net',    v_courier_net,
      'commission',     v_commission,
      'platform_total', v_platform_total,
      'mode',           v_split_mode
    )
  );

  RETURN jsonb_build_object(
    'status',         'executed',
    'split_mode',     v_split_mode,
    'vendor_net',     v_vendor_net,
    'courier_net',    v_courier_net,
    'commission',     v_commission,
    'platform_total', v_platform_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_order_split_v2 TO service_role;

CREATE OR REPLACE FUNCTION public.monthly_reconciliation(
  p_month date DEFAULT DATE_TRUNC('month', now())::date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_platform_revenue numeric(12,2) := 0;
  v_held             numeric(12,2) := 0;
  v_paid_count       int           := 0;
  v_withdrawn        numeric(12,2) := 0;
  v_pending_wd       int           := 0;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN direction='in' AND status IN ('available','completed') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN direction='in' AND status='held' THEN amount ELSE 0 END), 0)
  INTO v_platform_revenue, v_held
  FROM public.wallet_transactions wt
  JOIN public.wallets w ON w.id = wt.wallet_id
  WHERE w.wallet_type = 'platform'
    AND DATE_TRUNC('month', wt.created_at) = p_month;

  SELECT COUNT(*), COALESCE(SUM(amount_net), 0)
  INTO v_paid_count, v_withdrawn
  FROM public.withdrawals
  WHERE DATE_TRUNC('month', created_at) = p_month
    AND status = 'paid';

  SELECT COUNT(*) INTO v_pending_wd
  FROM public.withdrawals WHERE status = 'pending';

  RETURN jsonb_build_object(
    'month',               p_month,
    'platform_revenue',    v_platform_revenue,
    'held_balance',        v_held,
    'total_withdrawn',     v_withdrawn,
    'paid_withdrawals',    v_paid_count,
    'pending_withdrawals', v_pending_wd
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.monthly_reconciliation TO service_role, authenticated;

-- ── 10. GRANTS ───────────────────────────────────────────────

GRANT ALL    ON public.vendor_plans          TO service_role;
GRANT ALL    ON public.asaas_subaccounts     TO service_role;
GRANT ALL    ON public.webhook_events        TO service_role;
GRANT ALL    ON public.financial_audit_log   TO service_role;
GRANT ALL    ON public.idempotency_keys      TO service_role;
GRANT ALL    ON public.courier_pix_accounts  TO service_role;

GRANT SELECT ON public.vendor_plans         TO anon, authenticated;
GRANT SELECT ON public.asaas_subaccounts    TO authenticated;
GRANT ALL    ON public.courier_pix_accounts TO authenticated;
GRANT ALL    ON public.idempotency_keys     TO authenticated;
