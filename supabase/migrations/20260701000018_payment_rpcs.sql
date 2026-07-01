-- ============================================================
-- Migration 018 — RPCs de pagamento para brasux-entregas
-- create_payment_with_splits  : registra pagamento + retorna UUID
-- get_order_payment_public    : dados PIX/boleto para tela de tracking
-- emit_financial_event        : alias amigável de log_financial_event
-- ============================================================

-- ── 1. create_payment_with_splits ────────────────────────────
-- Chamada por: supabase/functions/create-payment (brasux-entregas)
-- Insere registro em payments e retorna o UUID criado.
CREATE OR REPLACE FUNCTION public.create_payment_with_splits(
  p_order_id           uuid,
  p_customer_id        uuid,
  p_vendor_id          uuid,
  p_amount             numeric,
  p_payment_method     text,
  p_asaas_payment_id   text,
  p_asaas_customer_id  text  DEFAULT NULL,
  p_idempotency_key    text  DEFAULT NULL,
  p_description        text  DEFAULT NULL,
  p_metadata           jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Idempotência por chave
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_id
    FROM public.payments
    WHERE idempotency_key = p_idempotency_key;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  INSERT INTO public.payments (
    order_id,
    customer_id,
    vendor_id,
    gateway,
    external_id,
    asaas_payment_id,
    asaas_customer_id,
    method,
    payment_method,
    amount,
    status,
    description,
    idempotency_key,
    metadata
  ) VALUES (
    p_order_id,
    p_customer_id,
    p_vendor_id,
    'asaas',
    p_asaas_payment_id,
    p_asaas_payment_id,
    p_asaas_customer_id,
    lower(p_payment_method),
    lower(p_payment_method),
    p_amount,
    'pending',
    p_description,
    p_idempotency_key,
    COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_id;

  -- Cria split_rules vazio (será preenchido pelo webhook ao confirmar)
  INSERT INTO public.split_rules (order_id, payment_id, products_amount, delivery_amount,
    service_fee, commission_rate, commission_amount, vendor_net)
  VALUES (p_order_id, v_id, p_amount, 0, 0, 0, 0, p_amount)
  ON CONFLICT DO NOTHING;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_payment_with_splits TO service_role, authenticated;

-- ── 2. get_order_payment_public ──────────────────────────────
-- Retorna dados de pagamento necessários para a tela de tracking/acompanhamento.
-- Não expõe dados sensíveis do cliente.
CREATE OR REPLACE FUNCTION public.get_order_payment_public(
  p_order_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row record;
BEGIN
  SELECT
    id,
    status,
    COALESCE(payment_method, method)  AS payment_method,
    amount,
    -- Colunas de PIX (suporta ambos os esquemas)
    COALESCE(pix_qr_code,  pix_qr_image)   AS pix_qr_code,
    COALESCE(pix_copy_paste, pix_code)      AS pix_copy_paste,
    COALESCE(pix_expiration_date::text, pix_expires_at::text) AS pix_expiration_date,
    -- Boleto
    boleto_url,
    COALESCE(boleto_barcode, boleto_bar_code) AS boleto_barcode,
    boleto_due_date::text,
    -- Timestamps
    confirmed_at,
    created_at
  INTO v_row
  FROM public.payments
  WHERE order_id = p_order_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'payment_id',          v_row.id,
    'status',              v_row.status,
    'payment_method',      v_row.payment_method,
    'amount',              v_row.amount,
    'pix_qr_code',         v_row.pix_qr_code,
    'pix_copy_paste',      v_row.pix_copy_paste,
    'pix_expiration_date', v_row.pix_expiration_date,
    'boleto_url',          v_row.boleto_url,
    'boleto_barcode',      v_row.boleto_barcode,
    'boleto_due_date',     v_row.boleto_due_date,
    'confirmed_at',        v_row.confirmed_at,
    'created_at',          v_row.created_at
  );
END;
$$;

-- Permite anon ler dados de tracking (não expõe dados financeiros sensíveis)
GRANT EXECUTE ON FUNCTION public.get_order_payment_public TO anon, authenticated, service_role;

-- ── 3. emit_financial_event ──────────────────────────────────
-- Já existe no banco com a assinatura correta usada por create-payment.
-- Apenas garante permissões caso necessário.
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.emit_financial_event(
    text, jsonb, uuid, uuid, uuid, uuid, uuid, uuid, numeric, text, text
  ) TO service_role, authenticated;
EXCEPTION WHEN undefined_function THEN
  NULL; -- função não existe, ignora
END $$;
