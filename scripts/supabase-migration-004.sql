-- ============================================================
-- BrasUX — Migração 004: Geolocalização de Lojas
-- Execute no Supabase Dashboard → SQL Editor
-- ============================================================

alter table stores
  add column if not exists lat numeric(10, 7),
  add column if not exists lng numeric(10, 7);

-- Índice espacial simples para filtros por lat/lng
create index if not exists idx_stores_lat_lng
  on stores(lat, lng)
  where lat is not null and lng is not null;

comment on column stores.lat is 'Latitude da loja (WGS84). Preenchido automaticamente via geocoding do endereço ou GPS do lojista.';
comment on column stores.lng is 'Longitude da loja (WGS84).';
