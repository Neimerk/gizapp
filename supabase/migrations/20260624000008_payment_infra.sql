-- ============================================================
-- BrasUX Migration 008 — Infraestrutura Completa de Pagamentos
-- Rodar após migration-007 no Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 1. SUBSCRIPTIONS (planos dos vendedores) ───────────────

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id                uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan                     text        NOT NULL DEFAULT 'free'
                             CHECK (plan IN ('free','start','pro','premium','whitelabel')),
  monthly_price            numeric(10,2) NOT NULL DEFAULT 0,
  commission_rate          numeric(5,4) NOT NULL DEFAULT 0.08 CHECK (commission_rate BETWEEN 0 AND 1),
  status                   text        NOT NULL DEFAULT 'trial'
                             CHECK (status IN ('trial','active','overdue','suspended','cancelled')),
  trial_ends_at            timestamptz,
  next_billing_date        date,
  payment_method           text,
  gateway_subscription_id  text,
  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_vendor_select" ON public.subscriptions
  FOR SELECT USING (vendor_id = auth.uid());

CREATE POLICY "subscriptions_admin_all" ON public.subscriptions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS subscriptions_vendor_id_idx ON public.subscriptions(vendor_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx    ON public.subscriptions(status);

CREATE OR REPLACE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed: plano free para todos os sellers existentes (sem duplicar)
INSERT INTO public.subscriptions (vendor_id, plan, monthly_price, commission_rate, status)
SELECT p.id, 'free', 0.00, 0.08, 'active'
FROM   public.profiles p
WHERE  p.role = 'seller'
ON CONFLICT (vendor_id) DO NOTHING;

-- ── 2. PAYMENTS (registro central de cobranças) ─────────────

CREATE TABLE IF NOT EXISTS public.payments (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid        NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  gateway           text        NOT NULL DEFAULT 'asaas'
                      CHECK (gateway IN ('asaas','mercadopago','pagarme','stripe','manual')),
  external_id       text,                            -- ID da cobrança no gateway
  method            text        NOT NULL
                      CHECK (method IN ('pix','card','boleto','cash','other')),
  amount            numeric(12,2) NOT NULL CHECK (amount > 0),
  service_fee       numeric(12,2) NOT NULL DEFAULT 0 CHECK (service_fee >= 0),
  status            text        NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','declined','refunded','cancelled','expired')),
  pix_code          text,
  pix_qr_image      text,
  pix_expires_at    timestamptz,
  boleto_url        text,
  boleto_bar_code   text,
  gateway_response  jsonb,
  idempotency_key   text        UNIQUE,
  split_executed_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)                                  -- 1 payment ativo por pedido
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Comprador vê o próprio pagamento via order ownership
CREATE POLICY "payments_customer_select" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE  o.id = payments.order_id
        AND  (o.customer_id = auth.uid() OR
              EXISTS (SELECT 1 FROM public.stores s WHERE s.id = o.store_id AND s.owner_id = auth.uid()))
    )
  );

CREATE POLICY "payments_admin_all" ON public.payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS payments_order_id_idx     ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS payments_external_id_idx  ON public.payments(external_id);
CREATE INDEX IF NOT EXISTS payments_status_idx       ON public.payments(status);
CREATE INDEX IF NOT EXISTS payments_created_at_idx   ON public.payments(created_at DESC);

CREATE OR REPLACE TRIGGER set_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 3. PAYMENT_TRANSACTIONS (log de eventos do gateway) ─────

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id       uuid        NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  event_type       text        NOT NULL,  -- ex: 'PAYMENT_CONFIRMED', 'PAYMENT_REFUNDED'
  gateway_event_id text,                  -- ID do evento no gateway (idempotência)
  amount           numeric(12,2),
  status           text,
  metadata         jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gateway_event_id)               -- evita duplicação de webhooks
);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_transactions_admin_all" ON public.payment_transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS pt_payment_id_idx ON public.payment_transactions(payment_id);
CREATE INDEX IF NOT EXISTS pt_event_type_idx ON public.payment_transactions(event_type);

-- ── 4. WALLETS (carteiras financeiras) ─────────────────────

