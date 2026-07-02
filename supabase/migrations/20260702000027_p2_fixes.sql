-- =====================================================================
-- P2 quality fixes: cleanup rate_limit_log + alert-dead-letter cron
-- =====================================================================

-- 1. Limpeza periódica de rate_limit_log (entradas > 1h)
--    Executa a cada hora para manter a tabela enxuta.
SELECT cron.unschedule(jobid)
FROM   cron.job
WHERE  jobname = 'cleanup-rate-limit-log';

SELECT cron.schedule(
  'cleanup-rate-limit-log',
  '0 * * * *',                    -- toda hora
  $$
    DELETE FROM public.rate_limit_log
    WHERE  hit_at < now() - INTERVAL '1 hour';
  $$
);

-- 2. Alertas de dead_letter a cada 6h
--    Usa current_setting para não expor INTERNAL_FUNCTION_KEY literalmente no banco.
SELECT cron.unschedule(jobid)
FROM   cron.job
WHERE  jobname = 'alert-dead-letter-periodic';

SELECT cron.schedule(
  'alert-dead-letter-periodic',
  '0 */6 * * *',                  -- a cada 6 horas
  $job$
    SELECT net.http_post(
      url     := current_setting('app.supabase_url', true) || '/functions/v1/alert-dead-letter',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'x-internal-key', current_setting('app.internal_key', true)
      ),
      body    := '{}'::jsonb
    ) AS request_id;
  $job$
);

-- Ação manual necessária após aplicar esta migration (uma vez):
--   ALTER DATABASE postgres SET "app.supabase_url" = 'https://<project-ref>.supabase.co';
--   ALTER DATABASE postgres SET "app.internal_key"  = '<INTERNAL_FUNCTION_KEY>';
-- (mesma convenção usada para app.cron_key em migration 026)
