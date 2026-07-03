import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAsaasBase } from "../_shared/asaas.ts";

/**
 * reconcile-withdrawals
 * Recupera saques presos em status='processing'.
 *
 * Cenário: process-withdrawal crashou/timed-out após marcar 'processing'
 * mas antes de marcar 'paid'. Sem este job, o saque fica preso para sempre
 * porque process-withdrawal rejeita status != 'pending'.
 *
 * Lógica por saque stuck (criado >45min e ainda 'processing'):
 *   - gateway_reference definido → consulta Asaas; atualiza conforme status real
 *   - gateway_reference nulo     → marca 'failed' para revisão manual
 *     (não reseta para 'pending': evita PIX duplo se a chamada Asaas completou
 *      mas o save falhou antes de gravar a referência)
 *
 * Chamado pelo cron-runner a cada 30 min via x-internal-key.
 */

const INTERNAL_KEY  = Deno.env.get("INTERNAL_FUNCTION_KEY") ?? "";
const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASAAS_KEY     = Deno.env.get("ASAAS_API_KEY") ?? "";
const ASAAS_BASE_RAW = requireAsaasBase("reconcile-withdrawals");
const ASAAS_BASE    = ASAAS_BASE_RAW ?? "";

// Asaas transfer statuses that mean "paid successfully"
const DONE_STATUSES    = new Set(["DONE", "TRANSFERRED"]);
// Statuses that mean "failed definitively"
const FAILED_STATUSES  = new Set(["FAILED", "CANCELLED", "DENIED"]);
// Statuses that are still in flight (leave in processing)
const PENDING_STATUSES = new Set(["PENDING", "BANK_PROCESSING", "AWAITING_TRANSFER_HOUR"]);

async function getAsaasTransfer(transferId: string): Promise<{ status: string } | null> {
  if (!ASAAS_KEY || !ASAAS_BASE) return null;
  try {
    const res = await fetch(`${ASAAS_BASE}/transfers/${transferId}`, {
      headers: { "access_token": ASAAS_KEY, "User-Agent": "BrasUX/2.0" },
    });
    if (!res.ok) return null;
    return await res.json() as { status: string };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const key = req.headers.get("x-internal-key") ?? "";
  if (!INTERNAL_KEY || key !== INTERNAL_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Saques em 'processing' criados há mais de 45 minutos
    const cutoff = new Date(Date.now() - 45 * 60 * 1000).toISOString();
    const { data: stuck, error: qErr } = await admin
      .from("withdrawals")
      .select("id, gateway_reference, amount_net, pix_key, pix_key_type")
      .eq("status", "processing")
      .lt("created_at", cutoff)
      .limit(50);

    if (qErr) throw new Error(qErr.message);
    if (!stuck || stuck.length === 0) {
      return new Response(JSON.stringify({ ok: true, reconciled: 0 }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const results: Array<{ id: string; action: string; reason?: string }> = [];

    for (const wd of stuck) {
      const wdId = wd.id as string;
      const ref  = wd.gateway_reference as string | null;

      if (!ref) {
        // Sem referência: não há como saber se o PIX foi enviado.
        // Marca como 'failed' para revisão manual — evita PIX duplo.
        await admin.from("withdrawals").update({
          status: "failed",
          notes:  "Timeout: stuck em processing sem gateway_reference — revisar manualmente",
        }).eq("id", wdId);

        console.warn(`[reconcile-withdrawals] wd=${wdId} sem gateway_reference → failed (manual review)`);
        results.push({ id: wdId, action: "failed", reason: "no_gateway_reference" });
        continue;
      }

      // Com referência: consulta Asaas para saber o status real
      const transfer = await getAsaasTransfer(ref);

      if (!transfer) {
        // Asaas inacessível: deixa em processing para a próxima rodada
        console.warn(`[reconcile-withdrawals] wd=${wdId} Asaas inacessível — aguardando`);
        results.push({ id: wdId, action: "skipped", reason: "asaas_unavailable" });
        continue;
      }

      if (DONE_STATUSES.has(transfer.status)) {
        await admin.from("withdrawals").update({
          status:       "paid",
          processed_at: new Date().toISOString(),
        }).eq("id", wdId);
        console.log(`[reconcile-withdrawals] wd=${wdId} Asaas=${transfer.status} → paid`);
        results.push({ id: wdId, action: "paid" });

      } else if (FAILED_STATUSES.has(transfer.status)) {
        await admin.from("withdrawals").update({
          status: "failed",
          notes:  `Asaas status: ${transfer.status}`,
        }).eq("id", wdId);
        console.log(`[reconcile-withdrawals] wd=${wdId} Asaas=${transfer.status} → failed`);
        results.push({ id: wdId, action: "failed", reason: transfer.status });

      } else if (PENDING_STATUSES.has(transfer.status)) {
        // Ainda em processamento no banco — não muda nada
        console.log(`[reconcile-withdrawals] wd=${wdId} Asaas=${transfer.status} → still in flight`);
        results.push({ id: wdId, action: "skipped", reason: transfer.status });

      } else {
        // Status desconhecido: deixa para revisão
        console.warn(`[reconcile-withdrawals] wd=${wdId} Asaas status desconhecido: ${transfer.status}`);
        results.push({ id: wdId, action: "skipped", reason: `unknown_status:${transfer.status}` });
      }
    }

    const reconciled = results.filter((r) => r.action === "paid" || r.action === "failed").length;
    console.log(`[reconcile-withdrawals] checked=${stuck.length} resolved=${reconciled}`);

    return new Response(JSON.stringify({ ok: true, reconciled, results }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[reconcile-withdrawals]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