CREATE TABLE IF NOT EXISTS public.wallets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid,                    -- NULL = plataforma BrasUX
  wallet_type text NOT NULL
                CHECK (wallet_type IN ('vendor','courier','platform')),
  currency    text NOT NULL DEFAULT 'BRL',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, wallet_type)
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallets_owner_select" ON public.wallets
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "wallets_admin_all" ON public.wallets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS wallets_owner_idx ON public.wallets(owner_id);
CREATE INDEX IF NOT EXISTS wallets_type_idx  ON public.wallets(wallet_type);

-- Wallet da plataforma BrasUX (singleton)
INSERT INTO public.wallets (wallet_type, owner_id)
VALUES ('platform', NULL)
ON CONFLICT DO NOTHING;

-- ── 5. WALLET_TRANSACTIONS (razão contábil — ledger) ───────

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id       uuid          NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
  order_id        uuid          REFERENCES public.orders(id) ON DELETE SET NULL,
  payment_id      uuid          REFERENCES public.payments(id) ON DELETE SET NULL,
  refund_id       uuid,                            -- FK adicionada depois de criar refunds
  withdrawal_id   uuid,                            -- FK adicionada depois de criar withdrawals
  type            text          NOT NULL
                    CHECK (type IN ('credit','debit','refund','withdrawal','fee','adjustment')),
  amount          numeric(12,2) NOT NULL,          -- positivo sempre; direção dada pelo type
  direction       text          NOT NULL DEFAULT 'in'
                    CHECK (direction IN ('in','out')),
  status          text          NOT NULL DEFAULT 'held'
                    CHECK (status IN ('held','available','completed','reversed')),
  description     text          NOT NULL DEFAULT '',
  balance_after   numeric(12,2),                   -- snapshot para auditoria
  metadata        jsonb,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Dono da carteira vê suas transações
CREATE POLICY "wt_owner_select" ON public.wallet_transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.wallets w WHERE w.id = wallet_transactions.wallet_id AND w.owner_id = auth.uid())
  );

CREATE POLICY "wt_admin_all" ON public.wallet_transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS wt_wallet_id_idx    ON public.wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS wt_order_id_idx     ON public.wallet_transactions(order_id);
CREATE INDEX IF NOT EXISTS wt_payment_id_idx   ON public.wallet_transactions(payment_id);
CREATE INDEX IF NOT EXISTS wt_status_idx       ON public.wallet_transactions(status);
CREATE INDEX IF NOT EXISTS wt_created_at_idx   ON public.wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS wt_type_idx         ON public.wallet_transactions(type);

-- ── 6. SPLIT_RULES (regras de divisão por pedido) ──────────

CREATE TABLE IF NOT EXISTS public.split_rules (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid          NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  payment_id        uuid          REFERENCES public.payments(id),
  products_amount   numeric(12,2) NOT NULL DEFAULT 0,
  delivery_amount   numeric(12,2) NOT NULL DEFAULT 0,
  service_fee       numeric(12,2) NOT NULL DEFAULT 0,
  commission_rate   numeric(5,4)  NOT NULL DEFAULT 0,
  commission_amount numeric(12,2) NOT NULL DEFAULT 0,
  vendor_net        numeric(12,2) NOT NULL DEFAULT 0,  -- products_amount - commission_amount
  vendor_id         uuid          REFERENCES auth.users(id),
  courier_id        uuid          REFERENCES auth.users(id),
  vendor_wallet_id  uuid          REFERENCES public.wallets(id),
  courier_wallet_id uuid          REFERENCES public.wallets(id),
  platform_wallet_id uuid         REFERENCES public.wallets(id),
  executed_at       timestamptz,
  metadata          jsonb,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);

ALTER TABLE public.split_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "split_rules_vendor_select" ON public.split_rules
  FOR SELECT USING (vendor_id = auth.uid());

CREATE POLICY "split_rules_admin_all" ON public.split_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS sr_order_id_idx   ON public.split_rules(order_id);
CREATE INDEX IF NOT EXISTS sr_vendor_id_idx  ON public.split_rules(vendor_id);
CREATE INDEX IF NOT EXISTS sr_courier_id_idx ON public.split_rules(courier_id);

