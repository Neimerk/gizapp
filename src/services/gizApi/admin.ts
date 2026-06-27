// Parte do módulo gizApi (split por domínio). Não alterar lógica aqui.

import { supabase } from "../../lib/supabase";
import { shoppingDb } from "../shoppingSupabase";
import type { AdminBanner, AdminUser, BannerPayload, CouponAdmin, CouponAdminPayload, Order, OrderRow, WithdrawalAdmin } from "./core";
import { mapAdminBanner, mapCouponAdmin, mapOrder, notifyOrderStatus, validateBannerLink } from "./core";

export async function adminGetUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, role, active, store_id, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error("Erro ao buscar usuários.");

  const roleMap: Record<string, AdminUser["role"]> = {
    admin: "Admin", customer: "Customer", seller: "Seller", courier: "Courier",
  };

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    email: "",
    role: roleMap[row.role] ?? "Customer",
    active: row.active,
    storeId: row.store_id ?? null,
    store: null,
    createdAt: row.created_at,
  }));
}

export async function adminToggleUserActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("profiles").update({ active }).eq("id", id);
  if (error) throw new Error("Erro ao atualizar usuário.");
}

/* ── SELLER ORDERS API ───────────────────────────────────── */

export async function adminGetAllOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, stores(name), order_items(*)")
    .order("created_at", { ascending: false });

  if (error) throw new Error("Erro ao buscar pedidos.");
  return (data ?? []).map((row) => mapOrder(row as OrderRow));
}

export async function adminUpdateOrderStatus(id: string, status: number): Promise<void> {
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) throw new Error("Erro ao atualizar status.");
  void notifyOrderStatus(id, undefined, status);
}

/* ── SELLER: STORE MANAGEMENT ────────────────────────────── */

export async function adminGetCoupons(): Promise<CouponAdmin[]> {
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Erro ao buscar cupons.");
  return (data ?? []).map(mapCouponAdmin);
}

export async function adminCreateCoupon(payload: CouponAdminPayload): Promise<void> {
  const { error } = await supabase.from("coupons").insert({
    code:       payload.code.toUpperCase().trim(),
    type:       payload.type,
    value:      payload.value,
    label:      payload.label,
    min_order:  payload.minOrder ?? 0,
    max_uses:   payload.maxUses ?? null,
    expires_at: payload.expiresAt ?? null,
    active:     payload.active ?? true,
    uses_count: 0,
  });
  if (error) throw new Error(error.message ?? "Erro ao criar cupom.");
}

export async function adminUpdateCoupon(id: string, patch: Partial<CouponAdminPayload>): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.code      !== undefined) update.code       = patch.code.toUpperCase().trim();
  if (patch.type      !== undefined) update.type       = patch.type;
  if (patch.value     !== undefined) update.value      = patch.value;
  if (patch.label     !== undefined) update.label      = patch.label;
  if (patch.minOrder  !== undefined) update.min_order  = patch.minOrder;
  if (patch.maxUses   !== undefined) update.max_uses   = patch.maxUses ?? null;
  if (patch.expiresAt !== undefined) update.expires_at = patch.expiresAt ?? null;
  if (patch.active    !== undefined) update.active     = patch.active;
  const { error } = await supabase.from("coupons").update(update).eq("id", id);
  if (error) throw new Error("Erro ao atualizar cupom.");
}

export async function adminDeleteCoupon(id: string): Promise<void> {
  const { error } = await supabase.from("coupons").delete().eq("id", id);
  if (error) throw new Error("Erro ao excluir cupom.");
}

/* ── ADMIN: WITHDRAWALS ──────────────────────────────────── */

export async function adminGetWithdrawals(): Promise<WithdrawalAdmin[]> {
  const { data, error } = await supabase
    .from("courier_withdrawals")
    .select("*, profiles(name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Erro ao buscar saques.");
  return (data ?? []).map((r) => ({
    id:          r.id,
    courierId:   r.courier_id,
    courierName: (r.profiles as { name?: string } | null)?.name ?? "Entregador",
    amount:      Number(r.amount),
    pixKey:      r.pix_key,
    status:      r.status as WithdrawalAdmin["status"],
    note:        (r.note as string | null) ?? undefined,
    createdAt:   r.created_at,
    updatedAt:   r.updated_at,
  }));
}

export async function adminUpdateWithdrawal(
  id: string,
  status: "PAID" | "REJECTED",
  note?: string,
): Promise<void> {
  const { error } = await supabase
    .from("courier_withdrawals")
    .update({ status, ...(note ? { note } : {}) })
    .eq("id", id);
  if (error) throw new Error("Erro ao atualizar saque.");
}

/* ── BANNERS API ─────────────────────────────────────────── */

export async function adminGetBanners(): Promise<AdminBanner[]> {
  const { data, error } = await shoppingDb
    .from("banners")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error("Erro ao buscar banners.");
  return (data ?? []).map(mapAdminBanner);
}

export async function adminCreateBanner(payload: BannerPayload): Promise<void> {
  validateBannerLink(payload.link);
  const { error } = await shoppingDb.from("banners").insert({
    title: payload.title,
    description: payload.description ?? null,
    image_url: payload.imageUrl,
    link: payload.link ?? null,
    link_label: payload.linkLabel ?? null,
    badge: payload.badge ?? null,
    active: payload.active ?? true,
    sort_order: payload.sortOrder ?? 0,
    starts_at: payload.startsAt ?? null,
    ends_at: payload.endsAt ?? null,
  });
  if (error) throw new Error("Erro ao criar banner.");
}

export async function adminUpdateBanner(id: string, patch: Partial<BannerPayload>): Promise<void> {
  validateBannerLink(patch.link);
  const update: Record<string, unknown> = {};
  if (patch.title       !== undefined) update.title       = patch.title;
  if (patch.description !== undefined) update.description = patch.description ?? null;
  if (patch.imageUrl    !== undefined) update.image_url   = patch.imageUrl;
  if (patch.link        !== undefined) update.link        = patch.link ?? null;
  if (patch.linkLabel   !== undefined) update.link_label  = patch.linkLabel ?? null;
  if (patch.badge       !== undefined) update.badge       = patch.badge ?? null;
  if (patch.active      !== undefined) update.active      = patch.active;
  if (patch.sortOrder   !== undefined) update.sort_order  = patch.sortOrder;
  if (patch.startsAt    !== undefined) update.starts_at   = patch.startsAt ?? null;
  if (patch.endsAt      !== undefined) update.ends_at     = patch.endsAt ?? null;
  const { error } = await shoppingDb.from("banners").update(update).eq("id", id);
  if (error) throw new Error("Erro ao atualizar banner.");
}

export async function adminDeleteBanner(id: string): Promise<void> {
  const { error } = await shoppingDb.from("banners").delete().eq("id", id);
  if (error) throw new Error("Erro ao excluir banner.");
}
