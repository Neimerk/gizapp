-- =============================================================================
-- FIX: use_coupon_atomic — substitui EXISTS+INSERT por INSERT ON CONFLICT
--
-- Bug: EXISTS check e INSERT não são atômicos. Se outro request paralelo
-- inserir entre o EXISTS e o INSERT, o INSERT falha com violação de PK
-- (PRIMARY KEY em user_coupons é (user_id, coupon_id)) e a mensagem de erro
-- não contém "ALREADY_USED" → cai no fallback "Erro ao aplicar cupom."
--
-- Fix: INSERT … ON CONFLICT (user_id, coupon_id) DO NOTHING + ROW_COUNT = 0
-- =============================================================================

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
  v_inserted    integer;
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
    -- INSERT ON CONFLICT garante atomicidade: se já existe (uso anterior ou
    -- request concorrente), DO NOTHING → ROW_COUNT = 0 → ALREADY_USED.
    INSERT INTO public.user_coupons (user_id, coupon_id)
    VALUES (p_user_id, v_coupon.id)
    ON CONFLICT (user_id, coupon_id) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted = 0 THEN
      RAISE EXCEPTION 'ALREADY_USED';
    END IF;

  ELSIF p_guest_session_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.guest_coupon_uses
      WHERE guest_session_id = p_guest_session_id AND coupon_id = v_coupon.id
    ) THEN
      RAISE EXCEPTION 'ALREADY_USED';
    END IF;

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
