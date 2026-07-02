/**
 * Utilitários HMAC para validação de webhooks.
 *
 * timingSafeCompare  — evita timing attacks em comparações de tokens
 * verifyHmacSha256   — verifica assinatura HMAC-SHA256 do corpo do webhook
 *
 * Uso típico:
 *   const rawBody = new Uint8Array(await req.arrayBuffer());
 *   const tokenOk = timingSafeCompare(req.headers.get("asaas-access-token") ?? "", TOKEN);
 *   const hmacOk  = await verifyHmacSha256(HMAC_SECRET, rawBody, req.headers.get("x-asaas-hmac-sha256") ?? "");
 */

/**
 * Compara duas strings em tempo constante.
 * Retorna false imediatamente se o comprimento diferir (sem vazar info do comprimento correto).
 */
export function timingSafeCompare(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab  = enc.encode(a);
  const bb  = enc.encode(b);
  // Sempre itera o comprimento máximo para não vazar timing por length
  const len = Math.max(ab.length, bb.length);
  let diff  = ab.length ^ bb.length; // não zero se comprimentos diferentes
  for (let i = 0; i < len; i++) {
    diff |= (ab[i % ab.length] ?? 0) ^ (bb[i % bb.length] ?? 0);
  }
  return diff === 0;
}

/**
 * Verifica assinatura HMAC-SHA256.
 *
 * @param secret    Segredo compartilhado (env ASAAS_WEBHOOK_HMAC_SECRET)
 * @param body      Corpo bruto como Uint8Array
 * @param signature Valor do header — aceita hex puro ou prefixado com "sha256="
 */
export async function verifyHmacSha256(
  secret:    string,
  body:      Uint8Array,
  signature: string,
): Promise<boolean> {
  if (!secret || !signature) return false;

  const hex = signature.startsWith("sha256=")
    ? signature.slice(7)
    : signature;

  let sigBytes: Uint8Array;
  try {
    sigBytes = hexToBytes(hex);
  } catch {
    return false; // hex malformado
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  return crypto.subtle.verify("HMAC", key, sigBytes, body);
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("hex length must be even");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}
