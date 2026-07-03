import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

/**
 * asaas-webhook — DESCOMISSIONADO
 *
 * Este endpoint foi substituído por:
 *   marketplace-webhook   → pagamentos de pedidos do marketplace
 *   subscriptions-webhook → pagamentos e ciclo de vida de assinaturas SaaS
 *
 * AÇÃO NECESSÁRIA: atualize as URLs de webhook no painel Asaas para apontar
 * para os endpoints corretos acima e REMOVA este webhook do painel.
 *
 * Retorna 410 Gone para sinalizar que o endpoint foi removido permanentemente
 * e forçar visibilidade no dashboard Asaas (ao invés de silenciar eventos).
 */

serve(async (req) => {
  let event = "unknown";
  try {
    const body = await req.json() as { event?: string };
    event = body.event ?? "unknown";
  } catch { /* ignora */ }

  console.error(
    `[asaas-webhook] DESCOMISSIONADO — evento "${event}" recebido mas não processado. ` +
    `Configure o painel Asaas para usar marketplace-webhook ou subscriptions-webhook.`
  );

  return new Response(
    JSON.stringify({
      error:   "Endpoint descomissionado.",
      action:  "Atualize a URL do webhook no painel Asaas.",
      targets: {
        marketplace:   "/functions/v1/marketplace-webhook",
        subscriptions: "/functions/v1/subscriptions-webhook",
      },
    }),
    {
      status: 410,
      headers: { "Content-Type": "application/json" },
    },
  );
});
