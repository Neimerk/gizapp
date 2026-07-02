-- ============================================================
-- Migration 022 — Payments Schema V2 + Courier PIX Fix
--
-- Corrige três gaps que impedem brasux-entregas de funcionar:
--
--   1. courier_pix_accounts: UNIQUE (courier_id) → partial unique
--      para permitir histórico de chaves (savePixAccount insere nova
--      após desativar a anterior).
--
--   2. payments: adiciona colunas esperadas por paymentService.ts e
--      migration 018 (create_payment_with_splits, get_order_payment_public).
--      Usa trigger bidirecional para manter aliases em sincronia com
--      as colunas legadas (pix_code ↔ pix_copy_paste, etc.).
--
--   3. get_wallet_balance: estende retorno com `processing` e `lifetime`
--      para satisfazer CourierWalletFull sem colunas físicas na tabela.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. COURIER_PIX_ACCOUNTS — troca UNIQUE simples por índice parcial
-- ════════════════════════════════════════════════════════════

-- Remove o UNIQUE (courier_id) que bloqueia histórico de chaves
ALTER TABLE public.courier_pix_accounts
  DROP CONSTRAINT IF EXISTS courier_pix_accounts_courier_id_key;

-- Garante apenas UMA chave ativa por entregador (histórico ilimitado)
DROP INDEX IF EXISTS public.courier_pix_active_unique_idx;
CREATE UNIQUE INDEX courier_pix_active_unique_idx
  ON public.courier_pix_accounts (courier_id)
  WHERE active = true;

-- Políticas permissivas (INSERT/UPDATE próprias)
DROP POLICY IF EXISTS "courier_pix_own_insert" ON public.courier_pix_accounts;
CREATE POLICY "courier_pix_own_insert" ON public.courier_pix_accounts
  FOR INSERT WITH CHECK (courier_id = auth.uid());

DROP POLICY IF EXISTS "courier_pix_own_update" ON public.courier_pix_accounts;
CREATE POLICY "courier_pix_own_update" ON public.courier_pix_accounts
  FOR UPDATE USING (courier_id = auth.uid());

-- ════════════════════════════════════════════════════════════
-- 2. PAYMENTS — colunas faltando para brasux-entregas
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.payments
  -- Partes envolvidas (ausentes na migration 008)
  ADD COLUMN IF NOT EXISTS customer_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vendor_id           uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Identificadores Asaas (alias de external_id)
  ADD COLUMN IF NOT EXISTS asaas_payment_id    text,
  ADD COLUMN IF NOT EXISTS asaas_customer_id   text,
  -- Alias para method (brasux-entregas usa credit_card/debit_card; legado usa card)
  ADD COLUMN IF NOT EXISTS payment_method      text,
  -- Aliases de PIX
  ADD COLUMN IF NOT EXISTS pix_qr_code         text,       -- alias pix_qr_image
  ADD COLUMN IF NOT EXISTS pix_copy_paste      text,       -- alias pix_code
  ADD COLUMN IF NOT EXISTS pix_expiration_date timestamptz, -- alias pix_expires_at
  -- Aliases de boleto
  ADD COLUMN IF NOT EXISTS boleto_barcode      text,       -- alias boleto_bar_code
  ADD COLUMN IF NOT EXISTS boleto_due_date     date,
  -- Financeiro
  ADD COLUMN IF NOT EXISTS net_amount          numeric(12,2),
  -- Timestamps de confirmação
  ADD COLUMN IF NOT EXISTS confirmed_at        timestamptz,
  ADD COLUMN IF NOT EXISTS received_at         timestamptz,
  -- Campos descritivos
  ADD COLUMN IF NOT EXISTS description         text,
  ADD COLUMN IF NOT EXISTS external_reference  text;

-- Backfill: propaga dados das colunas legadas para os aliases
UPDATE public.payments SET
  asaas_payment_id    = external_id,
  payment_method      = CASE method WHEN 'card' THEN 'credit_card' ELSE method END,
  pix_qr_code         = pix_qr_image,
  pix_copy_paste      = pix_code,
  pix_expiration_date = pix_expires_at,
  boleto_barcode      = boleto_bar_code
WHERE asaas_payment_id IS NULL;

