# Rastreamento de entregas "nível iFood" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao comprador uma tela de acompanhamento de pedido estilo iFood (timeline de status em tempo real, ETA preciso, push por status e card completo do entregador com foto + nota), 100% sobre Supabase + frontend, sem mapa ao vivo.

**Architecture:** Status em tempo real via Supabase `postgres_changes` na tabela `orders`; ETA via Edge Function `delivery-eta` que chama Mapbox Directions (`driving-traffic`) com fallback Haversine; push reusando a Edge Function `send-push`; card do entregador com foto (reuso de `uploadProductImage`) e avaliação por estrelas (tabela `courier_ratings` + RPC `SECURITY DEFINER` + view de média). O SignalR/.NET sai do caminho crítico do rastreamento. `MapTrack.tsx` é deletado.

**Tech Stack:** React 19 + TypeScript + Vite, Tailwind v4 (tokens em `src/index.css`), Zustand, TanStack Query, Supabase (Postgres/Realtime/Edge Functions Deno), Mapbox Directions/Geocoding API.

## Global Constraints

- **Gate de validação:** `npm run build` (= `tsc -b && vite build`) **e** `npm run lint` (= `eslint .`) devem passar limpos ao fim de cada task. Não há runner de teste unitário no projeto — a verificação é build + lint + checagem manual.
- **`noUnusedLocals` / `noUnusedParameters` ligados:** import ou variável não usada é **erro de build**. Remova imports ao remover código.
- **Entregar arquivos completos drop-in**, não fragmentos. Mudar só o escopo da task.
- **Tokens de design:** componentes novos usam utilitários de token (`bg-surface`, `text-content`, `text-muted`, `border-line`, `bg-brand`…) quando possível; cores de marca (`#16a34a`, `#2563eb`…) podem ficar literais em gradientes/acentos, seguindo o padrão atual.
- **Status do pedido (numérico):** `0` confirmado · `2` pronto/preparando · `3` em trânsito (saiu) · `4` entregue · `5` cancelado.
- **Geocoding Mapbox:** usar **v6** (`https://api.mapbox.com/search/geocoding/v6/forward`). Nunca v5.
- **Commits frequentes**, mensagem terminando com:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: Migração de banco (schema + RLS + RPC + view + realtime)

**Files:**
- Create: `supabase/migrations/20260626000010_delivery_tracking.sql`
- Create: `scripts/supabase-migration-010-delivery-tracking.sql` (mirror — o projeto mantém os dois diretórios)

**Interfaces:**
- Produces (consumido por tasks 2, 6, 7): colunas `orders.dest_lat numeric`, `orders.dest_lng numeric`, `profiles.avatar_url text`; tabela `courier_ratings`; view `courier_rating_stats(courier_id, avg_stars numeric, ratings_count int)`; RPC `rate_courier(p_order_id uuid, p_stars int, p_comment text) returns void`; publicação Realtime incluindo `orders`.

- [ ] **Step 1: Criar o SQL da migração**

Conteúdo idêntico para os dois arquivos (`supabase/migrations/20260626000010_delivery_tracking.sql` e `scripts/supabase-migration-010-delivery-tracking.sql`):

```sql
-- ============================================================
-- Migração 010 — Rastreamento de entregas "nível iFood"
-- ============================================================

-- 1. Coordenadas de destino do pedido (geocodadas 1x, cacheadas)
alter table orders   add column if not exists dest_lat numeric(10, 7);
alter table orders   add column if not exists dest_lng numeric(10, 7);

-- 2. Foto do entregador (e demais perfis)
alter table profiles add column if not exists avatar_url text;

-- 3. Avaliações do entregador
create table if not exists courier_ratings (
  id          uuid default gen_random_uuid() primary key,
  delivery_id uuid references deliveries(id) on delete cascade not null,
  order_id    uuid references orders(id)     on delete cascade not null,
  courier_id  uuid references profiles(id)   on delete cascade not null,
  customer_id uuid references profiles(id)   on delete cascade not null,
  stars       int  not null check (stars between 1 and 5),
  comment     text,
  created_at  timestamptz default now() not null,
  unique (delivery_id)              -- uma avaliação por entrega (idempotente)
);

create index if not exists idx_courier_ratings_courier on courier_ratings(courier_id);

alter table courier_ratings enable row level security;

-- Cliente vê/insere a própria avaliação; entregador/admin podem ler as suas
create policy "ratings_select" on courier_ratings
  for select using (
    customer_id = auth.uid() or courier_id = auth.uid() or is_admin()
  );

-- 4. Média de notas por entregador
create or replace view courier_rating_stats as
  select courier_id,
         round(avg(stars)::numeric, 2) as avg_stars,
         count(*)::int                 as ratings_count
  from courier_ratings
  group by courier_id;

-- 5. RPC segura para avaliar (valida posse do pedido e que foi entregue)
create or replace function rate_courier(
  p_order_id uuid, p_stars int, p_comment text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_delivery deliveries%rowtype;
  v_order    orders%rowtype;
begin
  if p_stars < 1 or p_stars > 5 then
    raise exception 'stars_out_of_range';
  end if;

  select * into v_order from orders where id = p_order_id;
  if not found or v_order.customer_id <> auth.uid() then
    raise exception 'not_order_owner';
  end if;
  if v_order.status <> 4 then
    raise exception 'order_not_delivered';
  end if;

  select * into v_delivery from deliveries
    where order_id = p_order_id and status <> 'CANCELLED'
    order by created_at desc limit 1;
  if not found then
    raise exception 'no_delivery';
  end if;

  insert into courier_ratings (delivery_id, order_id, courier_id, customer_id, stars, comment)
  values (v_delivery.id, p_order_id, v_delivery.courier_id, auth.uid(), p_stars, nullif(trim(p_comment), ''))
  on conflict (delivery_id) do update
    set stars = excluded.stars, comment = excluded.comment, created_at = now();
end; $$;

grant execute on function rate_courier(uuid, int, text) to authenticated;

-- 6. Realtime: garantir que orders está na publicação
do $$ begin
  alter publication supabase_realtime add table orders;
exception when duplicate_object then null; end $$;
```

