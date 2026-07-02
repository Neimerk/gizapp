import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * alert-dead-letter
 * Agendado a cada 6h via cron-runner.
 * Consulta webhook_events com status=dead_letter nas últimas 24h
 * e envia e-mail de alerta via Resend para o endereço configurado.
 *
 * POST — protegido por x-internal-key (sem JWT)
 */

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_KEY  = Deno.env.get("INTERNAL_FUNCTION_KEY") ?? "";
const RESEND_KEY    = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL    = Deno.env.get("EMAIL_FROM") ?? "BrasUX <noreply@brasux.com.br>";
const ALERT_EMAIL   = Deno.env.get("ALERT_EMAIL") ?? Deno.env.get("ADMIN_EMAIL") ?? "";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const key = req.headers.get("x-internal-key") ?? "";
  if (!INTERNAL_KEY || key !== INTERNAL_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: events, error } = await admin
      .from("webhook_events")
      .select("id, event_type, source, last_error, retry_count, created_at, updated_at")
      .eq("status", "dead_letter")
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);

    const count = events?.length ?? 0;
    console.log(`[alert-dead-letter] ${count} dead_letter events nas últimas 24h`);

    if (count === 0) {
      return new Response(JSON.stringify({ ok: true, count: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!RESEND_KEY || !ALERT_EMAIL) {
      console.warn("[alert-dead-letter] RESEND_API_KEY ou ALERT_EMAIL não configurado — e-mail não enviado");
      return new Response(JSON.stringify({ ok: true, count, emailSent: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const rows = (events ?? []).map((e) =>
      `<tr>
        <td style="padding:4px 8px;border:1px solid #e2e8f0">${e.id.slice(0, 8)}</td>
        <td style="padding:4px 8px;border:1px solid #e2e8f0">${e.event_type}</td>
        <td style="padding:4px 8px;border:1px solid #e2e8f0">${e.retry_count}</td>
        <td style="padding:4px 8px;border:1px solid #e2e8f0">${e.last_error ?? "—"}</td>
        <td style="padding:4px 8px;border:1px solid #e2e8f0">${new Date(e.updated_at).toLocaleString("pt-BR")}</td>
      </tr>`
    ).join("\n");

    const html = `
<h2 style="color:#dc2626">⚠️ BrasUX — ${count} webhook(s) em dead_letter nas últimas 24h</h2>
<p>Os seguintes webhooks Asaas falharam após todas as tentativas de reprocessamento:</p>
<table style="border-collapse:collapse;font-family:monospace;font-size:13px;width:100%">
  <thead>
    <tr style="background:#f1f5f9">
      <th style="padding:4px 8px;border:1px solid #e2e8f0;text-align:left">ID</th>
      <th style="padding:4px 8px;border:1px solid #e2e8f0;text-align:left">Tipo</th>
      <th style="padding:4px 8px;border:1px solid #e2e8f0;text-align:left">Tentativas</th>
      <th style="padding:4px 8px;border:1px solid #e2e8f0;text-align:left">Último erro</th>
      <th style="padding:4px 8px;border:1px solid #e2e8f0;text-align:left">Atualizado em</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<p style="margin-top:16px;color:#64748b;font-size:12px">
  Acesse o painel admin para revisar e reprocessar manualmente.<br>
  Este alerta é enviado a cada 6 horas enquanto houver eventos em dead_letter.
</p>`;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      [ALERT_EMAIL],
        subject: `[BrasUX] ${count} webhook(s) em dead_letter — ação necessária`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.json().catch(() => ({}));
      console.error("[alert-dead-letter] Resend error:", err);
      return new Response(JSON.stringify({ ok: true, count, emailSent: false, error: err }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[alert-dead-letter] alerta enviado para ${ALERT_EMAIL}`);
    return new Response(JSON.stringify({ ok: true, count, emailSent: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[alert-dead-letter]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
