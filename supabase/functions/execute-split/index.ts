import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * execute-split
 * Chamada internamente pelo webhook-payment após pagamento aprovado.
 * Executa a divisão financeira do pedido via Postgres function atômica.
 * Requer SUPABASE_SERVICE_ROLE_KEY — não exposta ao browser.
 */
serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const internalKey = Deno.env.get("INTERNAL_FUNCTION_KEY") ?? "";
  const reqKey      = req.headers.get("x-internal-key") ?? "";

  if (!internalKey || reqKey !== internalKey) {
    console.warn("[execute-split] unauthorized call — missing or invalid x-internal-key");
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { orderId, paymentId } = await req.json() as { orderId: string; paymentId: string };

    if (!orderId || !paymentId) {
      return new Response(JSON.stringify({ error: "orderId e paymentId são obrigatórios" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await admin.rpc("execute_order_split", {
      p_order_id:  orderId,
      p_payment_id: paymentId,
    });

    if (error) {
      console.error("[execute-split] RPC error:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[execute-split] order=${orderId} result=${JSON.stringify(data)}`);

    return new Response(JSON.stringify({ ok: true, split: data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[execute-split] exception:", e);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
