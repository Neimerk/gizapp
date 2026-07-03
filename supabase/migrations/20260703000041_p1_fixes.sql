-- =====================================================================
-- P1 Fixes
--
-- 1. user_coupons e guest_coupon_uses — tabelas de rastreamento por entidade
-- 2. use_coupon_atomic — criado (ausente nas migrations anteriores!)
--    Suporta rastreamento por user_id OU guest_session_id.
-- 3. release_coupon_for_order — estendido para liberar uso de guest
-- 4. Cron jobs: reconcile-withdrawals (*/30) e reconcile-subscriptions (a cada 6h)
-- =====================================================================

-- ── 1. user_coupons ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_coupons (
  user_id    uuid NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  coupon_id  uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  used_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, coupon_id)
);

ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_coupons_service_only" ON public.user_coupons;
CREATE POLICY "user_coupons_service_only"
  ON public.user_coupons FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 2. guest_coupon_uses ─────────────────────────────────────────────
-- Rastreia uso de cupom por sessão de convidado para evitar reutilização
-- via múltiplas sessões do mesmo dispositivo/usuário.

CREATE TABLE IF NOT EXISTS public.guest_coupon_uses (
  guest_session_id  uuid NOT NULL REFERENCES public.guest_sessions(id) ON DELETE CASCADE,
  coupon_id         uuid NOT NULL REFERENCES public.coupons(id)        ON DELETE CASCADE,
  used_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guest_session_id, coupon_id)
);

ALTER TABLE public.guest_coupon_uses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "guest_coupon_uses_service_only" ON public.guest_coupon_uses;
CREATE POLICY "guest_coupon_uses_service_only"
  ON public.guest_coupon_uses FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 3. use_coupon_atomic ─────────────────────────────────────────────
-- Consome um cupom de forma atômica (lock row → valida → registra → incrementa).
-- Lança exceções com prefixo legível para o cliente:
--   INVALID_COUPON | EXPIRED_COUPON | EXHAUSTED_COUPON | ALREADY_USED

CREATE OR REPLACE FUNCTION public.use_coupon_atomic(
  p_code             text,
  p_user_id          uuid DEFAULT NULL,
  p_guest_session_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_coupon record;
BEGIN
  -- Lock da linha do cupom para serializar acesso concorrente
  SELECT id, active, expires_at, max_uses, uses_count
  INTO   v_coupon
  FROM   public.coupons
  WHERE  UPPER(code) = UPPER(p_code)
  FOR UPDATE;

  IF NOT FOUND OR NOT v_coupon.active THEN
    RAISE EXCEPTION 'INVALID_COUPON';
  END IF;

  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN
    RAISE EXCEPTION 'EXPIRED_COUPON';
  END IF;

  IF v_coupon.max_uses IS NOT NULL AND v_coupon.uses_count >= v_coupon.max_uses THEN
    RAISE EXCEPTION 'EXHAUSTED_COUPON';
  END IF;

  -- Rastreamento por usuário autenticado
  IF p_user_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.user_coupons
      WHERE user_id = p_user_id AND coupon_id = v_coupon.id
    ) THEN
      RAISE EXCEPTION 'ALREADY_USED';
    END IF;
    INSERT INTO public.user_coupons (user_id, coupon_id)
    VALUES (p_user_id, v_coupon.id);

  -- Rastreamento por sessão de convidado (impede reutilização via nova sessão)
  ELSIF p_guest_session_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.guest_coupon_uses
      WHERE guest_session_id = p_guest_session_id AND coupon_id = v_coupon.id
    ) THEN
      RAISE EXCEPTION 'ALREADY_USED';
    END IF;
    INSERT INTO public.guest_coupon_uses (guest_session_id, coupon_id)
    VALUES (p_guest_session_id, v_coupon.id);
  END IF;

  UPDATE public.coupons
  SET    uses_count = uses_count + 1,
         updated_at = now()
  WHERE  id = v_coupon.id;
END;
$$;

REVOKE ALL ON FUNCTION public.use_coupon_atomic(text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.use_coupon_atomic(text, uuid, uuid) TO service_role;

-- ── 4. release_coupon_for_order — estende para guests ────────────────

CREATE OR REPLACE FUNCTION public.release_coupon_for_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_coupon_id        uuid;
  v_customer_id      uuid;
  v_guest_session_id uuid;
BEGIN
  SELECT coupon_id, customer_id, guest_session_id
  INTO   v_coupon_id, v_customer_id, v_guest_session_id
  FROM   public.orders
  WHERE  id = p_order_id;

  IF NOT FOUND OR v_coupon_id IS NULL THEN RETURN; END IF;

  UPDATE public.coupons
  SET    uses_count = GREATEST(0, uses_count - 1),
         updated_at = now()
  WHERE  id = v_coupon_id;

  IF v_customer_id IS NOT NULL THEN
    DELETE FROM public.user_coupons
    WHERE  user_id   = v_customer_id
      AND  coupon_id = v_coupon_id;
  ELSIF v_guest_session_id IS NOT NULL THEN
    DELETE FROM public.guest_coupon_uses
    WHERE  guest_session_id = v_guest_session_id
      AND  coupon_id        = v_coupon_id;
  END IF;

  UPDATE public.orders SET coupon_id = NULL WHERE id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_coupon_for_order TO service_role;

-- ── 5. Cron jobs: reconcile-withdrawals + reconcile-subscriptions ─────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN

    -- Saques presos em 'processing' por >45 min → verifica Asaas ou marca failed
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-withdrawals') THEN
      PERFORM cron.unschedule('reconcile-withdrawals');
    END IF;
    PERFORM cron.schedule(
      'reconcile-withdrawals',
      '*/30 * * * *',
      $job$
        SELECT net.http_post(
          url     := public._get_cron_cfg('supabase_url') || '/functions/v1/cron-runner',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-key',   public._get_cron_cfg('cron_key')
          ),
          body    := '{"job":"reconcile-withdrawals"}'::jsonb
        ) AS request_id;
      $job$
    );

    -- Assinaturas presas em 'pending_payment' por >24h → verifica Asaas
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-subscriptions') THEN
      PERFORM cron.unschedule('reconcile-subscriptions');
    END IF;
    PERFORM cron.schedule(
      'reconcile-subscriptions',
      '0 */6 * * *',
      $job$
        SELECT net.http_post(
          url     := public._get_cron_cfg('supabase_url') || '/functions/v1/cron-runner',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-key',   public._get_cron_cfg('cron_key')
          ),
          body    := '{"job":"reconcile-subscriptions"}'::jsonb
        ) AS request_id;
      $job$
    );

  END IF;
END;
$$;
