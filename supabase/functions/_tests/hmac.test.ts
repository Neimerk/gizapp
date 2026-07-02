/**
 * Testes para _shared/hmac.ts
 * Executar com: deno test supabase/functions/_tests/hmac.test.ts
 */

import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.208.0/assert/mod.ts";

import {
  timingSafeCompare,
  verifyHmacSha256,
} from "../_shared/hmac.ts";

// ── Utilitários ─────────────────────────────────────────────────────────────

async function signHmac(secret: string, body: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, body);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── timingSafeCompare ────────────────────────────────────────────────────────

Deno.test("timingSafeCompare: strings idênticas retornam true", () => {
  assertEquals(timingSafeCompare("abc123", "abc123"), true);
});

Deno.test("timingSafeCompare: strings diferentes retornam false", () => {
  assertEquals(timingSafeCompare("abc123", "abc124"), false);
});

Deno.test("timingSafeCompare: comprimentos diferentes retornam false sem vazar timing", () => {
  assertEquals(timingSafeCompare("abc", "abcdef"), false);
});

// ── verifyHmacSha256 ─────────────────────────────────────────────────────────

Deno.test("verifyHmacSha256: assinatura correta retorna true", async () => {
  const secret = "test-secret-key";
  const body   = new TextEncoder().encode('{"event":"PAYMENT_CONFIRMED"}');
  const sig    = await signHmac(secret, body);

  assertEquals(await verifyHmacSha256(secret, body, sig), true);
});

Deno.test("verifyHmacSha256: aceita prefixo sha256=", async () => {
  const secret = "test-secret-key";
  const body   = new TextEncoder().encode('{"event":"PAYMENT_CONFIRMED"}');
  const sig    = await signHmac(secret, body);

  assertEquals(await verifyHmacSha256(secret, body, `sha256=${sig}`), true);
});

Deno.test("verifyHmacSha256: assinatura inválida retorna false", async () => {
  const body = new TextEncoder().encode('{"event":"PAYMENT_CONFIRMED"}');
  assertEquals(
    await verifyHmacSha256("correct-secret", body, "deadbeef".repeat(8)),
    false,
  );
});

Deno.test("verifyHmacSha256: retorna false quando secret está vazio", async () => {
  const body = new TextEncoder().encode("{}");
  assertEquals(await verifyHmacSha256("", body, "abc"), false);
});
