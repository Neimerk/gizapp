import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * release-balance
 * Chamada internamente quando uma entrega é marcada como DELIVERED.
 * Libera créditos HELD → AVAILABLE para vendedor e entregador.
 */
serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const internalKey = Deno.env.get("INTERNAL_FUNCTION_KEY") ?? "";
  const reqKey      = req.headers.get("x-internal-key") ?? "";

  if (!internalKey || reqKey !== internalKey) {
    console.warn("[release-balance] unauthorized call");
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { orderId } = await req.json() as { orderId: string };

    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId obrigatório" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await admin.rpc("release_balance_after_delivery", {
      p_order_id: orderId,
    });

    if (error) {
      console.error("[release-balance] RPC error:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[release-balance] order=${orderId} result=${JSON.stringify(data)}`);

    return new Response(JSON.stringify({ ok: true, result: data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[release-balance] exception:", e);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
