-- =====================================================================
-- Ações manuais obrigatórias para ativar os cron jobs.
-- Esta migration NÃO tem SQL executável — os valores são segredos
-- que precisam ser inseridos pelo operador após o deploy.
--
-- PASSO 1 — Supabase Dashboard > Edge Functions > Secrets
--   Certifique-se que os seguintes secrets EXISTEM:
--     INTERNAL_FUNCTION_KEY   (chave interna function-to-function)
--     CRON_SECRET             (chave do cron-runner, header x-cron-key)
--     ASAAS_API_KEY           (chave da conta Asaas)
--     ASAAS_WEBHOOK_TOKEN     (token de acesso do webhook de marketplace)
--     ASAAS_WEBHOOK_HMAC_SECRET (secret HMAC do webhook de marketplace)
--     ASAAS_SUBSCRIPTION_WEBHOOK_TOKEN (token do webhook de assinaturas)
--     ASAAS_SUBSCRIPTION_HMAC_SECRET  (secret HMAC do webhook de assinaturas)
--     RESEND_API_KEY          (para e-mails transacionais)
--
-- PASSO 2 — Supabase Dashboard > SQL Editor
--   Execute após confirmar os valores acima:
--
--   UPDATE public._cron_config
--   SET value = '<valor_de_CRON_SECRET>'
--   WHERE key = 'cron_key';
--
--   UPDATE public._cron_config
--   SET value = '<valor_de_INTERNAL_FUNCTION_KEY>'
--   WHERE key = 'internal_key';
--
-- PASSO 3 — Painel Asaas > Configurações > Webhooks
--   Cadastrar duas URLs distintas:
--     Pedidos:     https://<project-ref>.supabase.co/functions/v1/marketplace-webhook
--     Assinaturas: https://<project-ref>.supabase.co/functions/v1/subscriptions-webhook
--   A URL legada /functions/v1/asaas-webhook deve ser REMOVIDA.
--
-- Após esses 3 passos os cron jobs de payout e alertas de dead letter
-- estarão operacionais.
-- =====================================================================

-- Verificação: retorna quais entradas ainda têm PLACEHOLDER
-- (pode ser executado a qualquer momento para checar o estado)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public._cron_config WHERE value = 'PLACEHOLDER') THEN
    RAISE WARNING
      'Existem entradas PLACEHOLDER em _cron_config — cron jobs não funcionarão até atualização manual. '
      'Ver comentários em 20260702000030_cron_config_setup.sql';
  END IF;
END $$;
