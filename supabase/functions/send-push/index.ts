import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VAPID_PUBLIC  = Deno.env.get("VAPID_PUBLIC_KEY")  ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT")     ?? "mailto:contato@brasux.com.br";

const ALLOWED_ORIGINS = [
  "https://shopping.brasux.com.br",
  "https://brasux.com.br",
  "https://brasux.store",
  "https://brasux.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

function cors(req?: Request): Record<string, string> {
  const origin = req?.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin":  allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

function json(data: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" },
  });
}

// ── VAPID JWT ─────────────────────────────────────────────────

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importVapidPrivateKey(rawBase64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(rawBase64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  // Wrap raw P-256 scalar (32 bytes) in PKCS8
  const pkcs8 = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
    0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
    ...raw,
  ]);
  return crypto.subtle.importKey("pkcs8", pkcs8, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function createVapidAuth(endpoint: string): Promise<string> {
  const audience = new URL(endpoint).origin;
  const enc      = new TextEncoder();

  const headerB64  = base64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payloadB64 = base64url(enc.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT,
  })));

  const signingInput = `${headerB64}.${payloadB64}`;
  const key          = await importVapidPrivateKey(VAPID_PRIVATE);
  const sigDer       = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(signingInput)));

  // DER → raw R||S (each 32 bytes)
  const r = sigDer.slice(4, 4 + sigDer[3]);
  const s = sigDer.slice(4 + sigDer[3] + 2);
  const rs = new Uint8Array(64);
  rs.set(r.slice(-32), 32 - r.length);
  rs.set(s.slice(-32), 64 - s.length);

  const jwt = `${signingInput}.${base64url(rs)}`;
  return `vapid t=${jwt}, k=${VAPID_PUBLIC}`;
}

// ── Send Web Push ─────────────────────────────────────────────

async function sendPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: string,
): Promise<number> {
  try {
    const authorization = await createVapidAuth(endpoint);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization:    authorization,
        "Content-Type":   "application/json",
        "Content-Length": String(new TextEncoder().encode(payload).length),
        TTL:              "60",
      },
      body: payload,
    });
    return res.status;
  } catch {
    return 500;
  }
}

// ── Serve ─────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return json({ ok: false, error: "VAPID não configurado." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader  = req.headers.get("Authorization");

  if (!authHeader) return json({ error: "Não autorizado." }, 401);

  const admin = createClient(supabaseUrl, serviceKey);

  // Aceita dois tipos de caller:
  //   1. Funções internas (asaas-webhook, send-order-emails) — passam service role key
  //   2. Sellers/admins autenticados — passam JWT de usuário válido
  const isInternal = authHeader === `Bearer ${serviceKey}`;

  if (!isInternal) {
    // Valida JWT do usuário e verifica que é seller ou admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Não autorizado." }, 401);

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["seller", "admin"].includes(profile.role)) {
      return json({ error: "Não autorizado." }, 401);
    }
  }

  try {

    const { userId, title, body, url } = await req.json() as {
      userId: string;
      title:  string;
      body:   string;
      url?:   string;
    };

    if (!userId || !title) return json({ error: "userId e title obrigatórios." }, 400);

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);

    const payload  = JSON.stringify({ title, body: body ?? "", url: url ?? "/" });
    const toDelete: string[] = [];
    let sent = 0;

    for (const sub of subs ?? []) {
      const status = await sendPush(sub.endpoint, sub.p256dh, sub.auth, payload);
      if (status === 201 || status === 200 || status === 202) {
        sent++;
      } else if (status === 410 || status === 404) {
        toDelete.push(sub.id);
      }
      console.log(`[push] ${status} → ${sub.endpoint.slice(0, 60)}…`);
    }

    if (toDelete.length > 0) {
      await admin.from("push_subscriptions").delete().in("id", toDelete);
    }

    return json({ ok: true, sent, removed: toDelete.length });
  } catch (e) {
    console.error("[send-push]", e);
    return json({ error: "Erro interno." }, 500);
  }
});
