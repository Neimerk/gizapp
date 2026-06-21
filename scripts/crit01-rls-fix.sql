-- ============================================================
-- CRIT-01 FIX — Privilege Escalation via RLS
-- Problemas encontrados na análise das policies em produção:
--   1. profiles_update permite qualquer usuário mudar seu role
--   2. seller_orders_update permite customers mudarem seus pedidos
--   3. earnings_insert (antiga) permite couriers inserirem ganhos
-- Execute no Supabase Dashboard → SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. PROFILES — bloquear alteração de role pelo próprio usuário
--    A policy profiles_update já existe e é correta para outros campos,
--    mas não restringe a coluna 'role'. Usamos um BEFORE trigger para isso.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION protect_profile_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Somente admins podem alterar o campo 'role'
  IF OLD.role IS DISTINCT FROM NEW.role AND NOT is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: alteração de role não permitida'
      USING ERRCODE = '42501';
  END IF;
  -- Somente admins podem alterar o campo 'active'
  IF OLD.active IS DISTINCT FROM NEW.active AND NOT is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: alteração de status não permitida'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Remove se já existir e recria
DROP TRIGGER IF EXISTS protect_profile_role ON profiles;
CREATE TRIGGER protect_profile_role
  BEFORE UPDATE OF role, active ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_profile_role();

-- Verificação: confirmar que o trigger está ativo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'protect_profile_role'
      AND event_object_table = 'profiles'
  ) THEN
    RAISE EXCEPTION 'ERRO: trigger protect_profile_role não foi criado';
  END IF;
  RAISE NOTICE 'OK: trigger protect_profile_role ativo em profiles';
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 2. ORDERS — remover permissão de customer atualizar seus pedidos
--    O client-side verifica o status, mas o RLS precisa garantir
--    que customers nunca possam modificar status/total/etc diretamente
-- ─────────────────────────────────────────────────────────────

-- Remover policies conflitantes
DROP POLICY IF EXISTS "orders_update"      ON orders;
DROP POLICY IF EXISTS "seller_orders_update" ON orders;

-- Nova policy: apenas admin e seller da loja podem atualizar pedidos
CREATE POLICY "orders_update" ON orders
  FOR UPDATE USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = orders.store_id
        AND stores.owner_id = auth.uid()
    )
  );

-- Verificação
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders' AND policyname = 'orders_update'
  ) THEN
    RAISE EXCEPTION 'ERRO: policy orders_update não foi criada';
  END IF;
  RAISE NOTICE 'OK: policy orders_update recriada sem customer_id';
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 3. COURIER_EARNINGS — remover policy antiga que permitia inserção direta
--    A policy 'earnings_insert' com with_check=(courier_id=auth.uid())
--    permite que couriers insiram ganhos arbitrários.
--    Ganhos só devem ser inseridos pela função update_delivery_status via service role.
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "earnings_insert"         ON courier_earnings;
DROP POLICY IF EXISTS "courier_earnings_insert" ON courier_earnings;

-- Bloquear inserção direta para qualquer role (service role bypassa RLS)
CREATE POLICY "courier_earnings_no_direct_insert" ON courier_earnings
  FOR INSERT WITH CHECK (false);

-- Verificação
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE tablename = 'courier_earnings' AND cmd = 'INSERT';

  IF v_count != 1 THEN
    RAISE EXCEPTION 'ERRO: encontradas % policies INSERT em courier_earnings (esperado 1)', v_count;
  END IF;
  RAISE NOTICE 'OK: courier_earnings INSERT bloqueado — apenas 1 policy restante';
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- RESUMO DAS MUDANÇAS
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'CRIT-01 RLS FIX aplicado com sucesso:';
  RAISE NOTICE '  [1] protect_profile_role trigger ativo';
  RAISE NOTICE '  [2] orders_update sem customer_id';
  RAISE NOTICE '  [3] courier_earnings INSERT bloqueado';
  RAISE NOTICE '==============================================';
END;
$$;
