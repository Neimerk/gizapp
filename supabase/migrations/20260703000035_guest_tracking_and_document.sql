-- =====================================================================
-- Guest Order Tracking + Customer Document
-- Rastreamento público de pedido sem login + CPF/documento em orders.
-- =====================================================================

-- ── 1. Tabela de tracking público ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.guest_order_tracking (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tracking_code    text        NOT NULL UNIQUE DEFAULT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  order_id         uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  guest_session_id uuid        REFERENCES public.guest_sessions(id) ON DELETE SET NULL,
  customer_email   text,
  created_at       timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE  public.guest_order_tracking IS 'Tracking público de pedido — acessível sem login pelo tracking_code. Gerado automaticamente para todo pedido guest.';
COMMENT ON COLUMN public.guest_order_tracking.tracking_code IS 'Código de 8 caracteres hexadecimais maiúsculos. Ex: A1B2C3D4.';

ALTER TABLE public.guest_order_tracking ENABLE ROW LEVEL SECURITY;

-- Leitura pública pelo tracking_code — sem JWT, sem guest token
CREATE POLICY "tracking_public_read"
  ON public.guest_order_tracking FOR SELECT
  TO anon, authenticated
  USING (true);

-- Escrita apenas via service_role (Edge Functions)
CREATE POLICY "tracking_service_write"
  ON public.guest_order_tracking FOR INSERT
  TO service_role WITH CHECK (true);

CREATE INDEX IF NOT EXISTS guest_tracking_code_idx    ON public.guest_order_tracking (tracking_code);
CREATE INDEX IF NOT EXISTS guest_tracking_order_idx   ON public.guest_order_tracking (order_id);
CREATE INDEX IF NOT EXISTS guest_tracking_session_idx ON public.guest_order_tracking (guest_session_id) WHERE guest_session_id IS NOT NULL;

-- ── 2. Trigger: gera tracking ao criar pedido guest ──────────────────

CREATE OR REPLACE FUNCTION public.create_guest_order_tracking()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.is_guest_checkout = true OR NEW.guest_session_id IS NOT NULL THEN
    INSERT INTO public.guest_order_tracking (order_id, guest_session_id, customer_email)
    VALUES (NEW.id, NEW.guest_session_id, NEW.customer_email)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_create_guest_tracking ON public.orders;
CREATE TRIGGER orders_create_guest_tracking
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.create_guest_order_tracking();

-- ── 3. customer_document em orders ────────────────────────────────────

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_document text;

COMMENT ON COLUMN public.orders.customer_document IS 'CPF ou CNPJ do comprador (sem formatação). Obrigatório para cartão, opcional para PIX/boleto.';

CREATE INDEX IF NOT EXISTS orders_customer_document_idx ON public.orders (customer_document) WHERE customer_document IS NOT NULL;

-- ── 4. Função pública: busca pedido por tracking_code ─────────────────

CREATE OR REPLACE FUNCTION public.get_order_by_tracking(p_code text)
RETURNS TABLE (
  order_id         uuid,
  tracking_code    text,
  status           int,
  payment_status   text,
  payment_method   text,
  total            numeric,
  customer_name    text,
  store_name       text,
  created_at       timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    t.tracking_code,
    o.status,
    o.payment_status,
    o.payment_method,
    o.total,
    o.customer_name,
    s.name  AS store_name,
    o.created_at
  FROM public.guest_order_tracking t
  JOIN public.orders o ON o.id = t.order_id
  LEFT JOIN public.stores s ON s.id = o.store_id
  WHERE t.tracking_code = upper(p_code)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_tracking(text) TO anon, authenticated;
COMMENT ON FUNCTION public.get_order_by_tracking IS 'Retorna dados não-sensíveis de um pedido pelo tracking_code público. Acessível sem autenticação.';

-- ── 5. Agendar limpeza de sessões expiradas (pg_cron) ────────────────

DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-guest-sessions',
      '0 3 * * *',
      'SELECT public.cleanup_expired_guest_sessions()'
    );
  END IF;
END;
$outer$;
