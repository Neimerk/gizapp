/**
 * Helper de validação da URL da API Asaas.
 *
 * Em produção (ASAAS_ENV=production) sem ASAAS_API_URL configurada,
 * retorna null — o caller deve responder 503 imediatamente.
 *
 * Em desenvolvimento/sandbox sem ASAAS_API_URL, retorna a URL do sandbox
 * (comportamento original preservado).
 */
export function requireAsaasBase(fnName: string): string | null {
  const url = Deno.env.get("ASAAS_API_URL");
  const env = Deno.env.get("ASAAS_ENV") ?? "sandbox";

  if (!url && env === "production") {
    console.error(`[${fnName}] ASAAS_API_URL ausente em produção — abortando`);
    return null;
  }

  return url ?? "https://sandbox.asaas.com/api/v3";
}
