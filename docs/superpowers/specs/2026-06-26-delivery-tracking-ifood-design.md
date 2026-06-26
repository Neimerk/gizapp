# Rastreamento de entregas "nível iFood" — Design

**Data:** 2026-06-26
**Projeto:** BrasUX Shopping (gizapp)
**Status:** Aprovado (aguardando revisão do spec)

## Objetivo

Entregar ao **comprador** uma tela de acompanhamento de pedido no nível de
experiência do iFood, com atualização em **tempo real e sem delay**, porém
**sem mapa ao vivo**. O foco é: linha do tempo de status, ETA preciso,
notificações push por mudança de status e um card completo do entregador
(foto + nota + contato).

Todo o backend usado é **Supabase** (Postgres, Realtime, Edge Functions,
Storage) + frontend React. O backend .NET/SignalR **não é tocado** e sai do
caminho crítico do rastreamento.

## Decisões fechadas (brainstorming)

- ❌ **Sem mapa ao vivo** (sem Mapbox GL / Map Loads).
- ✅ **ETA via Mapbox Directions API** (perfil `driving-traffic`), com fallback
  Haversine automático se faltar `VITE_MAPBOX_TOKEN`.
- ✅ **Transporte de tempo real unificado no Supabase Realtime** (substitui o
  caminho quebrado entregador→Supabase / cliente→SignalR).
- ✅ **Card do entregador completo** (foto + avaliação por estrelas) — incluído
  nesta entrega como subsistema próprio.
- ✅ **`MapTrack.tsx` aposentado** (removido da UI; arquivo deletado).

## Problema atual (motivação)

1. **Furo de transporte:** o entregador grava posição em `courier_locations`
   (Supabase `upsert`), mas o cliente escuta `CourierLocationUpdated` via
   **SignalR (.NET)**. Nada conecta os dois → o mapa do cliente nunca atualiza.
2. **RLS bloqueia o cliente:** a policy `locations_all` em `courier_locations`
   só permite o próprio entregador/admin lerem a posição.
3. **Geocoding Mapbox v5** (descontinuado) em `MapTrack`.
4. **`maximumAge: 10_000`** no `watchPosition` do entregador devolve fixes de
   até 10s atrás.

## Status do pedido (referência)

Campo `orders.status` (numérico), conforme `OrdersPage`/`CourierPage`:

| status | significado |
|---|---|
| 0 | pendente / confirmado |
| 2 | pronto / disponível para entrega |
| 3 | em trânsito (saiu para entrega) |
| 4 | entregue |
| 5 | cancelado |

A timeline exibe os marcos: **Confirmado (0)** → **Preparando** → **Saiu para
entrega (3)** → **Chegando** → **Entregue (4)**, com tratamento de **Cancelado (5)**.
"Preparando" e "Chegando" são derivados (Preparando = status 0/2 antes do 3;
Chegando = status 3 com ETA < ~3 min). O mapeamento exato dos rótulos
intermediários é definido no plano de implementação.

## Arquitetura — 4 unidades isoladas

### A. Timeline de status (tempo real)

- **Componente novo** `src/components/order/DeliveryTimeline.tsx`: stepper
  vertical com os marcos acima; estado atual destacado; horários quando
  disponíveis; estado de Cancelado.
- **Tempo real:** Supabase `postgres_changes` na tabela `orders`, filtrado por
  `id=eq.{orderId}` (padrão já usado em `CourierPage`/`SellerPage`).
- **Mudança:** remover o listener SignalR `OrderStatusUpdated` em
  `OrdersPage.tsx` e passar a refletir o status via Supabase.
- **Interface:** recebe `order` e renderiza; sem estado interno além de
  animação. Depende só do tipo `Order`.
- **Requisitos de deploy:** Realtime habilitado em `orders`; RLS permitindo o
  comprador ler o próprio pedido (a confirmar na aplicação).

### B. ETA ("chega em ~X min")

- **Edge Function nova** `supabase/functions/delivery-eta/index.ts`:
  - Entrada: `{ orderId }` (+ JWT do comprador).
  - Autoriza: confirma que o `orderId` pertence ao usuário chamador.
  - Lê (service role) a posição do entregador associado em `courier_locations`
    e as coordenadas de destino do pedido.
  - Chama **Mapbox Directions** (`mapbox/driving-traffic`) origem→destino e
    devolve `{ etaMinutes, distanceKm }`.
  - **Fallback:** se faltar token Mapbox, calcula Haversine ÷ velocidade média
    (constante configurável) e marca `source: "haversine"`.
- **Coordenadas de destino:** geocodificadas **uma vez** e persistidas no
  pedido (colunas novas `orders.dest_lat`/`orders.dest_lng`), evitando
  geocoding repetido. Geocoding via Mapbox **v6** (ou Nominatim já existente em
  `utils/geo.ts` como fallback gratuito).
- **Frontend:** hook `useDeliveryEta(orderId, enabled)` que chama a função a
  cada ~60–90s **somente enquanto `status = 3`**. Exibido como texto no topo da
  tela de acompanhamento e usado para derivar o marco "Chegando".
