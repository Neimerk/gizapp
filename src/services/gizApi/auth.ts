// Parte do módulo gizApi (split por domínio). Não alterar lógica aqui.

import { supabase } from "../../lib/supabase";
import type { AuthResponse, LoginPayload, RegisterPayload } from "./core";

export async function loginCustomer(_payload: LoginPayload): Promise<AuthResponse> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: _payload.email,
    password: _payload.password,
  });
  if (error || !data.user) throw new Error("Email ou senha inválidos.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role, store_id")
    .eq("id", data.user.id)
    .single();

  const roleMap: Record<string, AuthResponse["role"]> = {
    admin: "Admin", customer: "Customer", seller: "Seller", courier: "Courier",
  };

  const role = roleMap[profile?.role ?? "customer"] ?? "Customer";

  // Auditoria: login de admin registrado no banco
  if (role === "Admin") {
    supabase.from("audit_logs").insert({
      user_id:    data.user.id,
      action:     "ADMIN_LOGIN",
      table_name: "auth",
      extra:      { email: data.user.email, ua: navigator.userAgent.slice(0, 200) },
    }).then(() => null);
  }

  return {
    id: data.user.id,
    name: profile?.name ?? "",
    email: data.user.email ?? "",
    role,
    storeId: profile?.store_id ?? null,
    token: data.session?.access_token ?? "",
  };
}

export async function registerCustomer(payload: RegisterPayload): Promise<AuthResponse> {
  const { data, error } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
    // Não passar 'role' no metadata — o trigger handle_new_user ignora qualquer role
    // e sempre define 'customer'. Passar nome apenas.
    options: { data: { name: payload.name } },
  });
  if (error || !data.user) throw new Error(error?.message || "Erro ao cadastrar cliente.");

  return {
    id: data.user.id,
    name: payload.name,
    email: payload.email,
    role: "Customer",
    storeId: null,
    token: data.session?.access_token ?? "",
  };
}

/* ── STORE TYPES ─────────────────────────────────────────── */
