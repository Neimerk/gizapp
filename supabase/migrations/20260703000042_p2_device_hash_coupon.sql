-- =====================================================================
-- P2: use_coupon_atomic — verificação cross-session via device_hash
--
-- P1 já rastreia uso por guest_session_id. O gap: usuário limpa o
-- localStorage e obtém um novo guest_token/sessão → bypassa o controle.
-- Fix: quando device_hash está disponível, verifica se QUALQUER outra
-- sessão do mesmo dispositivo já usou o cupom.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.use_coupon_atomic(
  p_code             text,
  p_user_id          uuid DEFAULT NULL,
  p_guest_session_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_coupon      record;
  v_device_hash text;
BEGIN
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

  IF p_user_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.user_coupons
      WHERE user_id = p_user_id AND coupon_id = v_coupon.id
    ) THEN
      RAISE EXCEPTION 'ALREADY_USED';
    END IF;
    INSERT INTO public.user_coupons (user_id, coupon_id)
    VALUES (p_user_id, v_coupon.id);

  ELSIF p_guest_session_id IS NOT NULL THEN
    -- Checar esta sessão específica
    IF EXISTS (
      SELECT 1 FROM public.guest_coupon_uses
      WHERE guest_session_id = p_guest_session_id AND coupon_id = v_coupon.id
    ) THEN
      RAISE EXCEPTION 'ALREADY_USED';
    END IF;

    -- Checar cross-session: mesmo dispositivo (device_hash) já usou este cupom?
    SELECT device_hash INTO v_device_hash
    FROM   public.guest_sessions
    WHERE  id = p_guest_session_id;

    IF v_device_hash IS NOT NULL AND v_device_hash != '' THEN
      IF EXISTS (
        SELECT 1
        FROM   public.guest_coupon_uses  gcu
        JOIN   public.guest_sessions     gs  ON gs.id = gcu.guest_session_id
        WHERE  gcu.coupon_id   = v_coupon.id
          AND  gs.device_hash  = v_device_hash
      ) THEN
        RAISE EXCEPTION 'ALREADY_USED';
      END IF;
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

-- Índice para acelerar a busca cross-session por device_hash
CREATE INDEX IF NOT EXISTS guest_sessions_device_hash_idx
  ON public.guest_sessions (device_hash)
  WHERE device_hash IS NOT NULL AND device_hash != '';
