-- =====================================================================
-- Substitui current_setting('app.*') por tabela de config interna.
-- ALTER DATABASE SET é bloqueado pelo Supabase para params customizados;
-- a tabela abaixo é acessível ao pg_cron (roda como postgres/superuser).
-- =====================================================================

-- Tabela de configuração interna para pg_cron
CREATE TABLE IF NOT EXISTS public._cron_config (
  key   text NOT NULL PRIMARY KEY,
  value text NOT NULL
);

-- Bloqueia acesso público; service_role e superuser mantêm acesso.
ALTER TABLE public._cron_config ENABLE ROW LEVEL SECURITY;
-- Sem policy pública = nenhum acesso a anon/authenticated.
-- pg_cron roda como superuser (bypassa RLS) → consegue ler.

-- Insere placeholders; valores reais atualizados via migration apply.
INSERT INTO public._cron_config (key, value) VALUES
  ('cron_key',     'PLACEHOLDER'),
  ('internal_key', 'PLACEHOLDER'),
  ('supabase_url', 'https://cbyufprmiuwvhsxsxttn.supabase.co')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Função helper (security definer) para os jobs lerem o config
CREATE OR REPLACE FUNCTION public._get_cron_cfg(p_key text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public._cron_config WHERE key = p_key;
$$;

-- ── Reagenda os cron jobs usando a função helper ───────────────────

SELECT cron.unschedule(jobid)
FROM   cron.job
WHERE  jobname IN (
  'vendor-payout-daily',
  'process-pending-withdrawals',
  'alert-dead-letter-periodic'
);

SELECT cron.schedule(
  'vendor-payout-daily',
  '0 2 * * *',
  $job$
    SELECT net.http_post(
      url     := public._get_cron_cfg('supabase_url') || '/functions/v1/cron-runner',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-key',   public._get_cron_cfg('cron_key')
      ),
      body    := '{"job":"vendor-payout"}'::jsonb
    ) AS request_id;
  $job$
);

SELECT cron.schedule(
  'process-pending-withdrawals',
  '0 */4 * * *',
  $job$
    SELECT net.http_post(
      url     := public._get_cron_cfg('supabase_url') || '/functions/v1/cron-runner',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-key',   public._get_cron_cfg('cron_key')
      ),
      body    := '{"job":"process-withdrawal"}'::jsonb
    ) AS request_id;
  $job$
);

SELECT cron.schedule(
  'alert-dead-letter-periodic',
  '0 */6 * * *',
  $job$
    SELECT net.http_post(
      url     := public._get_cron_cfg('supabase_url') || '/functions/v1/alert-dead-letter',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'x-internal-key', public._get_cron_cfg('internal_key')
      ),
      body    := '{}'::jsonb
    ) AS request_id;
  $job$
);