- [ ] **Step 2: Validar sintaxe localmente (lint do SQL é manual)**

Conferir visualmente: nomes de tabelas (`deliveries`, `orders`, `profiles`) batem com o schema existente; `is_admin()` existe (usado em `supabase-migration-003.sql`). Não há comando de build para SQL; a aplicação real é no painel do Supabase (passo de deploy, Task 10).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260626000010_delivery_tracking.sql scripts/supabase-migration-010-delivery-tracking.sql
git commit -m "feat(db): schema de rastreamento (dest coords, avatar, courier_ratings, RPC, realtime)"
```

---

### Task 2: Edge Function `delivery-eta`

**Files:**
- Create: `supabase/functions/delivery-eta/index.ts`

**Interfaces:**
- Consumes: colunas `orders.dest_lat/dest_lng`, tabela `deliveries`, `courier_locations` (Task 1).
- Produces (consumido pela Task 4): resposta JSON `{ etaMinutes: number, distanceKm: number, source: "mapbox" | "haversine", courierSeen: string | null }` ou `{ error: string }`.

**Padrão:** seguir `supabase/functions/send-push/index.ts` (helper `json`, CORS, auth via header). Segredos disponíveis no ambiente da função: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MAPBOX_TOKEN` (a configurar no deploy).

- [ ] **Step 1: Escrever a função**

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAPBOX_TOKEN = Deno.env.get("MAPBOX_TOKEN") ?? "";
const AVG_SPEED_KMH = 22; // fallback Haversine (trânsito urbano)

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function geocode(q: string): Promise<{ lat: number; lng: number } | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const url = `https://api.mapbox.com/search/geocoding/v6/forward?q=${encodeURIComponent(q)}&country=br&limit=1&access_token=${MAPBOX_TOKEN}`;
    const r = await fetch(url);
    const d = await r.json();
    const c = d.features?.[0]?.geometry?.coordinates;
    if (Array.isArray(c)) return { lng: c[0], lat: c[1] };
  } catch { /* ignore */ }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const { orderId } = await req.json() as { orderId?: string };
    if (!orderId) return json({ error: "orderId_required" }, 400);

    // Cliente autenticado (valida posse via RLS)
    const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: "unauthorized" }, 401);

    // Service role para ler posição do entregador (fura RLS com segurança)
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: order } = await admin
      .from("orders")
      .select("id, customer_id, dest_lat, dest_lng, delivery_address, delivery_number, delivery_neighborhood")
      .eq("id", orderId).single();
    if (!order || order.customer_id !== userData.user.id) return json({ error: "not_found" }, 404);

    // Geocode destino 1x e cacheia
    let destLat = order.dest_lat as number | null;
    let destLng = order.dest_lng as number | null;
    if (destLat == null || destLng == null) {
      const q = `${order.delivery_address} ${order.delivery_number}, ${order.delivery_neighborhood}, Brasil`;
      const g = await geocode(q);
      if (g) {
        destLat = g.lat; destLng = g.lng;
        await admin.from("orders").update({ dest_lat: destLat, dest_lng: destLng }).eq("id", orderId);
      }
    }
    if (destLat == null || destLng == null) return json({ error: "no_destination" }, 422);

    // Entregador atribuído → posição
    const { data: delivery } = await admin
      .from("deliveries")
      .select("courier_id, status")
      .eq("order_id", orderId).neq("status", "CANCELLED")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!delivery?.courier_id) return json({ error: "no_courier" }, 422);

    const { data: loc } = await admin
      .from("courier_locations")
      .select("lat, lng, updated_at")
      .eq("courier_id", delivery.courier_id).maybeSingle();
    if (!loc) return json({ error: "no_location" }, 422);

    // Mapbox Directions (driving-traffic); fallback Haversine
    if (MAPBOX_TOKEN) {
      try {
        const coords = `${loc.lng},${loc.lat};${destLng},${destLat}`;
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?overview=false&access_token=${MAPBOX_TOKEN}`;
        const r = await fetch(url);
        const d = await r.json();
        const route = d.routes?.[0];
        if (route) {
          return json({
            etaMinutes: Math.max(1, Math.round(route.duration / 60)),
            distanceKm: Math.round((route.distance / 1000) * 10) / 10,
            source: "mapbox",
            courierSeen: loc.updated_at,
          });
        }
      } catch { /* cai no fallback */ }
    }
    const km = haversineKm(loc.lat, loc.lng, destLat, destLng);
    return json({
      etaMinutes: Math.max(1, Math.round((km / AVG_SPEED_KMH) * 60)),
      distanceKm: Math.round(km * 10) / 10,
      source: "haversine",
      courierSeen: loc.updated_at,
    });
  } catch (_e) {
    return json({ error: "internal" }, 500);
  }
});
```

- [ ] **Step 2: Conferir o helper de CORS**

Abrir `supabase/functions/_shared/cors.ts` e confirmar que exporta `corsHeaders`. Se o nome divergir (ex.: export default), ajustar o import acima para o nome real. (Edge Functions Deno não entram no `tsc -b`; não há build local — validação é deploy.)

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/delivery-eta/index.ts
git commit -m "feat(edge): delivery-eta (Mapbox Directions + fallback Haversine + geocode cache)"
```

---

### Task 3: Push em mudança de status

**Files:**
- Modify: `src/services/gizApi.ts` (adicionar helper + chamadas em `sellerUpdateOrderStatus`, `adminUpdateOrderStatus`, e na atualização de status do entregador ~linha 1718-1735)

**Interfaces:**
- Consumes: Edge Function `send-push` existente (`supabase.functions.invoke("send-push", { body: { userId, title, body, url } })`).
- Produces: helper `notifyOrderStatus(orderId: string, customerId: string | undefined, status: number): void` (fire-and-forget).

- [ ] **Step 1: Adicionar o helper `notifyOrderStatus`**

Inserir em `src/services/gizApi.ts` logo após a definição de `SELLER_ALLOWED_STATUSES` (≈ linha 923):

```ts
const ORDER_STATUS_PUSH: Record<number, { title: string; body: string }> = {
  2: { title: "Pedido confirmado 👨‍🍳", body: "A loja começou a preparar seu pedido." },
  3: { title: "Saiu para entrega 🛵",   body: "Seu pedido está a caminho. Acompanhe o tempo estimado." },
  4: { title: "Pedido entregue ✅",      body: "Bom apetite! Que tal avaliar seu entregador?" },
  5: { title: "Pedido cancelado",        body: "Seu pedido foi cancelado." },
};

/** Dispara push ao comprador quando o status muda. Fire-and-forget. */
export function notifyOrderStatus(orderId: string, customerId: string | undefined, status: number): void {
  if (!customerId) return;
  const msg = ORDER_STATUS_PUSH[status];
  if (!msg) return;
  supabase.functions.invoke("send-push", {
    body: { userId: customerId, title: msg.title, body: msg.body, url: `/pedidos?o=${orderId}` },
  }).catch(() => null);
}
```

- [ ] **Step 2: Disparar em `sellerUpdateOrderStatus`**

Em `sellerUpdateOrderStatus` (≈ linha 933), após o bloco que confirma sucesso (`if (count === 0) ...`), adicionar a busca do `customer_id` e a notificação:

```ts
  if (count === 0) throw new Error("Pedido não encontrado ou sem permissão.");

  const { data: ord } = await supabase.from("orders").select("customer_id").eq("id", orderId).maybeSingle();
  notifyOrderStatus(orderId, ord?.customer_id as string | undefined, status);
```

- [ ] **Step 3: Disparar em `adminUpdateOrderStatus`**

Substituir o corpo de `adminUpdateOrderStatus` (≈ linha 954) por:

```ts
export async function adminUpdateOrderStatus(id: string, status: number): Promise<void> {
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) throw new Error("Erro ao atualizar status.");
  const { data: ord } = await supabase.from("orders").select("customer_id").eq("id", id).maybeSingle();
  notifyOrderStatus(id, ord?.customer_id as string | undefined, status);
}
```

- [ ] **Step 4: Disparar no fluxo do entregador**

Localizar onde o status do pedido é atualizado pelo entregador (em `updateDeliveryStatus`, ≈ linha 1718-1735, no ponto `await supabase.from("orders").update({ status: orderStatus })...`). Logo após esse update, adicionar:

```ts
    notifyOrderStatus(delivery.order_id, undefined, orderStatus);
```

E como aqui não temos `customer_id` em mãos, ajustar `notifyOrderStatus` para buscá-lo quando vier `undefined`: substituir a guarda inicial do helper (Step 1) por uma versão que busca o customer se necessário. Versão final do helper (substitui a do Step 1):

```ts
export async function notifyOrderStatus(orderId: string, customerId: string | undefined, status: number): Promise<void> {
  const msg = ORDER_STATUS_PUSH[status];
  if (!msg) return;
  let uid = customerId;
  if (!uid) {
    const { data } = await supabase.from("orders").select("customer_id").eq("id", orderId).maybeSingle();
    uid = data?.customer_id as string | undefined;
  }
  if (!uid) return;
  supabase.functions.invoke("send-push", {
    body: { userId: uid, title: msg.title, body: msg.body, url: `/pedidos?o=${orderId}` },
  }).catch(() => null);
}
```

> Com a versão final, os Steps 2 e 3 podem chamar `notifyOrderStatus(orderId, ord?.customer_id, status)` ou simplesmente `notifyOrderStatus(orderId, undefined, status)` (o helper resolve). Manter a chamada fire-and-forget com `void notifyOrderStatus(...)` para não exigir `await` onde não convém. Garantir que `void` seja usado para satisfazer o lint de promatch flutuante se aplicável.

- [ ] **Step 5: Validar**

Run: `npm run build` → Expected: PASS (sem erros TS, sem unused).
Run: `npm run lint` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/gizApi.ts
git commit -m "feat: push ao comprador em cada mudanca de status do pedido"
```

---

### Task 4: Hook `useDeliveryEta`

**Files:**
- Create: `src/hooks/useDeliveryEta.ts`

**Interfaces:**
- Consumes: Edge Function `delivery-eta` (Task 2).
- Produces (consumido por tasks 5 e 8): `useDeliveryEta(orderId: string, enabled: boolean): { etaMinutes: number | null; distanceKm: number | null; loading: boolean }`.

- [ ] **Step 1: Escrever o hook**

```ts
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type EtaResult = { etaMinutes: number | null; distanceKm: number | null; loading: boolean };

const POLL_MS = 75_000; // ~75s entre recálculos (controla custo Directions)

/**
 * Busca o ETA do pedido enquanto `enabled` (tipicamente status === 3).
 * Retorna null enquanto não há rota/posição disponível.
 */
export function useDeliveryEta(orderId: string, enabled: boolean): EtaResult {
  const [state, setState] = useState<EtaResult>({ etaMinutes: null, distanceKm: null, loading: false });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled || !orderId) {
      setState({ etaMinutes: null, distanceKm: null, loading: false });
      return;
    }
    let active = true;

    async function fetchEta() {
      setState((s) => ({ ...s, loading: true }));
      try {
        const { data, error } = await supabase.functions.invoke("delivery-eta", { body: { orderId } });
        if (!active) return;
        if (error || !data || (data as { error?: string }).error) {
          setState({ etaMinutes: null, distanceKm: null, loading: false });
          return;
        }
        const d = data as { etaMinutes: number; distanceKm: number };
        setState({ etaMinutes: d.etaMinutes, distanceKm: d.distanceKm, loading: false });
      } catch {
        if (active) setState({ etaMinutes: null, distanceKm: null, loading: false });
      }
    }

    fetchEta();
    timer.current = setInterval(fetchEta, POLL_MS);
    return () => {
      active = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, [orderId, enabled]);

  return state;
}
```

- [ ] **Step 2: Validar**

Run: `npm run build` → Expected: PASS. (Hook ainda sem consumidor; sem unused porque o export é usado nas tasks seguintes — se o build reclamar de export não usado, ele NÃO reclama: `noUnusedLocals` não afeta exports. OK.)
Run: `npm run lint` → Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useDeliveryEta.ts
git commit -m "feat: hook useDeliveryEta (poll da Edge Function delivery-eta)"
```

---

### Task 5: Componente `DeliveryTimeline`

**Files:**
- Create: `src/components/order/DeliveryTimeline.tsx`

**Interfaces:**
- Consumes: `status: number`, `etaMinutes: number | null`.
- Produces (consumido pela Task 8): `<DeliveryTimeline status={number} etaMinutes={number | null} />`.

**Marcos exibidos** (derivação dos rótulos intermediários definida aqui):
1. Confirmado — ativo quando `status >= 0`.
2. Preparando — ativo quando `status >= 2`.
3. Saiu para entrega — ativo quando `status >= 3`.
4. Chegando — ativo quando `status === 3 && etaMinutes !== null && etaMinutes <= 3`.
5. Entregue — ativo quando `status === 4`.
Estado `5` (cancelado) substitui a timeline por um aviso de cancelamento.

- [ ] **Step 1: Escrever o componente**

```tsx
import { Check, ChefHat, Bike, MapPin, PackageCheck, XCircle } from "lucide-react";

type Props = { status: number; etaMinutes: number | null };

type Step = { key: string; label: string; icon: typeof Check; reached: boolean; current: boolean };

export default function DeliveryTimeline({ status, etaMinutes }: Props) {
  if (status === 5) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4">
        <XCircle size={22} className="text-red-500" />
        <p className="text-sm font-bold text-red-600">Pedido cancelado</p>
      </div>
    );
  }

  const arriving = status === 3 && etaMinutes !== null && etaMinutes <= 3;
  const steps: Step[] = [
    { key: "confirmed", label: "Confirmado",        icon: Check,        reached: status >= 0, current: status < 2 },
    { key: "preparing", label: "Preparando",        icon: ChefHat,      reached: status >= 2, current: status === 2 },
    { key: "intransit", label: "Saiu para entrega", icon: Bike,         reached: status >= 3, current: status === 3 && !arriving },
    { key: "arriving",  label: "Chegando",          icon: MapPin,       reached: arriving || status >= 4, current: arriving },
    { key: "delivered", label: "Entregue",          icon: PackageCheck, reached: status >= 4, current: status === 4 },
  ];

  return (
    <ol className="space-y-0">
      {steps.map((s, i) => {
        const Icon = s.reached ? s.icon : s.icon;
        const last = i === steps.length - 1;
        return (
          <li key={s.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ring-2 transition-colors ${
                  s.reached ? "bg-[#16a34a] ring-[#16a34a]/20" : "bg-subtle ring-line"
                }`}
              >
                <Icon size={15} className={s.reached ? "text-white" : "text-faint"} />
              </div>
              {!last && <div className={`my-0.5 w-0.5 flex-1 ${s.reached ? "bg-[#16a34a]" : "bg-line"}`} style={{ minHeight: 22 }} />}
            </div>
            <div className={`pb-5 pt-1 ${last ? "" : ""}`}>
              <p className={`text-sm font-black ${s.current ? "text-[#16a34a]" : s.reached ? "text-content" : "text-faint"}`}>
                {s.label}
              </p>
              {s.key === "intransit" && s.current && etaMinutes !== null && (
                <p className="text-xs font-bold text-muted">Chega em ~{etaMinutes} min</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 2: Validar**

Run: `npm run build` → Expected: PASS.
Run: `npm run lint` → Expected: PASS. (Remover a linha `const Icon = s.reached ? s.icon : s.icon;` se o lint acusar expressão redundante — substituir por `const Icon = s.icon;`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/order/DeliveryTimeline.tsx
git commit -m "feat: DeliveryTimeline (stepper de status do pedido)"
```

---

### Task 6: Helpers de entregador + Componente `CourierCard`

**Files:**
- Modify: `src/services/gizApi.ts` (adicionar `getOrderCourier`)
- Create: `src/components/order/CourierCard.tsx`

**Interfaces:**
- Consumes: tabela `deliveries`, `profiles` (com `avatar_url`), view `courier_rating_stats` (Task 1).
- Produces:
  - `getOrderCourier(orderId: string): Promise<CourierInfo | null>` onde
    `type CourierInfo = { id: string; name: string; phone: string | null; avatarUrl: string | null; avgStars: number | null; ratingsCount: number }`.
  - `<CourierCard courier={CourierInfo} onChat={() => void} />` (consumido pela Task 8).

- [ ] **Step 1: Adicionar `getOrderCourier` e o tipo `CourierInfo` em `gizApi.ts`**

Inserir junto às demais funções de delivery (após `updateCourierLocation`, ≈ linha 1760):

```ts
export type CourierInfo = {
  id: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  avgStars: number | null;
  ratingsCount: number;
};

export async function getOrderCourier(orderId: string): Promise<CourierInfo | null> {
  const { data: del } = await supabase
    .from("deliveries")
    .select("courier_id")
    .eq("order_id", orderId).neq("status", "CANCELLED")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const courierId = del?.courier_id as string | undefined;
  if (!courierId) return null;

  const { data: prof } = await supabase
    .from("profiles").select("id, name, phone, avatar_url").eq("id", courierId).maybeSingle();
  if (!prof) return null;

  const { data: stats } = await supabase
    .from("courier_rating_stats").select("avg_stars, ratings_count").eq("courier_id", courierId).maybeSingle();

  return {
    id: prof.id as string,
    name: (prof.name as string) || "Entregador",
    phone: (prof.phone as string | null) ?? null,
    avatarUrl: (prof.avatar_url as string | null) ?? null,
    avgStars: stats ? Number(stats.avg_stars) : null,
    ratingsCount: stats ? Number(stats.ratings_count) : 0,
  };
}
```

- [ ] **Step 2: Escrever `CourierCard.tsx`**

```tsx
import { Star, Phone, MessageCircle, User } from "lucide-react";
import type { CourierInfo } from "../../services/gizApi";

type Props = { courier: CourierInfo; onChat: () => void };

export default function CourierCard({ courier, onChat }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
      {courier.avatarUrl ? (
        <img src={courier.avatarUrl} alt={courier.name} className="h-12 w-12 rounded-full object-cover ring-2 ring-line" />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-subtle ring-2 ring-line">
          <User size={20} className="text-faint" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-content">{courier.name}</p>
        <div className="flex items-center gap-1 text-xs font-bold text-muted">
          <Star size={12} className="fill-amber-400 text-amber-400" />
          {courier.avgStars !== null ? (
            <span>{courier.avgStars.toFixed(1)} <span className="text-faint">({courier.ratingsCount})</span></span>
          ) : (
            <span className="text-faint">Novo entregador</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {courier.phone && (
          <a
            href={`https://wa.me/55${courier.phone.replace(/\D/g, "")}`}
            target="_blank" rel="noopener noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#16a34a] text-white"
            aria-label="WhatsApp do entregador"
          >
            <Phone size={16} />
          </a>
        )}
        <button
          onClick={onChat}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2563eb] text-white"
          aria-label="Conversar com o entregador"
        >
          <MessageCircle size={16} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Validar**

Run: `npm run build` → Expected: PASS.
Run: `npm run lint` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/services/gizApi.ts src/components/order/CourierCard.tsx
git commit -m "feat: getOrderCourier + CourierCard (foto, nota, contato)"
```

---

### Task 7: Avaliação do entregador — `submitCourierRating` + `RatingForm`

**Files:**
- Modify: `src/services/gizApi.ts` (adicionar `submitCourierRating` e `getMyRatingForOrder`)
- Create: `src/components/order/RatingForm.tsx`

**Interfaces:**
- Consumes: RPC `rate_courier` e tabela `courier_ratings` (Task 1).
- Produces:
  - `submitCourierRating(orderId: string, stars: number, comment: string): Promise<void>`
  - `getMyRatingForOrder(orderId: string): Promise<number | null>` (estrelas já dadas, ou null)
  - `<RatingForm orderId={string} onDone={() => void} />` (consumido pela Task 8).

- [ ] **Step 1: Adicionar helpers em `gizApi.ts`**

Inserir após `getOrderCourier` (Task 6):

```ts
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
```

- [ ] **Step 2: Escrever `RatingForm.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { submitCourierRating, getMyRatingForOrder } from "../../services/gizApi";

type Props = { orderId: string; onDone?: () => void };

export default function RatingForm({ orderId, onDone }: Props) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    getMyRatingForOrder(orderId).then((s) => { if (s) setDone(s); });
  }, [orderId]);

  async function submit() {
    if (stars < 1) return;
    setSaving(true);
    try {
      await submitCourierRating(orderId, stars, comment.trim());
      setDone(stars);
      onDone?.();
    } finally {
      setSaving(false);
    }
  }

  if (done !== null) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-3 text-center">
        <div className="mb-1 flex justify-center gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} size={16} className={n <= done ? "fill-amber-400 text-amber-400" : "text-faint"} />
          ))}
        </div>
        <p className="text-xs font-bold text-muted">Obrigado por avaliar seu entregador!</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <p className="mb-2 text-sm font-black text-content">Como foi a entrega?</p>
      <div className="mb-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setStars(n)}
            aria-label={`${n} estrelas`}
          >
            <Star size={26} className={n <= (hover || stars) ? "fill-amber-400 text-amber-400" : "text-faint"} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comentário (opcional)"
        rows={2}
        className="mb-2 w-full resize-none rounded-xl border border-line bg-subtle px-3 py-2 text-sm text-content outline-none focus:ring-2 focus:ring-[#16a34a]/30"
      />
      <button
        onClick={submit}
        disabled={stars < 1 || saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black text-white disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : "Enviar avaliação"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Validar**

Run: `npm run build` → Expected: PASS.
Run: `npm run lint` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/services/gizApi.ts src/components/order/RatingForm.tsx
git commit -m "feat: avaliacao do entregador (RPC rate_courier + RatingForm)"
```

---

### Task 8: Container `DeliveryTracking` + integração no `OrdersPage`

**Files:**
- Create: `src/components/order/DeliveryTracking.tsx`
- Modify: `src/pages/OrdersPage.tsx` (substituir bloco `MapTrack`, remover listeners SignalR de localização e status, ligar Supabase realtime de status)

**Interfaces:**
- Consumes: `DeliveryTimeline` (T5), `useDeliveryEta` (T4), `CourierCard` + `getOrderCourier` (T6), `RatingForm` (T7).
- Produces: `<DeliveryTracking order={Order} onChat={() => void} />`.

- [ ] **Step 1: Escrever `DeliveryTracking.tsx`**

```tsx
import { useEffect, useState } from "react";
import DeliveryTimeline from "./DeliveryTimeline";
import CourierCard from "./CourierCard";
import RatingForm from "./RatingForm";
import { useDeliveryEta } from "../../hooks/useDeliveryEta";
import { getOrderCourier, type CourierInfo, type Order } from "../../services/gizApi";

type Props = { order: Order; onChat: () => void };

export default function DeliveryTracking({ order, onChat }: Props) {
  const inTransit = order.status === 3;
  const delivered = order.status === 4;
  const { etaMinutes } = useDeliveryEta(order.id, inTransit);
  const [courier, setCourier] = useState<CourierInfo | null>(null);

  useEffect(() => {
    if (order.status >= 3 && order.status <= 4) {
      getOrderCourier(order.id).then(setCourier);
    }
  }, [order.id, order.status]);

  return (
    <div className="space-y-3">
      {inTransit && etaMinutes !== null && (
        <div className="rounded-2xl bg-gradient-to-r from-[#16a34a] to-[#2563eb] p-4 text-white">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Tempo estimado</p>
          <p className="text-2xl font-black">~{etaMinutes} min</p>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-surface p-4">
        <DeliveryTimeline status={order.status} etaMinutes={etaMinutes} />
      </div>

      {courier && <CourierCard courier={courier} onChat={onChat} />}

      {delivered && <RatingForm orderId={order.id} />}
    </div>
  );
}
```

- [ ] **Step 2: Integrar no `OrdersPage` — ler o arquivo e localizar os pontos**

Run: abrir `src/pages/OrdersPage.tsx`. Localizar:
- o import de `MapTrack` (≈ linha 4) e de `ordersConnection`/`CourierPosition` (≈ 10-11);
- o `useEffect` que registra `ordersConnection.on("OrderStatusUpdated"|"OrderCreated")` (≈ 116-145);
- no `OrderCard`: o `useState`/`useEffect` de `courierPosition` e o listener `CourierLocationUpdated` (≈ 448-461);
- o JSX `<MapTrack ... courierPosition={courierPosition} />` (≈ 540-544).

- [ ] **Step 3: Substituir no `OrderCard` o bloco de mapa pelo `DeliveryTracking`**

No `OrderCard`:
- Remover `const [courierPosition, setCourierPosition] = useState<CourierPosition | null>(null);` e o `useEffect` do listener `CourierLocationUpdated`.
- Trocar o JSX `<MapTrack .../>` (e seu `<Suspense>`/lazy se houver) por:

```tsx
{(order.status === 3 || order.status === 4) && (
  <DeliveryTracking order={order} onChat={() => { /* abrir chat existente */ }} />
)}
```

- Adicionar no topo do arquivo: `import DeliveryTracking from "../components/order/DeliveryTracking";`
- Remover os imports agora não usados: `MapTrack` (lazy), `CourierPosition`. Para o chat, reutilizar o mecanismo já existente na página (se houver navegação para `/chat`); se não houver handler pronto, usar `onChat={() => window.location.assign("/chat")}` como ligação mínima (ajustar para o padrão real de navegação da página, ex.: `navigate` do react-router se já importado).

- [ ] **Step 4: Trocar o status em tempo real de SignalR para Supabase**

Substituir o `useEffect` que usa `ordersConnection.on("OrderStatusUpdated", …)` por uma subscription Supabase. No componente da lista (onde os pedidos são carregados via React Query), adicionar:

```tsx
useEffect(() => {
  const ch = supabase
    .channel("my-orders")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myOrders() });
    })
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}, [queryClient]);
```

Ajustes: importar `supabase` de `../lib/supabase` se ainda não importado; usar a `queryKey` real dos pedidos do comprador (procurar `queryKeys.` no arquivo — usar a chave existente de "meus pedidos"; se o nome diferir de `myOrders`, usar o nome real). Remover o import de `ordersConnection`/`startOrdersConnection` e o `useEffect` antigo de SignalR **somente se** nenhum outro trecho do arquivo os usar (conferir `OrderCreated`). Se `OrderCreated` ainda for desejado, migrá-lo para `event: "INSERT"` no mesmo canal.

- [ ] **Step 5: Validar**

Run: `npm run build` → Expected: PASS (atenção a imports não usados — `MapTrack`, `CourierPosition`, `ordersConnection`).
Run: `npm run lint` → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/order/DeliveryTracking.tsx src/pages/OrdersPage.tsx
git commit -m "feat: tela de acompanhamento (timeline+ETA+entregador) e status via Supabase Realtime"
```

