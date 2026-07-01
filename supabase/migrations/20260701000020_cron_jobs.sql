-- ============================================================
-- Migration 020 — Cron jobs para vendor-payout e process-withdrawal
-- ============================================================

-- Habilita extensões (idempotente)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- Garante permissão para o role postgres agendar jobs
GRANT USAGE ON SCHEMA cron TO postgres;

-- Remove jobs anteriores para idempotência
SELECT cron.unschedule(jobid)
FROM   cron.job
WHERE  jobname IN ('vendor-payout-daily', 'process-withdrawal-periodic');

-- ── vendor-payout: diário às 02:00 UTC ──────────────────────────────────────
SELECT cron.schedule(
  'vendor-payout-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://cbyufprmiuwvhsxsxttn.supabase.co/functions/v1/cron-runner',
    headers := '{"Content-Type":"application/json","x-cron-key":"4d5b3f151777d4555fdbc91c919cc29693f2fda7f4b557b65a0cbda5ed7baa53"}'::jsonb,
    body    := '{"job":"vendor-payout"}'::jsonb
  ) AS request_id;
  $$
);

-- ── process-withdrawal: a cada 4 horas ──────────────────────────────────────
SELECT cron.schedule(
  'process-withdrawal-periodic',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://cbyufprmiuwvhsxsxttn.supabase.co/functions/v1/cron-runner',
    headers := '{"Content-Type":"application/json","x-cron-key":"4d5b3f151777d4555fdbc91c919cc29693f2fda7f4b557b65a0cbda5ed7baa53"}'::jsonb,
    body    := '{"job":"process-withdrawal"}'::jsonb
  ) AS request_id;
  $$
);
