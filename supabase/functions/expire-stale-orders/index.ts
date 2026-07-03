import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * expire-stale-orders
 * Expira pedidos pendentes de pagamento após vencimento de cada método:
 *   PIX:         >35 min  (PIX expira em 30 min + buffer)
 *   Boleto:      >4 dias  (vence em 3 dias + 1 dia de buffer)
 *   Cartão:      >30 min  (cobrança instantânea — se ficou pendente, falhou)
 *
 * Para cada pedido expirado:
 *   1. Libera reserva de cupom (release_coupon_for_order)
 *   2. Marca pedido como expirado (status=5, payment_status=EXPIRED)
 *
 * Pontos de fidelidade NÃO são revertidos — nunca foram debitados
 * (spend_points_for_order só é chamado no webhook de confirmação).
 *
 * Chamado pelo cron-runner via x-internal-key.
 * verify_jwt = false
 */

const INTERNAL_KEY = Deno.env.get("INTERNAL_FUNCTION_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const key = req.headers.get("x-internal-key") ?? "";
  if (!INTERNAL_KEY || key !== INTERNAL_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data, error } = await admin.rpc("expire_stale_orders");

    if (error) {
      console.error("[expire-stale-orders] RPC error:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const expired = (data as number) ?? 0;
    console.log(`[expire-stale-orders] expired=${expired}`);

    return new Response(JSON.stringify({ ok: true, expired }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[expire-stale-orders]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
