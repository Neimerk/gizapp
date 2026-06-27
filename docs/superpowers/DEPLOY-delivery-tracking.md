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

3. **Avatar do entregador:** reutiliza o upload existente (`uploadProductImage` → ImageAPI .NET via `VITE_API_URL`). Nenhum bucket novo é necessário.

4. **send-push:** já deployada; confirmar que VAPID está configurado.

5. **Frontend (Vercel):** garantir `VITE_MAPBOX_TOKEN` definido (para geocoding
   client-side, se usado). O ETA usa o `MAPBOX_TOKEN` da Edge Function.

6. **Realtime:** no painel Supabase, confirmar Realtime habilitado para a
   tabela `orders` (Database → Replication).

Sem `MAPBOX_TOKEN`, o ETA cai automaticamente em estimativa Haversine.