---

### Task 9: `CourierPage` — GPS preciso + upload de avatar

**Files:**
- Modify: `src/pages/CourierPage.tsx`

**Interfaces:**
- Consumes: `uploadProductImage(file, storeId)` existente (reuso para avatar), `updateCourierLocation` (existente), e um novo `updateCourierAvatar`.
- Produces: nenhuma interface nova consumida por outras tasks.

- [ ] **Step 1: Adicionar `updateCourierAvatar` em `gizApi.ts`**

Inserir após `updateCourierLocation` (≈ linha 1760):

```ts
export async function updateCourierAvatar(url: string): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) return;
  await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
}
```

- [ ] **Step 2: GPS de alta precisão sem cache + throttle de escrita**

No `useEffect` de tracking de `CourierPage` (≈ linha 331-340), substituir o corpo por uma versão com `maximumAge: 0` e throttle por tempo+distância. Substituir o bloco inteiro por:

```tsx
  // ── GPS tracking quando há entrega ativa ──────────────────
  useEffect(() => {
    if (!activeDelivery || !user) return;
    if (!navigator.geolocation) return;
    let lastSent = 0;
    let lastLat = 0, lastLng = 0;
    const MIN_INTERVAL = 4_000;   // ms
    const MIN_MOVE_KM = 0.015;    // ~15 m
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        const { latitude, longitude, heading } = pos.coords;
        const moved = lastSent === 0 ? Infinity : haversineKm(lastLat, lastLng, latitude, longitude);
        if (now - lastSent < MIN_INTERVAL && moved < MIN_MOVE_KM) return;
        lastSent = now; lastLat = latitude; lastLng = longitude;
        updateCourierLocation(latitude, longitude, heading ?? undefined).catch(() => null);
      },
      null,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [activeDelivery?.id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
```