-- ── 7. WITHDRAWALS (saques unificados — v2) ─────────────────

CREATE TABLE IF NOT EXISTS public.withdrawals (
  id                 uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id          uuid          NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
  owner_id           uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_type         text          NOT NULL CHECK (owner_type IN ('vendor','courier')),
  amount_gross       numeric(12,2) NOT NULL CHECK (amount_gross > 0),
  withdrawal_fee     numeric(12,2) NOT NULL DEFAULT 0 CHECK (withdrawal_fee >= 0),
  amount_net         numeric(12,2) NOT NULL,           -- gross - fee
  pix_key            text          NOT NULL,
  pix_key_type       text          NOT NULL DEFAULT 'cpf'
                       CHECK (pix_key_type IN ('cpf','cnpj','email','phone','random')),
  status             text          NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','processing','paid','failed','cancelled')),
  gateway_reference  text,
  notes              text,
  wt_debit_id        uuid          REFERENCES public.wallet_transactions(id),  -- transação de débito
  processed_at       timestamptz,
  created_at         timestamptz   NOT NULL DEFAULT now(),
  updated_at         timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "withdrawals_owner_select" ON public.withdrawals
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "withdrawals_owner_insert" ON public.withdrawals
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "withdrawals_admin_all" ON public.withdrawals
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS wd_owner_id_idx  ON public.withdrawals(owner_id);
CREATE INDEX IF NOT EXISTS wd_status_idx    ON public.withdrawals(status);
CREATE INDEX IF NOT EXISTS wd_wallet_id_idx ON public.withdrawals(wallet_id);

CREATE OR REPLACE TRIGGER set_withdrawals_updated_at
  BEFORE UPDATE ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 8. REFUNDS (estornos) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.refunds (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id        uuid          NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  order_id          uuid          NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  reason            text          NOT NULL DEFAULT '',
  refund_type       text          NOT NULL DEFAULT 'full'
                      CHECK (refund_type IN ('full','partial')),
  amount            numeric(12,2) NOT NULL CHECK (amount > 0),
  absorbed_by       text          NOT NULL DEFAULT 'brasux'
                      CHECK (absorbed_by IN ('vendor','courier','brasux','shared')),
  status            text          NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','processing','completed','failed')),
  gateway_refund_id text,
  metadata          jsonb,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "refunds_customer_select" ON public.refunds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id = refunds.order_id AND o.customer_id = auth.uid()
    )
  );

CREATE POLICY "refunds_admin_all" ON public.refunds
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS ref_order_id_idx   ON public.refunds(order_id);
CREATE INDEX IF NOT EXISTS ref_payment_id_idx ON public.refunds(payment_id);
CREATE INDEX IF NOT EXISTS ref_status_idx     ON public.refunds(status);

