-- ============================================================
-- BrasUX Migration 011 — Define admin principal
-- ============================================================
-- Promove albertoneimerk@gmail.com a admin e garante conta ativa.
-- Idempotente: não falha se o usuário ainda não tiver conta;
-- basta criar a conta e rodar novamente.

UPDATE public.profiles
SET    role   = 'admin',
       active = true
WHERE  id = (
  SELECT id FROM auth.users WHERE email = 'albertoneimerk@gmail.com'
);
