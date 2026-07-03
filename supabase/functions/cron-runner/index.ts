import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

/**
 * cron-runner
 * Intermediário entre pg_cron e as Edge Functions protegidas por x-internal-key.
 * Chamado pelo pg_cron com x-cron-key; repassa o INTERNAL_FUNCTION_KEY para
 * cada função alvo sem expô-lo no banco de dados.
 *
 * verify_jwt = false  (pg_cron não envia JWT)
 */

const CRON_SECRET  = Deno.env.get("CRON_SECRET") ?? "";
const INTERNAL_KEY = Deno.env.get("INTERNAL_FUNCTION_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

// https://xxx.supabase.co → https://xxx.supabase.co/functions/v1
const FN_BASE = SUPABASE_URL.endsWith("/")
  ? `${SUPABASE_URL}functions/v1`
  : `${SUPABASE_URL}/functions/v1`;

const JOBS: Record<string, { path: string; body: unknown }> = {
  "vendor-payout": {
    path: "/vendor-payout",
    body: { all: true },
  },
  "process-withdrawal": {
    path: "/process-withdrawal",
    body: { processAll: true },
  },
  "alert-dead-letter": {
    path: "/alert-dead-letter",
    body: {},
  },
  "expire-stale-orders": {
    path: "/expire-stale-orders",
    body: {},
  },
  "reconcile-withdrawals": {
    path: "/reconcile-withdrawals",
    body: {},
  },
  "reconcile-subscriptions": {
    path: "/reconcile-subscriptions",
    body: {},
  },
};

serve(async (req) => {
  // Valida chave de cron
  const key = req.headers.get("x-cron-key") ?? "";
  if (!CRON_SECRET || key !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { job } = await req.json().catch(() => ({} as Record<string, string>)) as { job?: string };
  const target = job && JOBS[job];

  if (!target) {
    return new Response(JSON.stringify({ error: `Job desconhecido: ${job}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const res = await fetch(`${FN_BASE}${target.path}`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "x-internal-key": INTERNAL_KEY,
      },
      body: JSON.stringify(target.body),
    });

    const data = await res.json().catch(() => null);
    console.log(`[cron-runner] ${job} → HTTP ${res.status}`, data);

    return new Response(JSON.stringify({ job, status: res.status, data }), {
      status: res.ok ? 200 : 502,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cron-runner] ${job} erro:`, msg);
    return new Response(JSON.stringify({ job, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
