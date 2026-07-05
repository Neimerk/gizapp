import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * refresh-materialized-views
 * Chamada pelo cron-runner a cada 15 min para manter views atualizadas:
 *   mv_featured_stores, mv_category_product_counts, mv_top_products
 * Usa REFRESH CONCURRENTLY (sem lock de leitura — zero downtime).
 */

serve(async (req) => {
  const internalKey = Deno.env.get("INTERNAL_FUNCTION_KEY") ?? "";
  const reqKey      = req.headers.get("x-internal-key") ?? "";

  if (!internalKey || reqKey !== internalKey) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await admin.rpc("refresh_materialized_views");

    if (error) {
      console.error("[refresh-materialized-views]", error.message);
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log("[refresh-materialized-views] OK");
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[refresh-materialized-views] exception:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