Adicionar o import de `haversineKm`: localizar a linha de import de `../utils/geo` (ou adicionar) e garantir `import { haversineKm } from "../utils/geo";` (conferir o caminho relativo correto a partir de `src/pages/`).

- [ ] **Step 3: Upload de avatar do entregador (UI)**

No bloco de perfil/conta do entregador em `CourierPage` (onde já há dados do entregador), adicionar um input de foto que reusa `uploadProductImage`. Inserir um pequeno componente inline (ou bloco) na seção apropriada:

```tsx
{/* Avatar do entregador */}
<label className="flex cursor-pointer items-center gap-3">
  <input
    type="file" accept="image/*" className="hidden"
    onChange={async (e) => {
      const f = e.target.files?.[0];
      if (!f || !user) return;
      try {
        const url = await uploadProductImage(f, user.id);
        await updateCourierAvatar(url);
        showToast("Foto atualizada!", "success");
      } catch {
        showToast("Falha no upload da foto.", "error");
      }
    }}
  />
  <span className="rounded-xl bg-[#0f172a] px-4 py-2 text-sm font-black text-white">Trocar foto</span>
</label>
```

Garantir os imports usados: `uploadProductImage` e `updateCourierAvatar` de `../services/gizApi`, e que `showToast`/`user` já existem no escopo (conferir; ambos são usados em outras partes da página). Se `uploadProductImage` exigir `storeId` não-vazio, `user.id` serve como pasta de destino.

