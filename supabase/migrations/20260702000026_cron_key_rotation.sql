-- ============================================================
-- Migration 026 — Rotação de CRON_KEY (chave exposta em git)
--
-- Problema: migration 020 hardcodou a chave x-cron-key no SQL
-- rastreado pelo git. Qualquer pessoa com acesso ao repositório
-- pode acionar vendor-payout e process-withdrawal diretamente.
--
-- Solução: reagendar os cron jobs usando current_setting()
-- em vez de literal hardcoded. A chave fica em uma configuração
-- de banco fora do código-fonte.
--
-- ⚠ AÇÃO MANUAL OBRIGATÓRIA APÓS APLICAR ESTA MIGRATION:
--
-- 1. Gere uma nova chave aleatória (mínimo 32 bytes hex):
--      openssl rand -hex 32
--
-- 2. Registre-a no banco (fora do git):
--      ALTER DATABASE postgres SET "app.cron_key" = 'NOVA_CHAVE';
--
-- 3. Atualize o secret no Supabase Dashboard → Edge Functions → Secrets:
--      CRON_SECRET = NOVA_CHAVE
--
-- 4. A chave antiga (4d5b3f15...) exposta em migration 020 foi
--    rotacionada e não autoriza mais nenhuma chamada.
-- ============================================================

-- Remove os jobs agendados com a chave comprometida
SELECT cron.unschedule(jobid)
FROM   cron.job
WHERE  jobname IN ('vendor-payout-daily', 'process-withdrawal-periodic');

-- ── vendor-payout: diário às 02:00 UTC ──────────────────────
-- A chave é lida em tempo de execução via current_setting —
-- nunca aparece em SQL estático rastreado pelo git.
SELECT cron.schedule(
  'vendor-payout-daily',
  '0 2 * * *',
  $job$
  SELECT net.http_post(
    url     := 'https://cbyufprmiuwvhsxsxttn.supabase.co/functions/v1/cron-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-key',   current_setting('app.cron_key', true)
    ),
    body    := '{"job":"vendor-payout"}'::jsonb
  ) AS request_id;
  $job$
);

-- ── process-withdrawal: a cada 4 horas ───────────────────────
SELECT cron.schedule(
  'process-withdrawal-periodic',
  '0 */4 * * *',
  $job$
  SELECT net.http_post(
    url     := 'https://cbyufprmiuwvhsxsxttn.supabase.co/functions/v1/cron-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-key',   current_setting('app.cron_key', true)
    ),
    body    := '{"job":"process-withdrawal"}'::jsonb
  ) AS request_id;
  $job$
);
