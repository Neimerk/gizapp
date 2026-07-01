-- ============================================================
-- Migration 014 — check_rate_limit + courier_withdrawals
-- Corrige: RPC ausente que causava runtime error em asaas-create-charge
--          Tabela courier_withdrawals referenciada em gizApi mas sem schema
-- ============================================================

-- ── 1. RATE LIMIT LOG ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  key      text        NOT NULL,
  hit_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rll_key_hit_idx ON public.rate_limit_log(key, hit_at DESC);

-- TTL automático: remove entradas mais antigas de 1 hora via cron (ou na próxima chamada)
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rll_service_only" ON public.rate_limit_log FOR ALL USING (false);

-- ── 2. FUNÇÃO check_rate_limit ───────────────────────────────
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key            text,
  p_max_requests   int,
  p_window_seconds int
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count int;
BEGIN
  -- Remove entradas expiradas da janela atual
  DELETE FROM public.rate_limit_log
  WHERE key    = p_key
    AND hit_at < now() - (p_window_seconds || ' seconds')::interval;

  -- Conta hits na janela
  SELECT COUNT(*) INTO v_count
  FROM public.rate_limit_log
  WHERE key = p_key;

  IF v_count >= p_max_requests THEN
    RETURN false;
  END IF;

  INSERT INTO public.rate_limit_log (key) VALUES (p_key);
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit TO service_role, authenticated;

-- ── 3. COURIER_WITHDRAWALS ───────────────────────────────────
-- Tabela legada referenciada em gizApi.ts — precisa existir para evitar runtime errors.
-- O sistema novo usa `withdrawals` + `wallets` (migration 008).
CREATE TABLE IF NOT EXISTS public.courier_withdrawals (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id  uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      numeric(12,2) NOT NULL CHECK (amount > 0),
  pix_key     text          NOT NULL,
  status      text          NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING','PAID','REJECTED')),
  note        text,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.courier_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cw_courier_own_read"  ON public.courier_withdrawals
  FOR SELECT USING (courier_id = auth.uid());

CREATE POLICY "cw_courier_own_write" ON public.courier_withdrawals
  FOR INSERT WITH CHECK (courier_id = auth.uid());

CREATE POLICY "cw_admin_all" ON public.courier_withdrawals
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS cw_courier_idx ON public.courier_withdrawals(courier_id);
CREATE INDEX IF NOT EXISTS cw_status_idx  ON public.courier_withdrawals(status);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_courier_withdrawals_updated_at'
  ) THEN
    CREATE TRIGGER set_courier_withdrawals_updated_at
      BEFORE UPDATE ON public.courier_withdrawals
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

GRANT ALL ON public.courier_withdrawals TO service_role;
GRANT SELECT, INSERT ON public.courier_withdrawals TO authenticated;
