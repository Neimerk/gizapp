import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, optionsResponse } from "../_shared/cors.ts";

// Cria uma sessão de convidado para checkout sem login.
// Não requer JWT de usuário — aceita chamadas com a anon key.
// Rate limit por IP hash para prevenir abuso.

async function hashIp(ip: string): Promise<string> {
  const data   = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16); // 8 bytes suficientes para rate-limit key
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin          = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json().catch(() => ({})) as {
      name?:  string;
      email?: string;
      phone?: string;
    };

    // ── Validação ────────────────────────────────────────────
    const name = body.name?.trim() ?? "";
    if (name.length < 2) {
      return json({ error: "Nome obrigatório (mínimo 2 caracteres)." }, 400, req);
    }

    const email = body.email?.trim() || null;
    if (email && !EMAIL_RE.test(email)) {
      return json({ error: "Email inválido." }, 400, req);
    }

    const phone = body.phone?.trim() || null;

    // ── Rate limit por IP ────────────────────────────────────
    const forwarded = req.headers.get("x-forwarded-for") ?? "";
    const ip        = forwarded.split(",")[0]?.trim() || "unknown";
    const ipHash    = await hashIp(ip);

    const { data: allowed } = await admin.rpc("check_rate_limit", {
      p_key:            `guest_session:${ipHash}`,
      p_max_requests:   10,
      p_window_seconds: 3600,
    });
    if (!allowed) {
      return json({ error: "Muitas tentativas. Aguarde um momento." }, 429, req);
    }

    // ── Cria sessão ──────────────────────────────────────────
    const { data: session, error } = await admin
      .from("guest_sessions")
      .insert({ name, email, phone, ip_hash: ipHash })
      .select("id, guest_token, name, email, phone, expires_at")
      .single();

    if (error || !session) {
      console.error("[create-guest-session] insert error:", error?.message);
      return json({ error: "Erro ao criar sessão de convidado." }, 500, req);
    }

    return json(
      {
        id:         session.id,
        guestToken: session.guest_token,
        name:       session.name,
        email:      session.email ?? null,
        phone:      session.phone ?? null,
        expiresAt:  session.expires_at,
      },
      201,
      req,
    );
  } catch (e) {
    console.error("[create-guest-session]", e);
    return json({ error: "Erro interno." }, 500, req);
  }
});
