-- ============================================================
-- Migration 015 — Correção do fluxo de pagamento
-- Problema: asaas-create-charge não registrava em payments table
--           → split nunca executava após webhook
-- ============================================================

-- ── 1. get_or_create_payment ─────────────────────────────────
-- Retorna payment_id existente ou cria novo (atômico + idempotente).
-- Chamada pelo asaas-create-charge ANTES de chamar o Asaas.
CREATE OR REPLACE FUNCTION public.get_or_create_payment(
  p_order_id    uuid,
  p_gateway     text    DEFAULT 'asaas',
  p_method      text    DEFAULT 'pix',
  p_amount      numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_payment     record;
  v_amount      numeric(12,2);
BEGIN
  -- Retorna existente (idempotência)
  SELECT id, external_id, status, pix_code, pix_qr_image, pix_expires_at,
         boleto_url, boleto_bar_code
  INTO   v_payment
  FROM   public.payments
  WHERE  order_id = p_order_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'payment_id',      v_payment.id,
      'external_id',     v_payment.external_id,
      'status',          v_payment.status,
      'pix_code',        v_payment.pix_code,
      'pix_qr_image',    v_payment.pix_qr_image,
      'pix_expires_at',  v_payment.pix_expires_at,
      'boleto_url',      v_payment.boleto_url,
      'boleto_bar_code', v_payment.boleto_bar_code,
      'is_new',          false
    );
  END IF;

  -- Resolve amount do pedido se não informado
  IF p_amount IS NULL THEN
    SELECT total INTO v_amount FROM public.orders WHERE id = p_order_id;
  ELSE
    v_amount := p_amount;
  END IF;

  -- Cria registro de pagamento
  INSERT INTO public.payments (order_id, gateway, method, amount, status)
  VALUES (p_order_id, p_gateway, p_method, v_amount, 'pending')
  RETURNING id, external_id, status, pix_code, pix_qr_image, pix_expires_at,
            boleto_url, boleto_bar_code
  INTO v_payment;

  RETURN jsonb_build_object(
    'payment_id',      v_payment.id,
    'external_id',     NULL,
    'status',          'pending',
    'is_new',          true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_payment TO service_role;

-- ── 2. update_payment_with_gateway ───────────────────────────
-- Atualiza o registro payments após retorno do Asaas.
CREATE OR REPLACE FUNCTION public.update_payment_with_gateway(
  p_payment_id   uuid,
  p_external_id  text,
  p_status       text,
  p_pix_code     text    DEFAULT NULL,
  p_pix_qr       text    DEFAULT NULL,
  p_pix_expires  text    DEFAULT NULL,
  p_boleto_url   text    DEFAULT NULL,
  p_boleto_code  text    DEFAULT NULL,
  p_gateway_resp jsonb   DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.payments SET
    external_id      = p_external_id,
    status           = p_status,
    pix_code         = COALESCE(p_pix_code,    pix_code),
    pix_qr_image     = COALESCE(p_pix_qr,      pix_qr_image),
    pix_expires_at   = CASE WHEN p_pix_expires IS NOT NULL
                             THEN p_pix_expires::timestamptz
                             ELSE pix_expires_at END,
    boleto_url       = COALESCE(p_boleto_url,   boleto_url),
    boleto_bar_code  = COALESCE(p_boleto_code,  boleto_bar_code),
    gateway_response = COALESCE(p_gateway_resp, gateway_response)
  WHERE id = p_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_payment_with_gateway TO service_role;

-- ── 3. Índice extra em payments para idempotência ────────────
CREATE INDEX IF NOT EXISTS payments_idempotency_idx ON public.payments(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
