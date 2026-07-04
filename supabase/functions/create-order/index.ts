import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, optionsResponse } from "../_shared/cors.ts";

// create-order — cria pedido para usuário logado OU convidado.
// Aceita: Authorization: Bearer <JWT>  → usuário autenticado
//         X-Guest-Token: <token>       → convidado sem login

const UUID_RE            = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_METHODS    = new Set(["pix", "card", "boleto"]);
const MAX_DELIVERY_FEE   = 500;

type OrderItem = { storeProductId: string; quantity: number };

type OrderPayload = {
  storeId:              string;
  customerName:         string;
  customerPhone:        string;
  customerEmail?:       string;
  deliveryAddress:      string;
  deliveryNumber:       string;
  deliveryComplement?:  string;
  deliveryNeighborhood: string;
  paymentMethod:        string;
  items:                OrderItem[];
  deliveryFeeOverride?: number;
  couponCode?:          string;
  pointsDiscount?:      number;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const anonKey        = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin          = createClient(supabaseUrl, serviceRoleKey);

  try {
    // ── 1. Resolve identidade ────────────────────────────────
    const guestTokenHeader = req.headers.get("X-Guest-Token");
    const authHeader       = req.headers.get("Authorization");

    let userId:         string | null = null;
    let guestSessionId: string | null = null;
    let guestEmail:     string | null = null;
    let userEmail:      string | null = null;
    let rateLimitKey:   string;

    if (guestTokenHeader) {
      const { data: sess, error: sessErr } = await admin
        .from("guest_sessions")
        .select("id, email, expires_at")
        .eq("guest_token", guestTokenHeader)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (sessErr || !sess) {
        return json({ error: "Sessão de convidado inválida ou expirada." }, 401, req);
      }

      guestSessionId = sess.id as string;
      guestEmail     = (sess.email as string | null) ?? null;
      rateLimitKey   = `order:guest:${guestSessionId}`;

    } else if (authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authErr } = await userClient.auth.getUser();
      if (authErr || !user) return json({ error: "Token inválido." }, 401, req);

      userId       = user.id;
      userEmail    = user.email ?? null;
      rateLimitKey = `order:user:${userId}`;

    } else {
      return json({ error: "Autenticação necessária." }, 401, req);
    }

    // ── 2. Rate limit ────────────────────────────────────────
    const { data: allowed } = await admin.rpc("check_rate_limit", {
      p_key:            rateLimitKey,
      p_max_requests:   3,
      p_window_seconds: 60,
    });
    if (!allowed) return json({ error: "Muitas tentativas. Aguarde um momento." }, 429, req);

    // ── 3. Parse e valida payload ─────────────────────────────
    const payload = await req.json() as OrderPayload;

    if (!UUID_RE.test(payload.storeId))
      return json({ error: "Loja inválida." }, 400, req);
    if (!payload.items?.length || payload.items.length > 50)
      return json({ error: "Itens inválidos." }, 400, req);
    if (!ALLOWED_METHODS.has(payload.paymentMethod))
      return json({ error: "Método de pagamento inválido." }, 400, req);
    if (!payload.deliveryAddress?.trim() || !payload.deliveryNeighborhood?.trim())
      return json({ error: "Endereço incompleto." }, 400, req);
    if (!payload.customerName?.trim() || payload.customerName.trim().length < 2)
      return json({ error: "Nome obrigatório." }, 400, req);

    for (const item of payload.items) {
      if (!UUID_RE.test(item.storeProductId))
        return json({ error: "Produto inválido." }, 400, req);
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99)
        return json({ error: "Quantidade inválida." }, 400, req);
    }

    // ── 4. Busca loja ────────────────────────────────────────
    const { data: store, error: storeErr } = await admin
      .from("stores")
      .select("id, name, delivery_fee")
      .eq("id", payload.storeId)
      .eq("active", true)
      .single();

    if (storeErr || !store) return json({ error: "Loja não encontrada." }, 404, req);

    // ── 5. Busca produtos (preços server-side) ───────────────
    const productIds = payload.items.map((i) => i.storeProductId);
    const { data: products, error: prodErr } = await admin
      .from("store_products")
      .select("id, name, price, promotional_price, image_url, available")
      .in("id", productIds)
      .eq("store_id", payload.storeId); // garante que produtos pertencem à loja do pedido

    if (prodErr || !products) return json({ error: "Erro ao buscar produtos." }, 500, req);

    const enriched = payload.items.map((item) => {
      const p = products.find((x) => x.id === item.storeProductId);
      if (!p || !p.available) {
        throw new Error(`Produto não encontrado ou indisponível.`);
      }
      const unitPrice = Number(p.promotional_price ?? p.price);
      return {
        storeProductId: item.storeProductId,
        quantity:       item.quantity,
        unitPrice,
        totalPrice:     unitPrice * item.quantity,
        productName:    p.name as string,
        imageUrl:       (p.image_url as string | null) ?? null,
      };
    });

    // ── 6. Taxa de entrega ───────────────────────────────────
    const storeDefaultFee = Number(store.delivery_fee);
    let deliveryFee: number;

    if (payload.deliveryFeeOverride !== undefined) {
      const raw = Number(payload.deliveryFeeOverride);
      if (!isFinite(raw) || raw < 0) return json({ error: "Taxa de entrega inválida." }, 400, req);
      deliveryFee = Math.max(storeDefaultFee, Math.min(MAX_DELIVERY_FEE, raw));
    } else {
      deliveryFee = storeDefaultFee;
    }

    const subtotal = enriched.reduce((s, i) => s + i.totalPrice, 0);

    // ── 7. Pré-validação do cupom (sem consumir ainda) ───────
    // O consumo atômico ocorre DEPOIS do pedido e itens serem inseridos,
    // garantindo que cupom seja debitado apenas se o pedido existir.
    let couponDiscount = 0;
    let pendingCouponCode: string | null = null;
    let pendingCouponId: string | null = null;

    if (payload.couponCode?.trim()) {
      const { data: couponCheck, error: checkErr } = await admin
        .from("coupons")
        .select("id, type, value, min_order, expires_at, max_uses, uses_count, active")
        .eq("code", payload.couponCode.trim().toUpperCase())
        .eq("active", true)
        .maybeSingle();

      if (checkErr || !couponCheck) return json({ error: "Cupom inválido ou expirado." }, 422, req);
      if (couponCheck.expires_at && new Date(couponCheck.expires_at) < new Date())
        return json({ error: "Cupom expirado." }, 422, req);
      if (couponCheck.max_uses !== null && couponCheck.uses_count >= couponCheck.max_uses)
        return json({ error: "Cupom esgotado." }, 422, req);

      const minOrder = Number(couponCheck.min_order ?? 0);
      if (minOrder > 0 && subtotal < minOrder)
        return json({ error: `Cupom válido apenas para pedidos acima de R$ ${minOrder.toFixed(2).replace(".", ",")}.` }, 422, req);

      const c = couponCheck as { type: string; value: number };
      if (c.type === "percent")            couponDiscount = Math.round(subtotal * c.value / 100 * 100) / 100;
      else if (c.type === "fixed")         couponDiscount = Math.min(c.value, subtotal);
      else if (c.type === "free_delivery") couponDiscount = deliveryFee;

      pendingCouponCode = payload.couponCode.trim();
      pendingCouponId   = couponCheck.id as string;
    }

    // ── 8. Pré-validação de pontos (sem debitar ainda) ───────
    // O débito real ocorre no webhook de confirmação (spend_points_for_order),
    // evitando que pontos sejam debitados antes do pagamento ser confirmado.
    const pointsDiscount = Math.max(0, Math.floor(payload.pointsDiscount ?? 0));
    if (pointsDiscount > 0 && userId) {
      const { data: pointsRow } = await admin
        .from("user_points")        // tabela correta (loyalty_points não existe)
        .select("balance")
        .eq("user_id", userId)
        .maybeSingle();
      const balance = Number(pointsRow?.balance ?? 0);
      if (balance < pointsDiscount)
        return json({ error: "Pontos insuficientes." }, 422, req);
    }

    const total = Math.max(0.01, subtotal + deliveryFee - couponDiscount - pointsDiscount);

    // ── 9. Insere pedido ──────────────────────────────────────
    const customerEmail = guestEmail ?? userEmail ?? payload.customerEmail ?? null;

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        store_id:               payload.storeId,
        customer_id:            userId,
        guest_session_id:       guestSessionId,
        customer_email:         customerEmail,
        customer_name:          payload.customerName.trim(),
        customer_phone:         payload.customerPhone,
        delivery_address:       payload.deliveryAddress,
        delivery_number:        payload.deliveryNumber,
        delivery_complement:    payload.deliveryComplement ?? null,
        delivery_neighborhood:  payload.deliveryNeighborhood,
        payment_method:         payload.paymentMethod,
        delivery_fee:           deliveryFee,
        subtotal,
        total,
        coupon_id:              pendingCouponId,
        points_discount:        pointsDiscount,
        status:                 0,
        is_guest_checkout:      guestSessionId !== null,
      })
      .select()
      .single();

    if (orderErr || !order) {
      console.error("[create-order] order insert:", orderErr?.message);
      return json({ error: "Erro ao criar pedido." }, 500, req);
    }

    // ── 10. Insere itens ──────────────────────────────────────
    const { error: itemsErr } = await admin.from("order_items").insert(
      enriched.map((i) => ({
        order_id:         order.id,
        store_product_id: i.storeProductId,
        product_name:     i.productName,
        image_url:        i.imageUrl,
        unit_price:       i.unitPrice,
        quantity:         i.quantity,
        total_price:      i.totalPrice,
      })),
    );

    if (itemsErr) {
      await admin.from("orders").delete().eq("id", order.id);
      console.error("[create-order] items insert:", itemsErr.message);
      return json({ error: "Erro ao registrar itens do pedido." }, 500, req);
    }

    // ── 10b. Consome cupom atomicamente (pedido já existe) ────
    // Se o cupom foi esgotado por outra requisição paralela neste momento,
    // cancela o pedido e retorna erro — evita cupom consumido sem pedido válido.
    if (pendingCouponCode) {
      const { error: couponErr } = await admin.rpc("use_coupon_atomic", {
        p_code:             pendingCouponCode,
        p_user_id:          userId,
        p_guest_session_id: guestSessionId,
      });

      if (couponErr) {
        await admin.from("orders").delete().eq("id", order.id);
        const msg = couponErr.message.includes("INVALID_COUPON")   ? "Cupom inválido ou expirado."
                  : couponErr.message.includes("EXPIRED_COUPON")   ? "Cupom expirado."
                  : couponErr.message.includes("EXHAUSTED_COUPON") ? "Cupom esgotado. Tente sem o cupom."
                  : couponErr.message.includes("ALREADY_USED")     ? "Você já utilizou este cupom."
                  : "Erro ao aplicar cupom.";
        return json({ error: msg }, 422, req);
      }
    }

    // Pontos são debitados pelo marketplace-webhook quando pagamento confirma
    // (spend_points_for_order — idempotente). Nunca debitamos antes do pagamento.

    // ── 11. Busca tracking code (gerado por trigger para guests) ──
    let trackingCode: string | undefined;
    if (guestSessionId) {
      const { data: tracking } = await admin
        .from("guest_order_tracking")
        .select("tracking_code")
        .eq("order_id", order.id)
        .maybeSingle();
      trackingCode = (tracking?.tracking_code as string | null) ?? undefined;
    }

    // ── 12. Retorna pedido ────────────────────────────────────
    return json(
      {
        id:                   order.id,
        storeId:              order.store_id,
        storeName:            store.name,
        customerId:           order.customer_id   ?? undefined,
        guestSessionId:       order.guest_session_id ?? undefined,
        trackingCode,
        customerName:         order.customer_name,
        customerPhone:        order.customer_phone,
        deliveryAddress:      order.delivery_address,
        deliveryNumber:       order.delivery_number ?? "",
        deliveryComplement:   order.delivery_complement ?? "",
        deliveryNeighborhood: order.delivery_neighborhood,
        paymentMethod:        order.payment_method,
        deliveryFee,
        subtotal,
        total,
        status:               0,
        paymentStatus:        "PENDING",
        createdAt:            order.created_at,
        updatedAt:            order.updated_at,
        items: enriched.map((i, idx) => ({
          id:             `${order.id}-${idx}`,
          orderId:        order.id,
          storeProductId: i.storeProductId,
          productName:    i.productName,
          imageUrl:       i.imageUrl,
          unitPrice:      i.unitPrice,
          quantity:       i.quantity,
          totalPrice:     i.totalPrice,
        })),
      },
      201,
      req,
    );

  } catch (e) {
    console.error("[create-order]", e);
    return json({ error: e instanceof Error ? e.message : "Erro interno." }, 500, req);
  }
});
