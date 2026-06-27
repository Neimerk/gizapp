import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, optionsResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401, req);

    const { orderId } = await req.json() as { orderId?: string };
    if (!orderId) return json({ error: "orderId_required" }, 400, req);

    // Cliente autenticado (valida identidade do usuário)
    const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: "unauthorized" }, 401, req);

    // Service role para ler deliveries/profiles sem restrição de RLS
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verifica posse do pedido
    const { data: order } = await admin
      .from("orders")
      .select("id, customer_id")
      .eq("id", orderId)
      .single();
    if (!order || order.customer_id !== userData.user.id) {
      return json({ error: "not_found" }, 404, req);
    }

    // Entregador ativo (última entrega não cancelada)
    const { data: del } = await admin
      .from("deliveries")
      .select("courier_id")
      .eq("order_id", orderId)
      .neq("status", "CANCELLED")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const courierId = del?.courier_id as string | undefined;
    if (!courierId) return json({ courier: null }, 200, req);

    // Perfil do entregador
    const { data: prof } = await admin
      .from("profiles")
      .select("id, name, phone, avatar_url")
      .eq("id", courierId)
      .maybeSingle();
    if (!prof) return json({ courier: null }, 200, req);

    // Estatísticas de avaliação
    const { data: stats } = await admin
      .from("courier_rating_stats")
      .select("avg_stars, ratings_count")
      .eq("courier_id", courierId)
      .maybeSingle();

    return json({
      courier: {
        id: prof.id as string,
        name: (prof.name as string | null) || "Entregador",
        phone: (prof.phone as string | null) ?? null,
        avatarUrl: (prof.avatar_url as string | null) ?? null,
        avgStars: stats ? Number(stats.avg_stars) : null,
        ratingsCount: stats ? Number(stats.ratings_count) : 0,
      },
    }, 200, req);
  } catch {
    return json({ error: "internal" }, 500, req);
  }
});