- [ ] **Step 4: Validar**

Run: `npm run build` → Expected: PASS.
Run: `npm run lint` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/gizApi.ts src/pages/CourierPage.tsx
git commit -m "feat: GPS de alta precisao (maximumAge 0 + throttle) e upload de avatar do entregador"
```

---

### Task 10: Aposentar `MapTrack`, validação final e doc de deploy

**Files:**
- Delete: `src/components/ui/MapTrack.tsx`
- Create: `docs/superpowers/DEPLOY-delivery-tracking.md`

- [ ] **Step 1: Confirmar que `MapTrack` não tem mais consumidores**

Run: `grep -rn "MapTrack" src` → Expected: nenhum resultado (o `OrdersPage` já migrou na Task 8). Se aparecer, remover a referência antes de deletar.

- [ ] **Step 2: Deletar o arquivo**

```bash
git rm src/components/ui/MapTrack.tsx
```

- [ ] **Step 3: Escrever o guia de deploy**

`docs/superpowers/DEPLOY-delivery-tracking.md`:

```markdown
# Deploy — Rastreamento de entregas

Aplicar na ordem:

1. **Banco (Supabase → SQL Editor):** rodar
   `supabase/migrations/20260626000010_delivery_tracking.sql`.
   Confere: colunas `orders.dest_lat/dest_lng`, `profiles.avatar_url`,
   tabela `courier_ratings`, view `courier_rating_stats`, função `rate_courier`,
   e `orders` na publicação `supabase_realtime`.