-- ── Índices para as novas colunas ────────────────────────────
CREATE INDEX IF NOT EXISTS payments_customer_id_idx
  ON public.payments (customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_vendor_id_idx
  ON public.payments (vendor_id)
  WHERE vendor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_asaas_id_idx
  ON public.payments (asaas_payment_id)
  WHERE asaas_payment_id IS NOT NULL;

-- ── RLS: clientes podem ler pagamentos próprios via customer_id ─
DROP POLICY IF EXISTS "payments_customer_own" ON public.payments;
CREATE POLICY "payments_customer_own" ON public.payments
  FOR SELECT USING (customer_id = auth.uid());

-- ── Trigger: mantém aliases em sincronia (bidirecional) ──────
CREATE OR REPLACE FUNCTION public.sync_payment_aliases()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  -- external_id ↔ asaas_payment_id
  IF NEW.asaas_payment_id IS NOT NULL THEN
    NEW.external_id := NEW.asaas_payment_id;
  ELSIF NEW.external_id IS NOT NULL AND NEW.asaas_payment_id IS NULL THEN
    NEW.asaas_payment_id := NEW.external_id;
  END IF;

  -- method ↔ payment_method  (normaliza formatos diferentes entre apps)
  IF NEW.payment_method IS NOT NULL AND NEW.method IS NULL THEN
    NEW.method := CASE NEW.payment_method
      WHEN 'credit_card' THEN 'card'
      WHEN 'debit_card'  THEN 'card'
      ELSE NEW.payment_method
    END;
  ELSIF NEW.method IS NOT NULL AND NEW.payment_method IS NULL THEN
    NEW.payment_method := CASE NEW.method
      WHEN 'card' THEN 'credit_card'
      ELSE NEW.method
    END;
  END IF;

  -- PIX: pix_qr_image ↔ pix_qr_code
  IF NEW.pix_qr_code IS NOT NULL THEN
    NEW.pix_qr_image := NEW.pix_qr_code;
  ELSIF NEW.pix_qr_image IS NOT NULL AND NEW.pix_qr_code IS NULL THEN
    NEW.pix_qr_code := NEW.pix_qr_image;
  END IF;

  -- PIX: pix_code ↔ pix_copy_paste
  IF NEW.pix_copy_paste IS NOT NULL THEN
    NEW.pix_code := NEW.pix_copy_paste;
  ELSIF NEW.pix_code IS NOT NULL AND NEW.pix_copy_paste IS NULL THEN
    NEW.pix_copy_paste := NEW.pix_code;
  END IF;

  -- PIX: pix_expires_at ↔ pix_expiration_date
  IF NEW.pix_expiration_date IS NOT NULL THEN
    NEW.pix_expires_at := NEW.pix_expiration_date;
  ELSIF NEW.pix_expires_at IS NOT NULL AND NEW.pix_expiration_date IS NULL THEN
    NEW.pix_expiration_date := NEW.pix_expires_at;
  END IF;

  -- Boleto: boleto_bar_code ↔ boleto_barcode
  IF NEW.boleto_barcode IS NOT NULL THEN
    NEW.boleto_bar_code := NEW.boleto_barcode;
  ELSIF NEW.boleto_bar_code IS NOT NULL AND NEW.boleto_barcode IS NULL THEN
    NEW.boleto_barcode := NEW.boleto_bar_code;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_sync_aliases ON public.payments;
CREATE TRIGGER payments_sync_aliases
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_payment_aliases();

-- ════════════════════════════════════════════════════════════
-- 3. GET_WALLET_BALANCE — adiciona processing + lifetime
-- ════════════════════════════════════════════════════════════
-- Backwards compatible: quem já usava {available, held, total} continua
-- funcionando; brasux-entregas agora recebe também processing e lifetime.

CREATE OR REPLACE FUNCTION public.get_wallet_balance(p_wallet_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_available  numeric(12,2) := 0;
  v_held       numeric(12,2) := 0;
  v_lifetime   numeric(12,2) := 0;
  v_processing numeric(12,2) := 0;
BEGIN
  SELECT
    COALESCE(SUM(CASE
      WHEN direction = 'in'  AND status = 'available' THEN  amount
      WHEN direction = 'out' AND status = 'completed' THEN -amount
      ELSE 0
    END), 0),
    COALESCE(SUM(CASE
      WHEN direction = 'in' AND status = 'held' THEN amount
      ELSE 0
    END), 0),
    COALESCE(SUM(CASE
      WHEN direction = 'in' AND status IN ('available', 'completed') THEN amount
      ELSE 0
    END), 0)
  INTO v_available, v_held, v_lifetime
  FROM public.wallet_transactions
  WHERE wallet_id = p_wallet_id;

  -- Saques em andamento = saldo em trânsito (não disponível, não "held")
  SELECT COALESCE(SUM(amount_gross), 0)
  INTO v_processing
  FROM public.withdrawals
  WHERE wallet_id = p_wallet_id
    AND status = 'processing';

  RETURN jsonb_build_object(
    'available',  GREATEST(v_available, 0),
    'held',       GREATEST(v_held, 0),
    'processing', GREATEST(v_processing, 0),
    'total',      GREATEST(v_available, 0) + GREATEST(v_held, 0),
    'lifetime',   GREATEST(v_lifetime, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_wallet_balance(uuid) TO authenticated, service_role;
