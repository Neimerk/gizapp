// Parte do módulo gizApi (split por domínio). Não alterar lógica aqui.

import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/authStore";
import type { AvailableDelivery, CourierEarningSummary, CourierInfo, Delivery, WithdrawalRequest } from "./core";
import { mapDelivery, notifyOrderStatus } from "./core";

export async function getAvailableDeliveries(): Promise<AvailableDelivery[]> {
  // Busca pedidos em status=2 que ainda não foram aceitos por nenhum entregador
  const [ordersRes, takenRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, store_id, total, delivery_fee, delivery_address, delivery_number, delivery_neighborhood, created_at, stores(name, address, neighborhood)")
      .eq("status", 2)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("deliveries")
      .select("order_id")
      .neq("status", "CANCELLED"),
  ]);

  if (ordersRes.error) throw new Error("Erro ao buscar entregas disponíveis.");

  const takenIds = new Set((takenRes.data ?? []).map((d) => d.order_id as string));

  return (ordersRes.data ?? [])
    .filter((o) => !takenIds.has(o.id as string))
    .map((o) => {
      const store = o.stores as { name?: string; address?: string; neighborhood?: string } | null;
      const fee = Number(o.delivery_fee);
      return {
        orderId: o.id as string,
        storeId: o.store_id as string,
        storeName: store?.name ?? "Loja",
        storeAddress: store?.address
          ? `${store.address}${store.neighborhood ? `, ${store.neighborhood}` : ""}`
          : undefined,
        deliveryAddress: o.delivery_address as string,
        deliveryNumber: (o.delivery_number as string | null) ?? "",
        deliveryNeighborhood: o.delivery_neighborhood as string,
        deliveryFee: fee,
        total: Number(o.total),
        createdAt: o.created_at as string,
        courierEarnings: Math.max(7, Math.round(fee * 0.9 * 100) / 100),
      };
    });
}

export async function acceptDelivery(orderId: string): Promise<Delivery> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error("Não autenticado.");
  const { data, error } = await supabase
    .rpc("accept_delivery_safe", { p_order_id: orderId, p_courier_id: user.id });
  if (error) {
    if (error.code === "23505") throw new Error("Esta entrega já foi aceita por outro entregador.");
    throw new Error("Erro ao aceitar entrega.");
  }
  return mapDelivery(data as Record<string, unknown>);
}

export async function getMyDeliveries(): Promise<Delivery[]> {
  const user = useAuthStore.getState().user;
  if (!user) return [];
  const { data, error } = await supabase
    .from("deliveries")
    .select("*, orders(customer_name, customer_phone, delivery_address, delivery_number, delivery_complement, delivery_neighborhood, total, delivery_fee, stores(name, address, neighborhood), order_items(id, product_name, quantity, unit_price, total_price))")
    .eq("courier_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error("Erro ao buscar suas entregas.");
  return (data ?? []).map((d) => mapDelivery(d as Record<string, unknown>));
}

export async function updateDeliveryStatus(
  deliveryId: string,
  newStatus: "PICKED_UP" | "DELIVERED" | "CANCELLED",
): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error("Não autenticado.");

  const updates: Record<string, unknown> = { status: newStatus };
  if (newStatus === "PICKED_UP")  updates.picked_up_at = new Date().toISOString();
  if (newStatus === "DELIVERED")  updates.delivered_at = new Date().toISOString();

  const { data: delivery, error } = await supabase
    .from("deliveries")
    .update(updates)
    .eq("id", deliveryId)
    .eq("courier_id", user.id)
    .select("order_id, earnings")
    .single();

  if (error || !delivery) throw new Error("Erro ao atualizar entrega.");

  // Atualiza status do pedido
  const orderStatus = newStatus === "PICKED_UP" ? 3 : newStatus === "DELIVERED" ? 4 : undefined;
  if (orderStatus !== undefined) {
    await supabase.from("orders").update({ status: orderStatus }).eq("id", delivery.order_id);
    void notifyOrderStatus(delivery.order_id, undefined, orderStatus);
  }

  // Credita ganho ao entregador e libera saldo HELD quando entrega é concluída
  if (newStatus === "DELIVERED") {
    await supabase.from("courier_earnings").insert({
      courier_id: user.id,
      delivery_id: deliveryId,
      amount: Number(delivery.earnings),
      description: `Entrega #${(delivery.order_id as string).slice(0, 8).toUpperCase()}`,
    });

    // Libera saldo HELD → AVAILABLE para vendedor e entregador via Edge Function
    supabase.functions.invoke("release-balance", {
      body: { orderId: delivery.order_id },
    }).catch(() => null); // fire-and-forget: o split já está registrado; falha não bloqueia o fluxo
  }
}