2. **Edge Function:** deploy de `delivery-eta`
   (`supabase functions deploy delivery-eta`). Definir o segredo:
   `supabase secrets set MAPBOX_TOKEN=<seu_token>`.
   `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem no ambiente.

3. **send-push:** já deployada; confirmar que VAPID está configurado.

4. **Frontend (Vercel):** garantir `VITE_MAPBOX_TOKEN` definido (para geocoding
   client-side, se usado). O ETA usa o `MAPBOX_TOKEN` da Edge Function.

5. **Realtime:** no painel Supabase, confirmar Realtime habilitado para a
   tabela `orders` (Database → Replication).

Sem `MAPBOX_TOKEN`, o ETA cai automaticamente em estimativa Haversine.
```

- [ ] **Step 4: Validação final completa**

Run: `npm run build` → Expected: PASS.
Run: `npm run lint` → Expected: PASS.
Run: `grep -rn "MapTrack\|CourierLocationUpdated" src` → Expected: nenhum resultado.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: aposenta MapTrack e adiciona guia de deploy do rastreamento"
```

---

## Self-Review (cobertura do spec)

- **A. Timeline** → Tasks 5, 8. ✅
- **B. ETA (Mapbox Directions + fallback)** → Tasks 1 (dest coords), 2 (Edge), 4 (hook), 8 (UI). ✅
- **C. Push por status** → Task 3. ✅
- **D. Card completo (foto + nota)** → Tasks 1 (schema/RPC/view), 6 (card+helper), 7 (rating), 9 (avatar upload). ✅
- **Transporte unificado no Supabase / remoção SignalR de localização** → Task 8. ✅
- **MapTrack aposentado** → Task 10. ✅
- **Deploy (migração, Edge, bucket/avatar, token, realtime)** → Task 10. ✅

Notas de consistência: tipos `CourierInfo`, `Order`, assinaturas `getOrderCourier`/`submitCourierRating`/`getMyRatingForOrder`/`useDeliveryEta`/`notifyOrderStatus` referenciados de forma idêntica entre tasks. Avatar reusa `uploadProductImage` (sem bucket novo) — o passo de "bucket" do spec é substituído por reuso da ImageAPI existente; refletido no guia de deploy.
```
