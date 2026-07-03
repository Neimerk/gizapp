-- =====================================================================
-- Auditoria P1/P2: correções financeiras, RLS e segurança
-- =====================================================================

-- ── 1. CORRIGE reverse_split_on_refund ───────────────────────────────
-- BUG: a absorção da plataforma não incluía service_fee no débito,
-- gerando inconsistência contábil em pedidos com service_fee > 0.

CREATE OR REPLACE FUNCTION public.reverse_split_on_refund(
  p_order_id   uuid,
  p_refund_id  uuid,
  p_absorbed_by text DEFAULT 'brasux'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sr        record;
  v_reversed  int := 0;
  v_absorbed  numeric(12,2);
BEGIN
  SELECT * INTO v_sr FROM public.split_rules WHERE order_id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'no_split_found'); END IF;

  -- Reverte transações HELD do vendedor e entregador
  -- Não reverte 'available' para evitar débito duplo em entregas já concluídas
  UPDATE public.wallet_transactions
  SET    status   = 'reversed',
         metadata = metadata || jsonb_build_object('refund_id', p_refund_id)
  WHERE  order_id  = p_order_id
    AND  direction = 'in'
    AND  status    = 'held';

  GET DIAGNOSTICS v_reversed = ROW_COUNT;

  -- Absorção pela plataforma: inclui vendor_net + delivery_amount + service_fee
  IF p_absorbed_by = 'brasux' AND v_sr.platform_wallet_id IS NOT NULL THEN
    v_absorbed := COALESCE(v_sr.vendor_net, 0)
                + COALESCE(v_sr.delivery_amount, 0)
                + COALESCE(v_sr.service_fee, 0);

    IF v_absorbed > 0 THEN
      INSERT INTO public.wallet_transactions (
        wallet_id, order_id, refund_id, type, amount, direction, status, description
      ) VALUES (
        v_sr.platform_wallet_id, p_order_id, p_refund_id,
        'refund', v_absorbed, 'out', 'completed',
        'Absorção de estorno — Pedido #' || UPPER(LEFT(p_order_id::text, 8))
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'reversed', 'rows', v_reversed, 'absorbed', v_absorbed);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reverse_split_on_refund TO service_role;

-- ── 2. RLS: courier_pix_accounts — adiciona SELECT para o próprio courier ─
ALTER TABLE IF EXISTS public.courier_pix_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "courier_pix_own_select" ON public.courier_pix_accounts;
CREATE POLICY "courier_pix_own_select"
  ON public.courier_pix_accounts FOR SELECT
  TO authenticated
  USING (courier_id = auth.uid());

-- ── 3. RLS: guest_sessions ───────────────────────────────────────────
-- Acessada apenas pelas Edge Functions com service_role key.
-- Garante que anon key não possa ler diretamente.
ALTER TABLE IF EXISTS public.guest_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guest_sessions_service_only" ON public.guest_sessions;
CREATE POLICY "guest_sessions_service_only"
  ON public.guest_sessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Bloqueia acesso via anon/authenticated keys
DROP POLICY IF EXISTS "guest_sessions_no_anon" ON public.guest_sessions;
CREATE POLICY "guest_sessions_no_anon"
  ON public.guest_sessions FOR SELECT
  TO authenticated
  USING (false);

-- ── 4. RLS: guest_addresses ──────────────────────────────────────────
ALTER TABLE IF EXISTS public.guest_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guest_addresses_service_only" ON public.guest_addresses;
CREATE POLICY "guest_addresses_service_only"
  ON public.guest_addresses FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 5. RLS: webhook_events ───────────────────────────────────────────
ALTER TABLE IF EXISTS public.webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_events_service_only" ON public.webhook_events;
CREATE POLICY "webhook_events_service_only"
  ON public.webhook_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "webhook_events_admin_select" ON public.webhook_events;
CREATE POLICY "webhook_events_admin_select"
  ON public.webhook_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── 6. RLS: audit_log (apenas se a tabela existir) ───────────────────
DO $audit$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_log') THEN
    EXECUTE 'ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "audit_log_admin_only" ON public.audit_log';
    EXECUTE $pol$
      CREATE POLICY "audit_log_admin_only"
        ON public.audit_log FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
          )
        )
    $pol$;
    EXECUTE 'DROP POLICY IF EXISTS "audit_log_service_insert" ON public.audit_log';
    EXECUTE $pol2$
      CREATE POLICY "audit_log_service_insert"
        ON public.audit_log FOR INSERT
        TO service_role
        WITH CHECK (true)
    $pol2$;
  END IF;
END;
$audit$;

-- ── 7. Garante coluna customer_email em orders (para email de guest) ──
ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS customer_email text;

COMMENT ON COLUMN public.orders.customer_email IS
  'Email do comprador (preenchido para guests; para usuários autenticados usar auth.users via customer_id)';

-- ── 8. Índice para rastrear split pendente (release-balance monitoring) ──
CREATE INDEX IF NOT EXISTS wallet_tx_held_idx
  ON public.wallet_transactions (order_id, status)
  WHERE status = 'held';
