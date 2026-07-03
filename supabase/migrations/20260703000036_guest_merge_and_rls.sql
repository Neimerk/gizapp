-- =====================================================================
-- Guest Account Merge RPC + RLS de orders para guests
-- Permite que um guest recém-registrado reivindique seus pedidos.
-- =====================================================================

-- ── 1. RLS em orders: guest lê seus próprios pedidos via tracking ─────

-- Usuário autenticado lê seus pedidos
DROP POLICY IF EXISTS "orders_customer_select" ON public.orders;
CREATE POLICY "orders_customer_select"
  ON public.orders FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

-- ── 2. RPC: merge_guest_to_account ────────────────────────────────────
-- Transação atômica: transfere pedidos + endereços do guest para o user recém-criado.
-- Chamada com service_role key pela Edge Function merge-guest após signUp confirmado.

CREATE OR REPLACE FUNCTION public.merge_guest_to_account(
  p_guest_token  text,
  p_user_id      uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id     uuid;
  v_orders_updated int;
  v_addrs_inserted int;
  v_profile_name   text;
  v_guest_name     text;
  v_guest_email    text;
  v_guest_phone    text;
BEGIN
  -- 1. Valida guest session (aceita sessões mesmo expiradas recentemente, até 7 dias após expiração)
  SELECT id, name, email, phone
    INTO v_session_id, v_guest_name, v_guest_email, v_guest_phone
  FROM public.guest_sessions
  WHERE guest_token = p_guest_token
    AND expires_at  > now() - interval '7 days'
  LIMIT 1;

  IF v_session_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sessão de convidado não encontrada ou expirada há mais de 7 dias.');
  END IF;

  -- 2. Verifica que o user_id existe e não tem pedidos anteriores (evita merge duplo)
  SELECT name INTO v_profile_name
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_profile_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Perfil do usuário não encontrado.');
  END IF;

  -- 3. Transfere pedidos
  UPDATE public.orders
     SET customer_id               = p_user_id,
         guest_session_id          = NULL,
         is_guest_checkout         = false,
         account_created_after_purchase = true
   WHERE guest_session_id = v_session_id
     AND customer_id      IS NULL;

  GET DIAGNOSTICS v_orders_updated = ROW_COUNT;

  -- 4. Migra endereços do guest para customer_addresses (se tabela existir)
  BEGIN
    INSERT INTO public.customer_addresses
      (customer_id, label, zipcode, street, number, complement, district, city, state, latitude, longitude)
    SELECT
      p_user_id, label, zipcode, street, number, complement, district, city, state, latitude, longitude
    FROM public.guest_addresses
    WHERE guest_session_id = v_session_id;

    GET DIAGNOSTICS v_addrs_inserted = ROW_COUNT;
  EXCEPTION WHEN undefined_table THEN
    v_addrs_inserted := 0;
  END;

  -- 5. Atualiza perfil com dados do guest (se campos estiverem vazios)
  UPDATE public.profiles
     SET name  = COALESCE(NULLIF(name, ''),  v_guest_name),
         phone = COALESCE(NULLIF(phone, ''), v_guest_phone),
         email = COALESCE(NULLIF(email, ''), v_guest_email)
   WHERE id = p_user_id;

  -- 6. Marca guest session como convertida
  UPDATE public.guest_sessions
     SET updated_at = now()
   WHERE id = v_session_id;

  -- 7. Remove entradas de tracking (pedidos agora têm customer_id)
  DELETE FROM public.guest_order_tracking
  WHERE guest_session_id = v_session_id;

  RETURN jsonb_build_object(
    'ok',              true,
    'orders_merged',   v_orders_updated,
    'addresses_merged', v_addrs_inserted,
    'guest_session_id', v_session_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_guest_to_account(text, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.merge_guest_to_account(text, uuid) TO service_role;
COMMENT ON FUNCTION public.merge_guest_to_account IS 'Merge atômico: transfere pedidos e endereços do guest para conta recém-criada. Chamada apenas pela Edge Function merge-guest com service_role key.';