export async function updateCourierLocation(lat: number, lng: number, heading?: number): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) return;
  await supabase
    .from("courier_locations")
    .upsert({ courier_id: user.id, lat, lng, heading: heading ?? null, updated_at: new Date().toISOString() });
}

export async function updateCourierAvatar(url: string): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) return;
  await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
}

export async function getOrderCourier(orderId: string): Promise<CourierInfo | null> {
  const { data, error } = await supabase.functions.invoke("order-courier", { body: { orderId } });
  if (error || !data || (data as { error?: string }).error) return null;
  const c = (data as { courier: CourierInfo | null }).courier;
  return c ?? null;
}

export async function submitCourierRating(orderId: string, stars: number, comment: string): Promise<void> {
  const { error } = await supabase.rpc("rate_courier", {
    p_order_id: orderId, p_stars: stars, p_comment: comment,
  });
  if (error) throw new Error("Não foi possível enviar a avaliação.");
}

export async function getMyRatingForOrder(orderId: string): Promise<number | null> {
  const { data } = await supabase
    .from("courier_ratings").select("stars").eq("order_id", orderId).maybeSingle();
  return data ? Number(data.stars) : null;
}

export async function getCourierEarningsSummary(): Promise<CourierEarningSummary> {
  const user = useAuthStore.getState().user;
  if (!user) return { todayTotal: 0, weekTotal: 0, allTimeTotal: 0, deliveriesCount: 0 };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const { data } = await supabase
    .from("courier_earnings")
    .select("amount, created_at")
    .eq("courier_id", user.id)
    .order("created_at", { ascending: false });

  const earnings = data ?? [];
  const todayTotal = earnings
    .filter((e) => new Date(e.created_at) >= todayStart)
    .reduce((s, e) => s + Number(e.amount), 0);
  const weekTotal = earnings
    .filter((e) => new Date(e.created_at) >= weekStart)
    .reduce((s, e) => s + Number(e.amount), 0);
  const allTimeTotal = earnings.reduce((s, e) => s + Number(e.amount), 0);

  return { todayTotal, weekTotal, allTimeTotal, deliveriesCount: earnings.length };
}

export async function getMyWithdrawals(): Promise<WithdrawalRequest[]> {
  const user = useAuthStore.getState().user;
  if (!user) return [];
  const { data } = await supabase
    .from("courier_withdrawals")
    .select("*")
    .eq("courier_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []).map((w) => ({
    id: w.id,
    amount: Number(w.amount),
    pixKey: w.pix_key,
    status: w.status as WithdrawalRequest["status"],
    note: (w.note as string | null) ?? undefined,
    createdAt: w.created_at,
  }));
}

export async function requestCourierWithdrawal(amount: number, pixKey: string): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error("Não autenticado.");
  const { error } = await supabase
    .from("courier_withdrawals")
    .insert({ courier_id: user.id, amount, pix_key: pixKey });
  if (error) throw new Error("Erro ao solicitar saque.");
}

/* ── ADMIN: COUPONS ──────────────────────────────────────── */