- **Custo Mapbox:** ~5–10 Directions/entrega → dentro do free tier
  (100k/mês) até dezenas de milhares de entregas/mês.

### C. Push por mudança de status

- Reusar a Edge Function existente `send-push` (VAPID já configurado).
- **Disparo no código** que altera o status (em `gizApi`/Edge Functions de
  atualização de status), com mensagens prontas por estado destino
  (ex.: status 3 → "Seu pedido saiu para entrega 🛵").
- Fire-and-forget (`.catch(() => null)`), seguindo o padrão já existente em
  `gizApi.ts` (`supabase.functions.invoke("send-push", …)`).
- **Destinatário:** o `customer_id` do pedido.

### D. Card do entregador completo (foto + nota)

Subsistema com banco + storage + fluxo de avaliação.

- **Banco (migração nova):**
  - `profiles.avatar_url text` — foto do entregador.
  - Tabela `courier_ratings` (`id`, `delivery_id`, `courier_id`, `customer_id`,
    `stars int 1–5`, `comment text`, `created_at`), com RLS:
    - insert: o comprador do pedido entregue.
    - select: público/agregado conforme necessidade do card.
  - Média de nota: `view` `courier_rating_avg` (ou coluna agregada em
    `profiles` atualizada por trigger). Decisão fina no plano.
- **Foto:** entregador faz upload do avatar via `ImagePicker.tsx` (já existe)
  para um bucket de Storage (`avatars` ou reuso do bucket de imagens). Tela do
  entregador (`CourierPage`/conta) ganha o upload.
- **Avaliação:** após `status = 4`, a tela do comprador oferece avaliar o
  entregador (1–5 estrelas + comentário opcional). Insere em `courier_ratings`
  e atualiza a média.
- **Componente novo** `src/components/order/CourierCard.tsx`: foto, nome, nota
  (★ média), telefone/WhatsApp, botão de chat (`useChat`).

## Fluxo de dados (cliente, tela de acompanhamento)

```
OrdersPage / OrderCard
  ├─ subscribe orders (postgres_changes, id=orderId)  ──▶ status ──▶ DeliveryTimeline
  ├─ useDeliveryEta(orderId, status===3)  ──invoke──▶ Edge: delivery-eta ──▶ Mapbox Directions
  │         └─▶ "chega em ~X min" + deriva marco "Chegando"
  ├─ CourierCard (foto, nota, contato, chat)
  └─ (status===4) ──▶ RatingForm ──insert──▶ courier_ratings ──▶ média
```

Entregador (`CourierPage`):
```
watchPosition({enableHighAccuracy:true, maximumAge:0})
  └─ throttle (tempo + distância) ─▶ updateCourierLocation ─▶ courier_locations (upsert)
```
(A posição alimenta o ETA via Edge Function; sem broadcast de mapa porque não
há mapa.)

## Mudanças em código existente

- `src/pages/OrdersPage.tsx`: substituir bloco `MapTrack` pela tela de
  acompanhamento (Timeline + ETA + CourierCard + RatingForm); remover listeners
  SignalR de localização e de status.
- `src/components/ui/MapTrack.tsx`: **deletado**.
- `src/pages/CourierPage.tsx`: `watchPosition` com `maximumAge: 0` + throttle de
  escrita; upload de avatar.
- `src/services/gizApi.ts`: disparo de push nas transições de status; helpers de
  rating/avatar; persistência de `dest_lat/dest_lng`.
- `src/services/signalr.ts`: localização sai do caminho crítico; manter só se
  houver outro uso, senão simplificar.

## Tratamento de erros

- ETA: falha de rede/Mapbox → fallback Haversine; sem posição do entregador →
  "Calculando rota…" (sem quebrar a tela).
- Realtime: reconexão automática do Supabase; ao reconectar, refetch do pedido.
- Push: best-effort, nunca bloqueia o fluxo.
- Avaliação: idempotente por `delivery_id` (um rating por entrega).
- Geocoding do destino falho: ETA indisponível, timeline e push seguem normais.

## Testes / validação

- `npm run build` (`tsc -b`) e `npm run lint` limpos (gate do projeto;
  `noUnusedLocals`/`noUnusedParameters` ligados).
- Verificação manual do fluxo: criar pedido → mudar status (seller) → ver
  timeline atualizar em tempo real, push chegar, ETA aparecer em trânsito,
  avaliar entregador ao entregar.

## Passos de deploy (lado do usuário)

1. Rodar a migração SQL nova (colunas `orders.dest_lat/lng`, `profiles.avatar_url`,
   tabela `courier_ratings`, RLS, Realtime em `orders`).
2. Deploy das Edge Functions `delivery-eta` (e ajustes em `send-push` se preciso).
3. Confirmar/criar bucket de Storage para avatar.
4. Conferir `VITE_MAPBOX_TOKEN` no ambiente (para Directions); sem ele, ETA cai
   no Haversine.

## Fora de escopo (YAGNI / próximas entregas)

- Mapa ao vivo com interpolação e rota traçada.
- Map Matching (snap-to-road).
- Histórico/replay de trajeto.
- Avaliação da loja (este spec cobre só avaliação do entregador).
```
