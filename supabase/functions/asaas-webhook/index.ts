import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

/**
 * asaas-webhook — DESATIVADO
 *
 * Substituído por:
 *   marketplace-webhook   → pagamentos de pedidos
 *   subscriptions-webhook → pagamentos e ciclo de vida de assinaturas SaaS
 *
 * Retorna 200 para que o Asaas não reencaminhe eventos, mas não processa nada.
 * Para remover definitivamente: exclua este diretório e atualize a URL do
 * webhook no painel Asaas para apontar apenas para marketplace-webhook e
 * subscriptions-webhook.
 */

serve(async (req) => {
  let event = "unknown";
  try {
    const body = await req.json() as { event?: string };
    event = body.event ?? "unknown";
  } catch { /* ignora */ }

  console.warn(`[asaas-webhook] DEPRECATED — evento ignorado: ${event}. Use marketplace-webhook ou subscriptions-webhook.`);

  return new Response("OK", { status: 200 });
});
