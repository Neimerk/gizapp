-- ============================================================
-- BrasUX Migration 011 — Saldo materializado (performance de escala)
-- IDEMPOTENTE. Rodar após a migration-010.
--
-- Resolve (auditoria, MÉDIO): get_wallet_balance fazia SUM O(n) sobre TODO
-- o histórico a cada leitura de saldo/saque. Agora o saldo fica materializado
-- em `wallets`, mantido por trigger com deltas O(1) a cada mudança no ledger.
--
-- O ledger (wallet_transactions) continua sendo a FONTE DE VERDADE e
-- append-only. As colunas em `wallets` são apenas cache derivado e
-- reconstruível (ver public.recompute_wallet_balance / backfill abaixo).
-- ============================================================

-- ── 1. Colunas de cache em wallets ──────────────────────────
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS bal_available numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bal_held      numeric(12,2) NOT NULL DEFAULT 0;

-- ── 2. Contribuição de UMA transação ao saldo ───────────────
-- Retorna (d_available, d_held) conforme direção/status.
--   in  + held       → (0, +amount)        retido
--   in  + available  → (+amount, 0)        liberado
--   out + completed  → (-amount, 0)        saque/débito efetivado
--   reversed / outros→ (0, 0)              não conta
CREATE OR REPLACE FUNCTION public.wt_balance_delta(
  p_direction text,
  p_status    text,
  p_amount    numeric
) RETURNS numeric[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_direction = 'in'  AND p_status = 'held'      THEN ARRAY[0::numeric, p_amount]
    WHEN p_direction = 'in'  AND p_status = 'available' THEN ARRAY[p_amount, 0::numeric]
    WHEN p_direction = 'out' AND p_status = 'completed' THEN ARRAY[-p_amount, 0::numeric]
    ELSE ARRAY[0::numeric, 0::numeric]
  END;
$$;

-- ── 3. Trigger: mantém o cache em wallets com deltas O(1) ────
CREATE OR REPLACE FUNCTION public.sync_wallet_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  d_old numeric[] := ARRAY[0::numeric, 0::numeric];
  d_new numeric[] := ARRAY[0::numeric, 0::numeric];
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    d_old := public.wt_balance_delta(OLD.direction, OLD.status, OLD.amount);
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN
    d_new := public.wt_balance_delta(NEW.direction, NEW.status, NEW.amount);
  END IF;

  -- DELETE de uma carteira diferente não ocorre; usa a carteira relevante.
  IF TG_OP = 'DELETE' THEN
    UPDATE public.wallets
      SET bal_available = bal_available - d_old[1],
          bal_held      = bal_held      - d_old[2]
      WHERE id = OLD.wallet_id;
    RETURN OLD;
  ELSE
    -- Se a transação mudou de carteira (raro), corrige as duas.
    IF TG_OP = 'UPDATE' AND NEW.wallet_id <> OLD.wallet_id THEN
      UPDATE public.wallets
        SET bal_available = bal_available - d_old[1],
            bal_held      = bal_held      - d_old[2]
        WHERE id = OLD.wallet_id;
      UPDATE public.wallets
        SET bal_available = bal_available + d_new[1],
            bal_held      = bal_held      + d_new[2]
        WHERE id = NEW.wallet_id;
    ELSE
      UPDATE public.wallets
        SET bal_available = bal_available + (d_new[1] - d_old[1]),
            bal_held      = bal_held      + (d_new[2] - d_old[2])
        WHERE id = NEW.wallet_id;
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_wallet_balance ON public.wallet_transactions;
CREATE TRIGGER trg_sync_wallet_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_wallet_balance();

-- ── 4. Recalcular o cache de uma carteira a partir do ledger ─
-- (ferramenta de reconciliação; o cache é sempre reconstruível)
CREATE OR REPLACE FUNCTION public.recompute_wallet_balance(p_wallet_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.wallets w
  SET bal_available = COALESCE(s.av, 0),
      bal_held      = COALESCE(s.hl, 0)
  FROM (
    SELECT
      SUM(CASE WHEN direction='in'  AND status='available' THEN amount
               WHEN direction='out' AND status='completed' THEN -amount
               ELSE 0 END) AS av,
      SUM(CASE WHEN direction='in'  AND status='held' THEN amount ELSE 0 END) AS hl
    FROM public.wallet_transactions
    WHERE wallet_id = p_wallet_id
  ) s
  WHERE w.id = p_wallet_id;
END;
$$;

-- ── 5. Backfill: reconstrói o cache de TODAS as carteiras ───
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.wallets LOOP
    PERFORM public.recompute_wallet_balance(r.id);
  END LOOP;
END $$;

-- ── 6. get_wallet_balance agora lê o cache (O(1)) ───────────
CREATE OR REPLACE FUNCTION public.get_wallet_balance(
  p_wallet_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_available numeric(12,2) := 0;
  v_held      numeric(12,2) := 0;
BEGIN
  SELECT bal_available, bal_held
  INTO   v_available, v_held
  FROM   public.wallets
  WHERE  id = p_wallet_id;

  RETURN jsonb_build_object(
    'available', COALESCE(v_available, 0),
    'held',      COALESCE(v_held, 0),
    'total',     COALESCE(v_available, 0) + COALESCE(v_held, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_wallet_balance(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_wallet_balance(uuid) TO authenticated, service_role;

-- ============================================================
-- FIM da migration 011
-- ============================================================
