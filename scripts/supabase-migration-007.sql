-- ============================================================
-- BrasUX Migration 007
-- • Tabela seller_withdrawals (saques dos vendedores)
-- • Coluna opening_hours na tabela stores (horários por dia)
-- ============================================================

-- Rodar após migration-006 no Supabase Dashboard > SQL Editor

-- ── SELLER WITHDRAWALS ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.seller_withdrawals (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount     numeric(10,2) NOT NULL CHECK (amount > 0),
  pix_key    text NOT NULL,
  status     text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PAID','REJECTED')),
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_withdrawals ENABLE ROW LEVEL SECURITY;

-- Vendedor vê e cria apenas os próprios saques
CREATE POLICY "seller_withdrawals_select" ON public.seller_withdrawals
  FOR SELECT USING (seller_id = auth.uid());

CREATE POLICY "seller_withdrawals_insert" ON public.seller_withdrawals
  FOR INSERT WITH CHECK (seller_id = auth.uid());

-- Admin vê e atualiza todos
CREATE POLICY "seller_withdrawals_admin_select" ON public.seller_withdrawals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "seller_withdrawals_admin_update" ON public.seller_withdrawals
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trigger de updated_at (usa a função já criada no schema base)
CREATE OR REPLACE TRIGGER set_seller_withdrawals_updated_at
  BEFORE UPDATE ON public.seller_withdrawals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── OPENING HOURS (stores) ─────────────────────────────────

-- Adiciona coluna JSONB para horários de funcionamento por dia da semana
-- Formato: { "seg": {"open":"09:00","close":"22:00","enabled":true}, ... }

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS opening_hours jsonb;

-- Índice GIN para consultas no JSONB (opcional, mas útil para filtros futuros)
CREATE INDEX IF NOT EXISTS stores_opening_hours_gin ON public.stores USING gin(opening_hours);