CREATE OR REPLACE TRIGGER set_refunds_updated_at
  BEFORE UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 9. FKs tardias (após criar todas as tabelas) ────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'wallet_transactions' AND constraint_name = 'wt_refund_id_fk'
  ) THEN
    ALTER TABLE public.wallet_transactions
      ADD CONSTRAINT wt_refund_id_fk
        FOREIGN KEY (refund_id) REFERENCES public.refunds(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'wallet_transactions' AND constraint_name = 'wt_withdrawal_id_fk'
  ) THEN
    ALTER TABLE public.wallet_transactions
      ADD CONSTRAINT wt_withdrawal_id_fk
        FOREIGN KEY (withdrawal_id) REFERENCES public.withdrawals(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── 10. COLUNAS EXTRAS em tabelas existentes ────────────────

-- orders: service_fee e idempotency_key para rastreabilidade
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS service_fee      numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS idempotency_key  text UNIQUE;

-- profiles: asaas_customer_id já pode existir — garantir
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS asaas_customer_id text;

-- ── 11. FUNÇÕES POSTGRES ATÔMICAS ──────────────────────────

-- Retorna ou cria carteira para owner + tipo
CREATE OR REPLACE FUNCTION public.get_or_create_wallet(
  p_owner_id   uuid,
  p_wallet_type text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_wallet_id uuid;
BEGIN
  SELECT id INTO v_wallet_id
  FROM   public.wallets
  WHERE  owner_id = p_owner_id AND wallet_type = p_wallet_type;

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallets (owner_id, wallet_type)
    VALUES (p_owner_id, p_wallet_type)
    RETURNING id INTO v_wallet_id;
  END IF;

  RETURN v_wallet_id;
END;
$$;

-- Calcula saldo disponível de uma carteira
CREATE OR REPLACE FUNCTION public.get_wallet_balance(
  p_wallet_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_available numeric(12,2) := 0;
  v_held      numeric(12,2) := 0;
  v_total     numeric(12,2) := 0;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN status = 'available' AND direction = 'in'  THEN amount
                      WHEN status = 'completed' AND direction = 'out' THEN -amount
                      WHEN status = 'reversed'                        THEN 0
                      ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'held' AND direction = 'in' THEN amount ELSE 0 END), 0)
  INTO v_available, v_held
  FROM public.wallet_transactions
  WHERE wallet_id = p_wallet_id;

  v_total := v_available + v_held;

  RETURN jsonb_build_object(
    'available', v_available,
    'held',      v_held,
    'total',     v_total
  );
END;
$$;

-- Executa split financeiro de um pedido aprovado (atômico)
CREATE OR REPLACE FUNCTION public.execute_order_split(
  p_order_id  uuid,
  p_payment_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order           record;
  v_subscription    record;
  v_commission_rate numeric(5,4) := 0.08;
  v_products        numeric(12,2);
  v_delivery        numeric(12,2);
  v_service_fee     numeric(12,2);
  v_commission      numeric(12,2);
  v_vendor_net      numeric(12,2);
  v_vendor_id       uuid;
  v_courier_id      uuid;
  v_vendor_wid      uuid;
  v_courier_wid     uuid;
  v_platform_wid    uuid;
  v_sr_id           uuid;
BEGIN
  -- Idempotência: já foi executado?
  IF EXISTS (SELECT 1 FROM public.split_rules WHERE order_id = p_order_id AND executed_at IS NOT NULL) THEN
    RETURN jsonb_build_object('status', 'already_executed');
  END IF;

  -- Busca dados do pedido + loja
  SELECT o.*, s.owner_id AS store_owner_id
  INTO   v_order
  FROM   public.orders o
  JOIN   public.stores s ON s.id = o.store_id
  WHERE  o.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  v_vendor_id   := v_order.store_owner_id;
  v_products    := COALESCE(v_order.subtotal, 0);
  v_delivery    := COALESCE(v_order.delivery_fee, 0);
  v_service_fee := COALESCE(v_order.service_fee, 0);

  -- Busca plano do vendedor para commission_rate
  SELECT commission_rate INTO v_commission_rate
  FROM   public.subscriptions
  WHERE  vendor_id = v_vendor_id AND status IN ('trial','active')
  LIMIT  1;

  IF NOT FOUND THEN
    v_commission_rate := 0.08;  -- plano free como fallback
  END IF;

  -- Calcula valores
  v_commission := ROUND(v_products * v_commission_rate, 2);
  v_vendor_net := v_products - v_commission;

  -- Busca entregador ativo para este pedido
  SELECT courier_id INTO v_courier_id
  FROM   public.deliveries
  WHERE  order_id = p_order_id AND status != 'CANCELLED'
  LIMIT  1;

  -- Obtém/cria carteiras
  v_vendor_wid   := public.get_or_create_wallet(v_vendor_id, 'vendor');
  v_platform_wid := (SELECT id FROM public.wallets WHERE wallet_type = 'platform' AND owner_id IS NULL LIMIT 1);
  IF v_courier_id IS NOT NULL THEN
    v_courier_wid := public.get_or_create_wallet(v_courier_id, 'courier');
  END IF;

  -- Insere split_rules
  INSERT INTO public.split_rules (
    order_id, payment_id,
    products_amount, delivery_amount, service_fee,
    commission_rate, commission_amount, vendor_net,
    vendor_id, courier_id,
    vendor_wallet_id, courier_wallet_id, platform_wallet_id,
    executed_at
  ) VALUES (
    p_order_id, p_payment_id,
    v_products, v_delivery, v_service_fee,
    v_commission_rate, v_commission, v_vendor_net,
    v_vendor_id, v_courier_id,
    v_vendor_wid, v_courier_wid, v_platform_wid,
    now()
  )
  ON CONFLICT (order_id) DO UPDATE
    SET executed_at = now()
  RETURNING id INTO v_sr_id;

  -- Crédito ao VENDEDOR (HELD até entrega)
  IF v_vendor_net > 0 THEN
    INSERT INTO public.wallet_transactions (
      wallet_id, order_id, payment_id, type, amount, direction, status, description
    ) VALUES (
      v_vendor_wid, p_order_id, p_payment_id,
      'credit', v_vendor_net, 'in', 'held',
      'Venda — Pedido #' || UPPER(LEFT(p_order_id::text, 8))
    );
  END IF;

  -- Crédito ao ENTREGADOR (HELD até entrega)
  IF v_courier_wid IS NOT NULL AND v_delivery > 0 THEN
    INSERT INTO public.wallet_transactions (
      wallet_id, order_id, payment_id, type, amount, direction, status, description
    ) VALUES (
      v_courier_wid, p_order_id, p_payment_id,
      'credit', v_delivery, 'in', 'held',
      'Entrega — Pedido #' || UPPER(LEFT(p_order_id::text, 8))
    );
  END IF;

  -- Crédito à PLATAFORMA (AVAILABLE imediatamente: comissão + service_fee)
  IF v_commission + v_service_fee > 0 THEN
    INSERT INTO public.wallet_transactions (
      wallet_id, order_id, payment_id, type, amount, direction, status, description
    ) VALUES (
      v_platform_wid, p_order_id, p_payment_id,
      'fee', v_commission + v_service_fee, 'in', 'available',
      'Receita plataforma — Pedido #' || UPPER(LEFT(p_order_id::text, 8))
    );
  END IF;

  -- Marca pagamento com split_executed_at
  UPDATE public.payments SET split_executed_at = now() WHERE id = p_payment_id;

  RETURN jsonb_build_object(
    'status',          'executed',
    'vendor_net',      v_vendor_net,
    'delivery',        v_delivery,
    'commission',      v_commission,
    'service_fee',     v_service_fee,
    'platform_total',  v_commission + v_service_fee
  );
END;
$$;

-- Libera saldo HELD → AVAILABLE após entrega confirmada
CREATE OR REPLACE FUNCTION public.release_balance_after_delivery(
  p_order_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_released int := 0;
BEGIN
  UPDATE public.wallet_transactions
  SET    status = 'available'
  WHERE  order_id = p_order_id
    AND  status   = 'held'
    AND  direction = 'in';

  GET DIAGNOSTICS v_released = ROW_COUNT;

  RETURN jsonb_build_object('released_rows', v_released);
END;
$$;

-- Solicita saque (atômico: valida saldo + insere registro)
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_wallet_id    uuid,
  p_owner_id     uuid,
  p_owner_type   text,
  p_amount       numeric,
  p_pix_key      text,
  p_pix_key_type text DEFAULT 'cpf'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance       jsonb;
  v_available     numeric(12,2);
  v_withdrawal_id uuid;
  v_debit_id      uuid;
BEGIN
  -- Valida dono da carteira
  IF NOT EXISTS (SELECT 1 FROM public.wallets WHERE id = p_wallet_id AND owner_id = p_owner_id) THEN
    RAISE EXCEPTION 'WALLET_NOT_OWNED';
  END IF;

  -- Verifica saldo disponível
  v_balance   := public.get_wallet_balance(p_wallet_id);
  v_available := (v_balance->>'available')::numeric;

  IF v_available < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: disponível=%, solicitado=%', v_available, p_amount;
  END IF;

  IF p_amount < 10 THEN
    RAISE EXCEPTION 'MINIMUM_AMOUNT: mínimo R$ 10,00';
  END IF;

  -- Insere withdrawal
  INSERT INTO public.withdrawals (
    wallet_id, owner_id, owner_type,
    amount_gross, withdrawal_fee, amount_net,
    pix_key, pix_key_type, status
  ) VALUES (
    p_wallet_id, p_owner_id, p_owner_type,
    p_amount, 0, p_amount,
    p_pix_key, p_pix_key_type, 'pending'
  ) RETURNING id INTO v_withdrawal_id;

  -- Cria transação de débito (bloqueia o saldo)
  INSERT INTO public.wallet_transactions (
    wallet_id, withdrawal_id, type, amount, direction, status, description
  ) VALUES (
    p_wallet_id, v_withdrawal_id,
    'withdrawal', p_amount, 'out', 'completed',
    'Saque Pix solicitado'
  ) RETURNING id INTO v_debit_id;

  -- Vincula a transação ao saque
  UPDATE public.withdrawals SET wt_debit_id = v_debit_id WHERE id = v_withdrawal_id;

  RETURN v_withdrawal_id;
END;
$$;

-- Reverte split em caso de estorno (apenas platform absorve por padrão)
CREATE OR REPLACE FUNCTION public.reverse_split_on_refund(
  p_order_id   uuid,
  p_refund_id  uuid,
  p_absorbed_by text DEFAULT 'brasux'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sr        record;
  v_reversed  int := 0;
BEGIN
  SELECT * INTO v_sr FROM public.split_rules WHERE order_id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'no_split_found'); END IF;

  -- Reverte transações HELD do vendedor e entregador
  UPDATE public.wallet_transactions
  SET    status = 'reversed', metadata = jsonb_build_object('refund_id', p_refund_id)
  WHERE  order_id  = p_order_id
    AND  direction = 'in'
    AND  status    IN ('held', 'available');

  GET DIAGNOSTICS v_reversed = ROW_COUNT;

  -- Se a plataforma absorve: insere débito na carteira da plataforma
  IF p_absorbed_by = 'brasux' AND v_sr.platform_wallet_id IS NOT NULL THEN
    INSERT INTO public.wallet_transactions (
      wallet_id, order_id, refund_id, type, amount, direction, status, description
    ) VALUES (
      v_sr.platform_wallet_id, p_order_id, p_refund_id,
      'refund', v_sr.vendor_net + v_sr.delivery_amount, 'out', 'completed',
      'Absorção de estorno — Pedido #' || UPPER(LEFT(p_order_id::text, 8))
    );
  END IF;

  RETURN jsonb_build_object('status', 'reversed', 'rows', v_reversed);
END;
$$;

-- Earn points on payment (wrapper idempotente)
CREATE OR REPLACE FUNCTION public.earn_points_on_payment(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order record;
  v_pts   int;
BEGIN
  SELECT customer_id, subtotal INTO v_order FROM public.orders WHERE id = p_order_id;
  IF v_order.customer_id IS NULL THEN RETURN; END IF;

  -- Não creditar se já foi creditado
  IF EXISTS (SELECT 1 FROM public.point_transactions WHERE order_id = p_order_id AND amount > 0) THEN
    RETURN;
  END IF;

  v_pts := GREATEST(0, FLOOR(v_order.subtotal));
  IF v_pts > 0 THEN
    PERFORM public.earn_points(
      p_user_id     := v_order.customer_id,
      p_amount      := v_pts,
      p_description := 'Compra aprovada — Pedido #' || UPPER(LEFT(p_order_id::text, 8)),
      p_order_id    := p_order_id
    );
  END IF;
END;
$$;

-- ── 12. ÍNDICES ADICIONAIS ──────────────────────────────────

CREATE INDEX IF NOT EXISTS orders_service_fee_idx ON public.orders(service_fee);
CREATE INDEX IF NOT EXISTS orders_status_payment_idx ON public.orders(status, payment_status);

-- ── 13. PERMISSÕES PARA FUNÇÕES ─────────────────────────────

GRANT EXECUTE ON FUNCTION public.get_or_create_wallet    TO service_role;
GRANT EXECUTE ON FUNCTION public.get_wallet_balance       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.execute_order_split      TO service_role;
GRANT EXECUTE ON FUNCTION public.release_balance_after_delivery TO service_role;
GRANT EXECUTE ON FUNCTION public.request_withdrawal       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reverse_split_on_refund  TO service_role;
GRANT EXECUTE ON FUNCTION public.earn_points_on_payment   TO service_role;
