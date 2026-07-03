import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, optionsResponse } from "../_shared/cors.ts";

// save-guest-address — persiste endereço de entrega no servidor para guests.
// Permite recuperação cross-device e migração ao criar conta.
//
// Auth: X-Guest-Token no header
// Rate limit: 20 endereços por sessão (evita abuso de storage)

type AddressPayload = {
  label?:      string;
  zipcode?:    string;
  street:      string;
  number:      string;
  complement?: string;
  district:    string;
  city?:       string;
  state?:      string;
  latitude?:   number;
  longitude?:  number;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin          = createClient(supabaseUrl, serviceRoleKey);

  try {
    // ── 1. Valida guest token ────────────────────────────────
    const guestToken = req.headers.get("X-Guest-Token");
    if (!guestToken) return json({ error: "X-Guest-Token obrigatório." }, 401, req);

    const { data: sess, error: sessErr } = await admin
      .from("guest_sessions")
      .select("id, expires_at")
      .eq("guest_token", guestToken)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (sessErr || !sess) return json({ error: "Sessão de convidado inválida ou expirada." }, 401, req);

    const sessionId = sess.id as string;

    // ── 2. GET: lista endereços ──────────────────────────────
    if (req.method === "GET") {
      const { data: addrs } = await admin
        .from("guest_addresses")
        .select("*")
        .eq("guest_session_id", sessionId)
        .order("created_at", { ascending: false });

      return json({ addresses: addrs ?? [] }, 200, req);
    }

    // ── 3. POST: salva novo endereço ─────────────────────────
    if (req.method !== "POST") return json({ error: "Método não permitido." }, 405, req);

    // Limite: 20 endereços por sessão
    const { count } = await admin
      .from("guest_addresses")
      .select("*", { count: "exact", head: true })
      .eq("guest_session_id", sessionId);

    if ((count ?? 0) >= 20) {
      return json({ error: "Limite de endereços por sessão atingido." }, 429, req);
    }

    const body = await req.json().catch(() => null) as AddressPayload | null;
    if (!body) return json({ error: "Body inválido." }, 400, req);

    if (!body.street?.trim() || !body.number?.trim() || !body.district?.trim()) {
      return json({ error: "Rua, número e bairro são obrigatórios." }, 400, req);
    }

    const { data: addr, error: insertErr } = await admin
      .from("guest_addresses")
      .insert({
        guest_session_id: sessionId,
        label:            body.label?.trim() || null,
        zipcode:          body.zipcode?.replace(/\D/g, "") || null,
        street:           body.street.trim(),
        number:           body.number.trim(),
        complement:       body.complement?.trim() || null,
        district:         body.district.trim(),
        city:             body.city?.trim() || null,
        state:            body.state?.trim() || null,
        latitude:         body.latitude ?? null,
        longitude:        body.longitude ?? null,
      })
      .select()
      .single();

    if (insertErr || !addr) {
      console.error("[save-guest-address] insert:", insertErr?.message);
      return json({ error: "Erro ao salvar endereço." }, 500, req);
    }

    return json({ address: addr }, 201, req);

  } catch (e) {
    console.error("[save-guest-address]", e);
    return json({ error: "Erro interno." }, 500, req);
  }
});
